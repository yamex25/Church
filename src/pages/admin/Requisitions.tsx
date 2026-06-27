import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardList, Plus, CheckCircle, XCircle, Clock,
  Search, Package, User, X, ShieldCheck, AlertCircle,
  Loader2, Trash2, Eye,
} from 'lucide-react';
import { RequisitionItem } from '@/src/types';
import { db, handleFirestoreError, OperationType, recordExpense } from '@/src/lib/firebase';
import {
  collection, query, orderBy, onSnapshot, addDoc, serverTimestamp,
  updateDoc, doc, where, getDocs,
} from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { Requisition, RequisitionStatus, UserRole, Employee, ExpenseType } from '@/src/types';
import { cn, formatCurrency, formatDate } from '@/src/lib/utils';
import { logAudit, AUDIT_ACTIONS } from '@/src/lib/audit';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_META: Record<RequisitionStatus, {
  label: string;
  color: string;
  bg: string;
  icon: React.ElementType;
  description: string;
}> = {
  [RequisitionStatus.PENDING]: {
    label: 'Pending Admin',
    color: 'text-church-yellow',
    bg: 'bg-yellow-50 border-yellow-400',
    icon: Clock,
    description: 'Awaiting admin review',
  },
  [RequisitionStatus.UNDER_REVIEW]: {
    label: 'Under Review',
    color: 'text-church-yellow',
    bg: 'bg-yellow-50 border-yellow-400',
    icon: Eye,
    description: 'Being reviewed by admin',
  },
  [RequisitionStatus.ADMIN_APPROVED]: {
    label: 'Admin Approved',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    icon: ShieldCheck,
    description: 'Awaiting finance final approval',
  },
  [RequisitionStatus.APPROVED]: {
    label: 'Fully Approved',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    icon: CheckCircle,
    description: 'Expense recorded',
  },
  [RequisitionStatus.DECLINED]: {
    label: 'Declined',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    icon: XCircle,
    description: 'Rejected',
  },
};

function StatusBadge({ status }: { status: RequisitionStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META[RequisitionStatus.PENDING];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border',
      meta.bg, meta.color,
    )}>
      <meta.icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

// ─── Approval stage pipeline ──────────────────────────────────────────────────

