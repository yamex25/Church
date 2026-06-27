import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Plus, Trash2, Package, User, Building, ShieldX,
  Clock, CheckCircle, XCircle, ShieldCheck, Loader2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import {
  collection, addDoc, query, where, orderBy, onSnapshot,
  serverTimestamp, getDocs,
} from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { RequisitionItem, RequisitionStatus } from '@/src/types';
import { cn, formatCurrency, formatDate } from '@/src/lib/utils';

// ─── Status display ───────────────────────────────────────────────────────────

const STATUS_DISPLAY: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  [RequisitionStatus.PENDING]: {
    label: 'Awaiting Admin', color: 'bg-yellow-50 text-church-yellow border-yellow-400', icon: Clock,
  },
  [RequisitionStatus.ADMIN_APPROVED]: {
    label: 'Admin Approved', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: ShieldCheck,
  },
  [RequisitionStatus.APPROVED]: {
    label: 'Fully Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle,
  },
  [RequisitionStatus.DECLINED]: {
    label: 'Declined', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalRequisitions() {
  const { user, churchId, isDeptHead } = useAuth();

  if (!isDeptHead) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <ShieldX className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-church-black mb-2">Access Restricted</h2>
        <p className="text-church-gray text-sm max-w-xs">
          Only employees appointed as <strong>Department Heads</strong> can access Requisitions.
          Contact your church admin if you believe this is an error.
        </p>
      </div>
    );
  }

  const [showForm, setShowForm] = useState(false);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [department, setDepartment] = useState('');
  const [purpose, setPurpose] = useState('');

  const blankItem = (): RequisitionItem => ({ name: '', quantity: 1, unitCost: 0, total: 0 });
  const [itemsList, setItemsList] = useState<RequisitionItem[]>([blankItem()]);

  const updateItem = (idx: number, field: keyof RequisitionItem, val: string | number) => {
    setItemsList(prev => {
      const list = [...prev];
      const item = { ...list[idx], [field]: val };
      item.total = Number(item.quantity) * Number(item.unitCost);
      list[idx] = item;
      return list;
    });
  };
  const addItem = () => setItemsList(p => [...p, blankItem()]);
  const removeItem = (idx: number) => setItemsList(p => p.filter((_, i) => i !== idx));
  const grandTotal = itemsList.reduce((s, i) => s + i.total, 0);

  // Load my own requisitions
  useEffect(() => {
    if (!user || !churchId) return;
    return onSnapshot(
      query(
        collection(db, 'churches', churchId, 'requisitions'),
        where('requesterId', '==', user.uid),
        orderBy('createdAt', 'desc'),
      ),
      snap => {
        setRequisitions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'requisitions'),
    );
  }, [user, churchId]);

  // Auto-detect department from employee record
  useEffect(() => {
    if (!user?.email || !churchId) return;
    getDocs(query(
      collection(db, 'churches', churchId, 'employees'),
      where('email', '==', user.email),
    )).then(snap => {
      if (!snap.empty) setDepartment(snap.docs[0].data().department || '');
    });
  }, [user?.email, churchId]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!department) { alert('Department not detected. Contact your admin.'); return; }
    if (itemsList.some(i => !i.name.trim())) { alert('Please fill in a name for every item.'); return; }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'churches', churchId!, 'requisitions'), {
        churchId,
        requestedBy: user.displayName,
        requesterId: user.uid,
        department,
        purpose,
        itemsList,
        itemName: itemsList.map(i => i.name).join(', '),
        total: grandTotal,
        estimatedCost: grandTotal,
        status: RequisitionStatus.PENDING,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowForm(false);
      setItemsList([blankItem()]);
      setPurpose('');
      alert('Requisition submitted successfully. Awaiting admin review.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'requisitions');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-church-black max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-black">Requisitions</h2>
          <p className="text-xs text-church-gray mt-0.5">Department: <strong>{department || '—'}</strong></p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-church-blue text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        )}
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-white rounded-3xl border border-church-blue/10 shadow-xl overflow-hidden"
          >
            {/* Form header */}
            <div className="bg-church-blue px-6 py-4">
              <h3 className="text-white font-bold text-lg">New Requisition</h3>
              <p className="text-blue-200 text-xs mt-0.5">Add all items you need in this single request</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Department (read-only) + Purpose */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-church-gray mb-1.5">Department</label>
                  <div className="flex items-center gap-2 bg-church-soft border border-gray-200 rounded-xl px-3 py-2.5">
                    <Building className="w-4 h-4 text-church-blue flex-shrink-0" />
                    <span className="text-sm font-semibold text-church-black">{department || 'Not detected'}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-church-gray mb-1.5">Purpose</label>
                  <input
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    placeholder="Why are these items needed?"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-church-gray">
                    Items <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-church-gray">{itemsList.length} item{itemsList.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-12 gap-2 mb-1 px-1">
                  <div className="col-span-5 text-[9px] font-black uppercase tracking-wider text-church-gray">Item Name</div>
                  <div className="col-span-2 text-[9px] font-black uppercase tracking-wider text-church-gray text-center">Qty</div>
                  <div className="col-span-3 text-[9px] font-black uppercase tracking-wider text-church-gray">Unit Cost</div>
                  <div className="col-span-2 text-[9px] font-black uppercase tracking-wider text-church-gray text-right">Total</div>
                </div>

                <div className="space-y-2">
                  {itemsList.map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="grid grid-cols-12 gap-2 items-center bg-church-soft rounded-xl p-2"
                    >
                      <div className="col-span-5">
                        <input
                          required
                          placeholder="Item name"
                          value={item.name}
                          onChange={e => updateItem(idx, 'name', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number" min={1}
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number" min={0} placeholder="0"
                          value={item.unitCost || ''}
                          onChange={e => updateItem(idx, 'unitCost', Number(e.target.value))}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <p className="text-xs font-bold text-church-black">
                          {item.total > 0 ? (item.total / 1000).toFixed(0) + 'K' : '—'}
                        </p>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {itemsList.length > 1 && (
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
                <span className="text-lg font-black text-church-blue">{formatCurrency(grandTotal)}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || itemsList.some(i => !i.name.trim())}
                  className="flex-1 bg-church-blue text-white py-3 rounded-xl font-bold text-sm hover:bg-church-blue/90 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : `Submit (${formatCurrency(grandTotal)})`}
                </button>
                <button
                  onClick={() => { setShowForm(false); setItemsList([blankItem()]); }}
                  className="px-5 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* My requisitions list */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-7 h-7 animate-spin text-church-blue" />
        </div>
      ) : requisitions.length === 0 ? (
        <div className="text-center py-14">
          <FileText className="w-10 h-10 text-church-gray/30 mx-auto mb-3" />
          <p className="text-church-gray font-medium">No requisitions yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requisitions.map((req: any) => {
            const meta = STATUS_DISPLAY[req.status] ?? STATUS_DISPLAY[RequisitionStatus.PENDING];
            const StatusIcon = meta.icon;
            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-church-blue/8 shadow-sm p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-church-black truncate">
                      {req.itemName ?? req.items ?? 'Requisition'}
                    </p>
                    <p className="text-xs text-church-gray mt-0.5">
                      {req.department} {req.purpose ? `· ${req.purpose}` : ''}
                    </p>
                  </div>
                  <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border flex-shrink-0', meta.color)}>
                    <StatusIcon className="w-3 h-3" />
                    {meta.label}
                  </span>
                </div>

                {/* Items list */}
                {req.itemsList && req.itemsList.length > 0 && (
                  <div className="bg-church-soft rounded-xl overflow-hidden mb-3">
                    {req.itemsList.map((it: RequisitionItem, i: number) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-2">
                          <Package className="w-3 h-3 text-church-gray flex-shrink-0" />
                          <span className="text-xs text-church-black">{it.name}</span>
                          <span className="text-[10px] text-church-gray">×{it.quantity}</span>
                        </div>
                        <span className="text-xs font-bold text-church-black">{formatCurrency(it.total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-xs text-church-gray">
                    {req.createdAt?.toDate ? formatDate(req.createdAt.toDate().toISOString()) : ''}
                  </p>
                  <p className="font-black text-church-blue">{formatCurrency(req.total ?? req.estimatedCost ?? 0)}</p>
                </div>

                {req.status === RequisitionStatus.DECLINED && req.declineReason && (
                  <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Declined: {req.declineReason}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