function ApprovalPipeline({ req }: { req: Requisition }) {
  const stages = [
    {
      label: 'Submitted',
      done: true,
      who: req.requestedBy,
      at: null,
    },
    {
      label: 'Admin Review',
      done: req.status === RequisitionStatus.UNDER_REVIEW
        || req.status === RequisitionStatus.ADMIN_APPROVED
        || req.status === RequisitionStatus.APPROVED,
      who: (req as any).adminReviewerName || null,
      at: (req as any).underReviewAt || null,
      declined: req.status === RequisitionStatus.DECLINED && req.declineStage === 'admin',
    },
    {
      label: 'Admin Approved',
      done: req.status === RequisitionStatus.ADMIN_APPROVED
        || req.status === RequisitionStatus.APPROVED,
      who: req.adminApproverName || null,
      at: req.adminApprovedAt || null,
      declined: req.status === RequisitionStatus.DECLINED && req.declineStage === 'admin',
    },
    {
      label: 'Finance Approved',
      done: req.status === RequisitionStatus.APPROVED,
      who: req.accountantApproverName || null,
      at: req.accountantApprovedAt || null,
      declined: req.status === RequisitionStatus.DECLINED && req.declineStage === 'accountant',
    },
  ];

  return (
    <div className="flex items-center gap-0 w-full mt-3">
      {stages.map((s, i) => (
        <React.Fragment key={s.label}>
          <div className="flex flex-col items-center min-w-0 flex-1">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2',
              s.declined
                ? 'bg-red-500 border-red-500 text-white'
                : s.done
                  ? 'bg-church-blue border-church-blue text-white'
                  : 'bg-white border-gray-200 text-gray-400',
            )}>
              {s.declined ? '✕' : s.done ? '✓' : i + 1}
            </div>
            <p className={cn(
              'text-[9px] font-bold uppercase tracking-wider mt-1 text-center',
              s.declined ? 'text-red-500' : s.done ? 'text-church-blue' : 'text-gray-400',
            )}>
              {s.label}
            </p>
            {s.who && (
              <p className="text-[9px] text-gray-400 text-center truncate max-w-[80px]">{s.who}</p>
            )}
          </div>
          {i < stages.length - 1 && (
            <div className={cn(
              'h-0.5 flex-1 mx-1',
              stages[i + 1].done || stages[i + 1].declined
                ? 'bg-church-blue'
                : 'bg-gray-200',
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type TabFilter = 'all' | 'pending' | 'under_review' | 'admin_approved' | 'approved' | 'declined';

export default function Requisitions() {
  const { user, churchId, isAdmin, isAccountant, isSuperAdmin, hasAction } = useAuth();
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null); // id of req being acted on
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<TabFilter>('all');
  const [empRecord, setEmpRecord] = useState<Employee | null>(null);

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  const blankItem = (): RequisitionItem => ({ name: '', quantity: 1, unitCost: 0, total: 0 });

  const [newReq, setNewReq] = useState({
    department: '',
    purpose: '',
    itemsList: [blankItem()],
  });

  const updateItem = (idx: number, field: keyof RequisitionItem, raw: string | number) => {
    setNewReq(prev => {
      const list = [...prev.itemsList];
      const item = { ...list[idx], [field]: raw };
      item.total = Number(item.quantity) * Number(item.unitCost);
      list[idx] = item;
      return { ...prev, itemsList: list };
    });
  };

  const addItem = () => setNewReq(p => ({ ...p, itemsList: [...p.itemsList, blankItem()] }));

  const removeItem = (idx: number) =>
    setNewReq(p => ({ ...p, itemsList: p.itemsList.filter((_, i) => i !== idx) }));

  const reqGrandTotal = newReq.itemsList.reduce((s, it) => s + it.total, 0);

  // ── Load departments ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!churchId) return;
    return onSnapshot(
      query(collection(db, 'churches', churchId, 'departments'), orderBy('name', 'asc')),
      snap => setDepartments(snap.docs.map(d => ({ id: d.id, name: d.data().name }))),
    );
  }, [churchId]);

  // ── Load own employee record ───────────────────────────────────────────────
  useEffect(() => {
    if (!churchId || !user?.email) return;
    return onSnapshot(
      query(collection(db, 'churches', churchId, 'employees'), where('email', '==', user.email)),
      snap => {
        if (!snap.empty) {
          const emp = snap.docs[0].data() as Employee;
          setEmpRecord(emp);
          if (emp.department) setNewReq(prev => ({ ...prev, department: emp.department }));
        }
      },
    );
  }, [user, churchId]);

  // ── Load all requisitions ──────────────────────────────────────────────────
  useEffect(() => {
    if (!churchId) return;
    return onSnapshot(
      query(collection(db, 'churches', churchId, 'requisitions'), orderBy('createdAt', 'desc')),
      snap => {
        setRequisitions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Requisition)));
        setLoading(false);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'requisitions'),
    );
  }, [churchId]);

  // handleCreate is kept as a no-op; actual submission is in the modal button's onClick
  const handleCreate = (e?: React.FormEvent) => e?.preventDefault();

  // ── Stage 0.5: Admin marks PENDING → UNDER_REVIEW ────────────────────────
  const handleMarkUnderReview = async (req: Requisition) => {
    if (!user || !req.id) return;
    setActing(req.id);
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'churches', churchId!, 'requisitions', req.id), {
        status: RequisitionStatus.UNDER_REVIEW,
        adminReviewerId: user.uid,
        adminReviewerName: user.displayName,
        underReviewAt: now,
        updatedAt: serverTimestamp(),
      });
      await logAudit(churchId!, user, {
        module: 'requisitions',
        action: AUDIT_ACTIONS.REQUISITION_UNDER_REVIEW,
        entityType: 'requisition',
        entityId: req.id,
        details: `Marked under review: ${req.itemName ?? req.items} (${req.department})`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'requisitions');
    } finally {
      setActing(null);
    }
  };

  // ── Stage 1: Admin approves PENDING/UNDER_REVIEW → ADMIN_APPROVED ────────
  const handleAdminApprove = async (req: Requisition) => {
    if (!user || !req.id) return;
    setActing(req.id);
    try {
      await updateDoc(doc(db, 'churches', churchId!, 'requisitions', req.id), {
        status: RequisitionStatus.ADMIN_APPROVED,
        adminApproverId: user.uid,
        adminApproverName: user.displayName,
        adminApprovedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
      await logAudit(churchId!, user, {
        module: 'requisitions',
        action: AUDIT_ACTIONS.REQUISITION_ADMIN_APPROVED,
        entityType: 'requisition',
        entityId: req.id,
        details: `Admin approved requisition: ${req.itemName ?? req.items} (${req.department})`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'requisitions');
    } finally {
      setActing(null);
    }
  };

  // ── Stage 2: Finance approves ADMIN_APPROVED → APPROVED + records expense ─
  const handleFinanceApprove = async (req: Requisition) => {
    if (!user || !req.id) return;
    setActing(req.id);
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'churches', churchId!, 'requisitions', req.id), {
        status: RequisitionStatus.APPROVED,
        accountantApproverId: user.uid,
        accountantApproverName: user.displayName,
        accountantApprovedAt: now,
        updatedAt: serverTimestamp(),
      });

      // Record expense — only happens here, after finance's final approval
      const amount = req.total ?? req.estimatedCost ?? 0;
      if (amount > 0) {
        await recordExpense(churchId!, {
          type: ExpenseType.REQUISITION,
          category: req.department,
          description: `Requisition: ${req.itemName ?? req.items} — ${req.purpose ?? 'Dept requisition'}`,
          amount,
          date: now.split('T')[0],
          relatedId: req.id,
          recordedBy: user.uid,
        });
      }

      // If stockable → add to assets
      if (req.stockable) {
        await addDoc(collection(db, 'churches', churchId!, 'assets'), {
          churchId: churchId!,
          name: req.itemName ?? req.items,
          category: 'Requisition Item',
          department: req.department,
          value: amount,
          location: 'Storage',
          condition: 'Good',
          purchaseDate: now.split('T')[0],
          createdAt: serverTimestamp(),
        });
      }

      await logAudit(churchId!, user, {
        module: 'requisitions',
        action: AUDIT_ACTIONS.REQUISITION_FINANCE_APPROVED,
        entityType: 'requisition',
        entityId: req.id,
        details: `Finance approved requisition: ${req.itemName ?? req.items} (${req.department}) — expense recorded`,
      });

      alert('Final approval granted. Expense recorded.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'requisitions');
    } finally {
      setActing(null);
    }
  };

  // ── Decline at any stage ───────────────────────────────────────────────────
  const handleDecline = async (req: Requisition) => {
    if (!user || !req.id) return;
    const reason = prompt('Reason for declining:');
    if (reason === null) return;

    const stage: 'admin' | 'accountant' =
      req.status === RequisitionStatus.ADMIN_APPROVED ? 'accountant' : 'admin';

    setActing(req.id);
    try {
      await updateDoc(doc(db, 'churches', churchId!, 'requisitions', req.id), {
        status: RequisitionStatus.DECLINED,
        declinedById: user.uid,
        declinedByName: user.displayName,
        declinedAt: new Date().toISOString(),
        declineReason: reason,
        declineStage: stage,
        updatedAt: serverTimestamp(),
      });
      await logAudit(churchId!, user, {
        module: 'requisitions',
        action: AUDIT_ACTIONS.REQUISITION_DECLINED,
        entityType: 'requisition',
        entityId: req.id,
        details: `Declined requisition: ${req.itemName ?? req.items} (${req.department}) — reason: ${reason}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'requisitions');
    } finally {
      setActing(null);
    }
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  const canSubmit = isAdmin || user?.role === UserRole.DEPARTMENT_HEAD;
  const tabMap: Record<TabFilter, RequisitionStatus | null> = {
    all: null,
    pending: RequisitionStatus.PENDING,
    under_review: RequisitionStatus.UNDER_REVIEW,
    admin_approved: RequisitionStatus.ADMIN_APPROVED,
    approved: RequisitionStatus.APPROVED,
    declined: RequisitionStatus.DECLINED,
  };

  const filtered = requisitions.filter(r => {
    const matchTab = tab === 'all' || r.status === tabMap[tab];
    const matchSearch =
      r.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.items ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.itemName ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requestedBy.toLowerCase().includes(searchTerm.toLowerCase());
    return matchTab && matchSearch;
  });

  const counts = {
    pending: requisitions.filter(r => r.status === RequisitionStatus.PENDING).length,
    under_review: requisitions.filter(r => r.status === RequisitionStatus.UNDER_REVIEW).length,
    admin_approved: requisitions.filter(r => r.status === RequisitionStatus.ADMIN_APPROVED).length,
    approved: requisitions.filter(r => r.status === RequisitionStatus.APPROVED).length,
    declined: requisitions.filter(r => r.status === RequisitionStatus.DECLINED).length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 text-church-black">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-black tracking-tight">Requisitions</h2>
          <p className="text-church-gray text-sm mt-1">Two-step approval: Admin → Accountant → Expense recorded</p>
        </div>
        {canSubmit && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-church-blue text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-church-blue/20"
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        )}
      </div>

      {/* Role indicator */}
      {(isSuperAdmin || hasAction('requisitions:admin_review') || isAccountant || hasAction('requisitions:finance_approve')) && (
        <div className={cn(
          'flex items-center gap-3 rounded-2xl border px-5 py-3',
          isSuperAdmin
            ? 'bg-church-blue/5 border-church-blue/15'
            : (isAccountant || hasAction('requisitions:finance_approve'))
              ? 'bg-yellow-50 border-yellow-400'
              : 'bg-church-blue/5 border-church-blue/15',
        )}>
          <ShieldCheck className={cn(
            'w-5 h-5 flex-shrink-0',
            isSuperAdmin
              ? 'text-church-blue'
              : (isAccountant || hasAction('requisitions:finance_approve'))
                ? 'text-church-yellow'
                : 'text-church-blue',
          )} />
          <div className="text-sm">
            {isSuperAdmin ? (
              <>
                <span className="font-bold text-church-blue">Super Admin View</span>
                <span className="text-church-gray"> — Full access to all approval actions across all stages.</span>
              </>
            ) : (isAccountant || hasAction('requisitions:finance_approve')) ? (
              <>
                <span className="font-bold text-church-yellow">Finance Approver View</span>
                <span className="text-church-yellow"> — You give the final approval. Only "Admin Approved" requisitions require your action.</span>
              </>
            ) : (
              <>
                <span className="font-bold text-church-blue">Admin Reviewer View</span>
                <span className="text-church-gray"> — You review and approve pending requisitions. Finance does the final sign-off.</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {([
          ['all', 'All', requisitions.length],
          ['pending', 'Pending', counts.pending],
          ['under_review', 'Under Review', counts.under_review],
          ['admin_approved', 'Admin Approved', counts.admin_approved],
          ['approved', 'Fully Approved', counts.approved],
          ['declined', 'Declined', counts.declined],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key as TabFilter)}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
              tab === key
                ? 'bg-church-blue text-white shadow-md'
                : 'bg-church-soft text-church-gray hover:bg-church-blue/10',
            )}
          >
            {label}
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-black',
              tab === key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600',
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray" />
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search department, item, requester…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-church-blue/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-church-blue" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-church-gray/30 mx-auto mb-3" />
          <p className="text-church-gray font-medium">No requisitions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(req => {
            const amount = req.total ?? req.estimatedCost ?? 0;
            const isLoading = acting === req.id;

            // What actions can the current user take? (RBAC-gated)
            const canMarkUnderReview =
              (isSuperAdmin || hasAction('requisitions:admin_review')) &&
              req.status === RequisitionStatus.PENDING;
            const canAdminApprove =
              (isSuperAdmin || hasAction('requisitions:admin_review')) &&
              (req.status === RequisitionStatus.PENDING || req.status === RequisitionStatus.UNDER_REVIEW);
            const canFinanceApprove =
              (isSuperAdmin || isAccountant || hasAction('requisitions:finance_approve')) &&
              req.status === RequisitionStatus.ADMIN_APPROVED;
            const canDecline =
              (isSuperAdmin || hasAction('requisitions:decline')) &&
              (req.status === RequisitionStatus.PENDING ||
               req.status === RequisitionStatus.UNDER_REVIEW ||
               req.status === RequisitionStatus.ADMIN_APPROVED);

            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'bg-white rounded-2xl border shadow-sm p-5',
                  canMarkUnderReview || canAdminApprove || canFinanceApprove
                    ? 'border-church-blue/20'
                    : 'border-church-blue/5',
                )}
              >
                {/* Top row */}
                <div className="flex flex-wrap items-start gap-3 justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-church-black">
                        {req.itemName ?? req.items ?? 'Unnamed item'}
                      </p>
                      <StatusBadge status={req.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-church-gray flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {req.requestedBy}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" /> {req.department}
                      </span>
                      {req.createdAt?.toDate && (
                        <span>{formatDate(req.createdAt.toDate().toISOString())}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-church-black text-lg">{formatCurrency(amount)}</p>
                    {req.quantity && (
                      <p className="text-xs text-church-gray">Qty: {req.quantity}</p>
                    )}
                  </div>
                </div>

                {/* Purpose */}
                {req.purpose && (
                  <p className="text-sm text-church-gray mb-3 italic">"{req.purpose}"</p>
                )}

                {/* Items list (if multi-item requisition) */}
                {req.itemsList && req.itemsList.length > 0 && (
                  <div className="bg-church-soft rounded-xl overflow-hidden mb-3">
                    <div className="grid grid-cols-12 gap-2 px-3 py-1.5 border-b border-gray-100">
                      <div className="col-span-6 text-[9px] font-black uppercase tracking-wider text-church-gray">Item</div>
                      <div className="col-span-2 text-[9px] font-black uppercase tracking-wider text-church-gray text-center">Qty</div>
                      <div className="col-span-2 text-[9px] font-black uppercase tracking-wider text-church-gray text-right">Unit</div>
                      <div className="col-span-2 text-[9px] font-black uppercase tracking-wider text-church-gray text-right">Total</div>
                    </div>
                    {req.itemsList.map((it, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-gray-50 last:border-0">
                        <div className="col-span-6 text-xs font-medium text-church-black truncate">{it.name}</div>
                        <div className="col-span-2 text-xs text-church-gray text-center">{it.quantity}</div>
                        <div className="col-span-2 text-xs text-church-gray text-right">{formatCurrency(it.unitCost)}</div>
                        <div className="col-span-2 text-xs font-bold text-church-black text-right">{formatCurrency(it.total)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Decline reason */}
                {req.status === RequisitionStatus.DECLINED && req.declineReason && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">
                      <span className="font-bold">Declined by {req.declinedByName}</span>
                      {req.declineReason ? `: ${req.declineReason}` : ''}
                    </p>
                  </div>
                )}

                {/* Approval pipeline */}
                <ApprovalPipeline req={req} />

                {/* Action buttons */}
                {(canMarkUnderReview || canAdminApprove || canFinanceApprove || canDecline) && (
                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-50 flex-wrap">
                    {canMarkUnderReview && (
                      <button
                        onClick={() => handleMarkUnderReview(req)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-yellow-50 text-church-yellow border border-yellow-400 rounded-xl text-xs font-bold hover:bg-yellow-100 transition disabled:opacity-60"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                        Mark Under Review
                      </button>
                    )}
                    {canAdminApprove && (
                      <button
                        onClick={() => handleAdminApprove(req)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-church-blue text-white rounded-xl text-xs font-bold hover:bg-church-blue/90 transition disabled:opacity-60"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Admin Approve
                      </button>
                    )}
                    {canFinanceApprove && (
                      <button
                        onClick={() => handleFinanceApprove(req)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-60"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Final Approve + Record Expense
                      </button>
                    )}
                    {canDecline && (
                      <button
                        onClick={() => handleDecline(req)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition disabled:opacity-60"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Decline
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Add form modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[92vh]"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-display font-black text-church-black">New Requisition</h3>
                  <p className="text-xs text-church-gray mt-0.5">Add all items you need in one request</p>
                </div>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-2 bg-church-soft rounded-xl text-church-gray hover:text-church-blue transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-7 py-5 space-y-5">
                {/* Department + Purpose */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-church-gray mb-1.5">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={newReq.department}
                      onChange={e => setNewReq(p => ({ ...p, department: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                    >
                      <option value="">Select department…</option>
                      {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-church-gray mb-1.5">Purpose / Justification</label>
                    <input
                      value={newReq.purpose}
                      onChange={e => setNewReq(p => ({ ...p, purpose: e.target.value }))}
                      placeholder="Why are these items needed?"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                    />
                  </div>
                </div>

                {/* Items list */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-church-gray">
                      Items <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-church-gray">{newReq.itemsList.length} item{newReq.itemsList.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-12 gap-2 mb-1 px-1">
                    <div className="col-span-5 text-[9px] font-black uppercase tracking-wider text-church-gray">Item Name</div>
                    <div className="col-span-2 text-[9px] font-black uppercase tracking-wider text-church-gray">Qty</div>
                    <div className="col-span-3 text-[9px] font-black uppercase tracking-wider text-church-gray">Unit Cost</div>
                    <div className="col-span-2 text-[9px] font-black uppercase tracking-wider text-church-gray text-right">Total</div>
                  </div>

                  <div className="space-y-2">
                    {newReq.itemsList.map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="grid grid-cols-12 gap-2 items-center bg-church-soft rounded-xl p-2"
                      >
                        {/* Name */}
                        <div className="col-span-5">
                          <input
                            required
                            placeholder="e.g. A4 Paper"
                            value={item.name}
                            onChange={e => updateItem(idx, 'name', e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                          />
                        </div>
                        {/* Qty */}
                        <div className="col-span-2">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                          />
                        </div>
                        {/* Unit cost */}
                        <div className="col-span-3">
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={item.unitCost || ''}
                            onChange={e => updateItem(idx, 'unitCost', Number(e.target.value))}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                          />
                        </div>
                        {/* Row total */}
                        <div className="col-span-1 text-right">
                          <p className="text-xs font-bold text-church-black">
                            {item.total > 0 ? (item.total / 1000).toFixed(0) + 'K' : '—'}
                          </p>
                        </div>
                        {/* Delete */}
                        <div className="col-span-1 flex justify-end">
                          {newReq.itemsList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addItem}
                    className="mt-3 flex items-center gap-2 text-church-blue text-sm font-bold hover:bg-church-blue/5 px-3 py-2 rounded-xl transition w-full"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Item
                  </button>
                </div>

                {/* Grand total */}
                <div className="flex items-center justify-between bg-church-blue/5 border border-church-blue/15 rounded-xl px-5 py-3">
                  <span className="text-sm font-bold text-church-black">Grand Total</span>
                  <span className="text-lg font-black text-church-blue">{formatCurrency(reqGrandTotal)}</span>
                </div>

                {/* Approval flow info */}
                <div className="bg-yellow-50 border border-yellow-400 rounded-xl px-4 py-3 text-xs text-church-yellow">
                  <strong>Approval flow:</strong> Your request → Admin Review → Accountant Final Approval → Expense recorded
                </div>
              </div>

              {/* Modal footer */}
              <div className="px-7 py-5 border-t border-gray-100">
                <button
                  onClick={async () => {
                    if (!user) return;
                    if (!newReq.department) { alert('Please select a department.'); return; }
                    if (newReq.itemsList.some(i => !i.name.trim())) { alert('Please fill in a name for every item.'); return; }
                    const canSubmit = isAdmin || user.role === UserRole.DEPARTMENT_HEAD;
                    if (!canSubmit) { alert('Only Department Heads can submit requisitions.'); return; }
                    try {
                      await addDoc(collection(db, 'churches', churchId!, 'requisitions'), {
                        churchId: churchId!,
                        department: empRecord?.department || newReq.department,
                        purpose: newReq.purpose,
                        itemsList: newReq.itemsList,
                        itemName: newReq.itemsList.map(i => i.name).join(', '),
                        total: reqGrandTotal,
                        estimatedCost: reqGrandTotal,
                        requestedBy: user.displayName,
                        requesterId: user.uid,
                        status: RequisitionStatus.PENDING,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                      });
                      setShowAddForm(false);
                      setNewReq({ department: '', purpose: '', itemsList: [blankItem()] });
                      alert('Requisition submitted. Awaiting admin review.');
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, 'requisitions');
                    }
                  }}
                  disabled={!newReq.department || newReq.itemsList.some(i => !i.name.trim())}
                  className="w-full bg-church-blue disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 font-bold text-sm hover:bg-church-blue/90 transition"
                >
                  Submit Requisition ({newReq.itemsList.length} item{newReq.itemsList.length !== 1 ? 's' : ''} · {formatCurrency(reqGrandTotal)})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
