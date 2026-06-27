import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Crown,
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  MapPin,
  Hash,
  Users,
  Calendar,
  ShieldOff,
  ShieldCheck,
  Loader2,
  RotateCcw,
  Pencil,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Clock,
  X,
  CreditCard,
  CalendarDays,
  BadgeCheck,
  LayoutGrid,
  Check,
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  setDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Church, SUBSCRIPTION_PLANS, SUBSCRIPTION_DURATIONS } from '@/src/types';
import { MODULE_DEFS, ALL_MODULE_IDS, DEFAULT_PLAN_MODULES } from '@/src/lib/permissions';
import { cn } from '@/src/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChurchWithMemberCount extends Church {
  memberCount: number;
  memberCountLoading: boolean;
}

interface EditForm {
  name: string;
  address: string;
  phone: string;
  email: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionStartDate: string;
  subscriptionExpiryDate: string;
}

interface ToastState {
  id: string;
  message: string;
  type: 'success' | 'error';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getDaysRemaining(expiryDateStr: string | undefined): number | null {
  if (!expiryDateStr) return null;
  try {
    const expiry = new Date(expiryDateStr);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function addMonthsToDate(baseDate: string | undefined, months: number): string {
  const d = baseDate ? new Date(baseDate) : new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function isExpiringSoon(expiryDateStr: string | undefined): boolean {
  const days = getDaysRemaining(expiryDateStr);
  return days !== null && days >= 0 && days <= 30;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: (id: string) => void }) {
  return (
    <motion.div
      key={toast.id}
      initial={{ opacity: 0, x: 64 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 64 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className={cn(
        'flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl font-semibold text-sm min-w-[240px]',
        toast.type === 'success'
          ? 'bg-emerald-500 text-white'
          : 'bg-red-500 text-white',
      )}
    >
      {toast.type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
      ) : (
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
      )}
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading: boolean;
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor, loading }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-church-blue/5 flex items-center gap-5">
      <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
        <Icon className={cn('w-7 h-7', iconColor)} />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-church-gray mb-1">{label}</p>
        {loading ? (
          <div className="h-8 w-16 bg-church-soft rounded-lg animate-pulse" />
        ) : (
          <p className="text-3xl font-black text-church-black leading-none">{value}</p>
        )}
      </div>
    </div>
  );
}

// ── Subscription Badge ─────────────────────────────────────────────────────────

function SubscriptionSection({ church }: { church: ChurchWithMemberCount }) {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === church.subscriptionPlan);
  const daysLeft = getDaysRemaining(church.subscriptionExpiryDate);
  const hasSubscription = !!church.subscriptionPlan;

  let daysLabel = '';
  let daysColor = 'text-emerald-400';
  if (daysLeft !== null) {
    if (daysLeft < 0) {
      daysLabel = `EXPIRED ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago`;
      daysColor = 'text-red-400';
    } else if (daysLeft <= 10) {
      daysLabel = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
      daysColor = 'text-red-400';
    } else if (daysLeft <= 30) {
      daysLabel = `${daysLeft} days left`;
      daysColor = 'text-church-yellow';
    } else {
      daysLabel = `${daysLeft} days left`;
      daysColor = 'text-emerald-400';
    }
  }

  const subStatusStyles: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    expired: 'bg-red-500/20 text-red-300 border-red-500/30',
    suspended: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  };
  const subStatusStyle = church.subscriptionStatus
    ? subStatusStyles[church.subscriptionStatus] ?? 'bg-white/10 text-white/60 border-white/10'
    : 'bg-white/10 text-white/60 border-white/10';

  return (
    <div className="rounded-xl bg-church-blue px-4 py-3.5 space-y-2.5">
      {!hasSubscription ? (
        <p className="text-xs font-semibold text-white/50 flex items-center gap-2">
          <CreditCard className="w-3.5 h-3.5" />
          No active subscription
        </p>
      ) : (
        <>
          {/* Plan + status badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            {plan && (
              <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border', plan.badge)}>
                <BadgeCheck className="w-3 h-3" />
                {plan.name}
              </span>
            )}
            {church.subscriptionStatus && (
              <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border', subStatusStyle)}>
                {church.subscriptionStatus === 'active' && <CheckCircle2 className="w-3 h-3" />}
                {church.subscriptionStatus === 'expired' && <XCircle className="w-3 h-3" />}
                {church.subscriptionStatus === 'suspended' && <AlertTriangle className="w-3 h-3" />}
                {church.subscriptionStatus}
              </span>
            )}
          </div>

          {/* Dates */}
          <div className="flex items-center gap-4 flex-wrap">
            {church.subscriptionStartDate && (
              <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                <CalendarDays className="w-3 h-3 text-white/40" />
                <span>Start: <span className="text-white/80 font-semibold">{formatDate(church.subscriptionStartDate)}</span></span>
              </div>
            )}
            {church.subscriptionExpiryDate && (
              <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                <Clock className="w-3 h-3 text-white/40" />
                <span>Expires: <span className="text-white/80 font-semibold">{formatDate(church.subscriptionExpiryDate)}</span></span>
              </div>
            )}
          </div>

          {/* Days remaining */}
          {daysLabel && (
            <p className={cn('text-xs font-black uppercase tracking-widest', daysColor)}>
              {daysLabel}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Church Card ────────────────────────────────────────────────────────────────

interface ChurchCardProps {
  church: ChurchWithMemberCount;
  onSuspend: (id: string) => Promise<void>;
  onActivate: (id: string) => Promise<void>;
  onResetPermissions: (church: ChurchWithMemberCount) => Promise<void>;
  onEdit: (church: ChurchWithMemberCount) => void;
  onDelete: (church: ChurchWithMemberCount) => void;
  onRenew: (church: ChurchWithMemberCount) => void;
  onManageAccess: (church: ChurchWithMemberCount) => void;
  onChangePlan: (church: ChurchWithMemberCount) => void;
  actionLoading: string | null;
  resetLoading: string | null;
}

function ChurchCard({
  church,
  onSuspend,
  onActivate,
  onResetPermissions,
  onEdit,
  onDelete,
  onRenew,
  onManageAccess,
  onChangePlan,
  actionLoading,
  resetLoading,
}: ChurchCardProps) {
  const isActive = !church.status || church.status === 'active';
  const isBusy = actionLoading === church.id;
  const isResetting = resetLoading === church.id;
  const hasSubscription = !!church.subscriptionPlan;

  // Stripe color
  let stripeClass = 'bg-emerald-400';
  if (!isActive) stripeClass = 'bg-red-400';
  else if (!hasSubscription) stripeClass = 'bg-church-gray/30';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className={cn(
        'bg-white rounded-2xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md flex flex-col',
        isActive ? 'border-church-blue/8' : 'border-red-200',
      )}
    >
      {/* Status stripe */}
      <div className={cn('h-1.5 w-full flex-shrink-0', stripeClass)} />

      <div className="p-5 flex flex-col flex-1 gap-4">
        {/* Top row: name + status badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-church-black leading-tight truncate">
              {church.name}
            </h3>
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-church-soft rounded-lg text-[10px] font-black uppercase tracking-widest text-church-gray border border-church-blue/10">
              <Hash className="w-3 h-3" />
              {church.churchCode}
            </span>
          </div>
          <span className={cn(
            'flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider',
            isActive
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-600 border border-red-200',
          )}>
            {isActive
              ? <><CheckCircle2 className="w-3 h-3" /> Active</>
              : <><XCircle className="w-3 h-3" /> Suspended</>}
          </span>
        </div>

        {/* Meta details */}
        <div className="space-y-2">
          {church.address && (
            <div className="flex items-start gap-2 text-xs text-church-gray">
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-church-blue/40" />
              <span className="line-clamp-2">{church.address}</span>
            </div>
          )}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-church-gray">
              <Users className="w-3.5 h-3.5 text-church-blue/40" />
              {church.memberCountLoading ? (
                <span className="inline-block w-8 h-3.5 bg-church-soft rounded animate-pulse" />
              ) : (
                <span>
                  <span className="font-bold text-church-black">{church.memberCount}</span>{' '}
                  member{church.memberCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-church-gray">
              <Calendar className="w-3.5 h-3.5 text-church-blue/40" />
              <span>Created {formatDate(church.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Subscription section */}
        <SubscriptionSection church={church} />

        {/* Renew + Manage Access buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onChangePlan(church)}
            className="flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide bg-church-yellow/15 text-church-yellow hover:bg-church-yellow/25 border border-church-yellow/30 active:scale-95 transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Change Plan
          </button>
          {hasSubscription && (
            <button
              onClick={() => onRenew(church)}
              className="flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 active:scale-95 transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              Renew
            </button>
          )}
          <button
            onClick={() => onManageAccess(church)}
            className="flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide bg-church-blue/10 text-church-blue hover:bg-church-blue/20 border border-church-blue/20 active:scale-95 transition-all col-span-1"
          >
            <LayoutGrid className="w-3 h-3" />
            Modules
          </button>
        </div>

        {/* Action buttons */}
        <div className="pt-3 border-t border-church-soft space-y-2 mt-auto">
          {/* Reset permissions */}
          <button
            disabled={isResetting}
            onClick={() => onResetPermissions(church)}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
              isResetting
                ? 'bg-church-soft text-church-gray cursor-not-allowed'
                : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 active:scale-95',
            )}
            title="Restore full module access to the church's Super Admin"
          >
            {isResetting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RotateCcw className="w-3.5 h-3.5" />}
            Reset Permissions
          </button>

          {/* 3-button row: Suspend/Restore · Edit · Delete */}
          <div className="grid grid-cols-3 gap-2">
            {/* Suspend / Restore */}
            {isActive ? (
              <button
                disabled={isBusy}
                onClick={() => onSuspend(church.id)}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
                  isBusy
                    ? 'bg-church-soft text-church-gray cursor-not-allowed'
                    : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 active:scale-95',
                )}
                title="Suspend church"
              >
                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Suspend</span>
              </button>
            ) : (
              <button
                disabled={isBusy}
                onClick={() => onActivate(church.id)}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
                  isBusy
                    ? 'bg-church-soft text-church-gray cursor-not-allowed'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 active:scale-95',
                )}
                title="Restore church"
              >
                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Restore</span>
              </button>
            )}

            {/* Edit */}
            <button
              onClick={() => onEdit(church)}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-church-blue/8 text-church-blue hover:bg-church-blue/15 border border-church-blue/15 active:scale-95 transition-all"
              title="Edit church"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </button>

            {/* Delete */}
            <button
              onClick={() => onDelete(church)}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 active:scale-95 transition-all"
              title="Delete church"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────

interface EditModalProps {
  church: ChurchWithMemberCount;
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ church, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState<EditForm>({
    name: church.name ?? '',
    address: church.address ?? '',
    phone: church.phone ?? '',
    email: church.email ?? '',
    subscriptionPlan: church.subscriptionPlan ?? '',
    subscriptionStatus: church.subscriptionStatus ?? '',
    subscriptionStartDate: church.subscriptionStartDate?.slice(0, 10) ?? '',
    subscriptionExpiryDate: church.subscriptionExpiryDate?.slice(0, 10) ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof EditForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Church name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'churches', church.id), {
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        ...(form.subscriptionPlan && { subscriptionPlan: form.subscriptionPlan }),
        ...(form.subscriptionStatus && { subscriptionStatus: form.subscriptionStatus }),
        ...(form.subscriptionStartDate && { subscriptionStartDate: form.subscriptionStartDate }),
        ...(form.subscriptionExpiryDate && { subscriptionExpiryDate: form.subscriptionExpiryDate }),
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to update church:', err);
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="bg-church-blue px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Pencil className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">Editing</p>
              <h2 className="text-base font-black text-white leading-tight truncate max-w-[260px]">{church.name}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Basic info */}
          <p className="text-xs font-black uppercase tracking-widest text-church-gray">Church Info</p>

          <div className="space-y-3">
            {([
              { label: 'Church Name', field: 'name', type: 'text', required: true },
              { label: 'Address', field: 'address', type: 'text' },
              { label: 'Phone', field: 'phone', type: 'tel' },
              { label: 'Email', field: 'email', type: 'email' },
            ] as { label: string; field: keyof EditForm; type: string; required?: boolean }[]).map(({ label, field, type, required }) => (
              <div key={field}>
                <label className="block text-xs font-bold text-church-gray mb-1.5">
                  {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <input
                  type={type}
                  value={form[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-church-blue/15 bg-church-soft/50 text-sm text-church-black placeholder:text-church-gray/50 focus:outline-none focus:ring-2 focus:ring-church-blue/25 focus:border-church-blue/30 transition-all"
                />
              </div>
            ))}
          </div>

          {/* Subscription */}
          <p className="text-xs font-black uppercase tracking-widest text-church-gray pt-2">Subscription</p>

          <div className="space-y-3">
            {/* Plan dropdown */}
            <div>
              <label className="block text-xs font-bold text-church-gray mb-1.5">Plan</label>
              <select
                value={form.subscriptionPlan}
                onChange={(e) => handleChange('subscriptionPlan', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-church-blue/15 bg-church-soft/50 text-sm text-church-black focus:outline-none focus:ring-2 focus:ring-church-blue/25 focus:border-church-blue/30 transition-all appearance-none"
              >
                <option value="">— No Plan —</option>
                {SUBSCRIPTION_PLANS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.priceLabel}</option>
                ))}
              </select>
            </div>

            {/* Status dropdown */}
            <div>
              <label className="block text-xs font-bold text-church-gray mb-1.5">Subscription Status</label>
              <select
                value={form.subscriptionStatus}
                onChange={(e) => handleChange('subscriptionStatus', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-church-blue/15 bg-church-soft/50 text-sm text-church-black focus:outline-none focus:ring-2 focus:ring-church-blue/25 focus:border-church-blue/30 transition-all appearance-none"
              >
                <option value="">— Not Set —</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-church-gray mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={form.subscriptionStartDate}
                  onChange={(e) => handleChange('subscriptionStartDate', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-church-blue/15 bg-church-soft/50 text-sm text-church-black focus:outline-none focus:ring-2 focus:ring-church-blue/25 focus:border-church-blue/30 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-church-gray mb-1.5">Expiry Date</label>
                <input
                  type="date"
                  value={form.subscriptionExpiryDate}
                  onChange={(e) => handleChange('subscriptionExpiryDate', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-church-blue/15 bg-church-soft/50 text-sm text-church-black focus:outline-none focus:ring-2 focus:ring-church-blue/25 focus:border-church-blue/30 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-church-soft flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-church-gray hover:bg-church-soft border border-church-blue/10 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-white transition-all',
              saving
                ? 'bg-church-blue/50 cursor-not-allowed'
                : 'bg-church-blue hover:bg-church-blue/90 active:scale-95',
            )}
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Renew Modal ────────────────────────────────────────────────────────────────

interface RenewModalProps {
  church: ChurchWithMemberCount;
  onClose: () => void;
  onRenewed: () => void;
}

function RenewModal({ church, onClose, onRenewed }: RenewModalProps) {
  const [selectedMonths, setSelectedMonths] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === church.subscriptionPlan);

  const newExpiry = addMonthsToDate(
    church.subscriptionExpiryDate && new Date(church.subscriptionExpiryDate) > new Date()
      ? church.subscriptionExpiryDate
      : undefined,
    selectedMonths,
  );

  const handleRenew = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'churches', church.id), {
        subscriptionStatus: 'active',
        subscriptionExpiryDate: newExpiry,
      });
      onRenewed();
      onClose();
    } catch (err) {
      console.error('Failed to renew subscription:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="bg-church-blue px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <RefreshCw className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">Renew Subscription</p>
              <h2 className="text-base font-black text-white leading-tight truncate max-w-[240px]">{church.name}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Current status */}
          <div className="bg-church-soft rounded-xl p-4 space-y-1.5">
            <p className="text-xs font-black uppercase tracking-widest text-church-gray mb-2">Current Subscription</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-church-gray font-medium">Plan</span>
              <span className="font-black text-church-black">{plan?.name ?? church.subscriptionPlan ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-church-gray font-medium">Expires</span>
              <span className="font-black text-church-black">{formatDate(church.subscriptionExpiryDate)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-church-gray font-medium">Status</span>
              <span className={cn(
                'font-black uppercase text-xs tracking-wider',
                church.subscriptionStatus === 'active' ? 'text-emerald-600' :
                church.subscriptionStatus === 'expired' ? 'text-red-600' : 'text-yellow-600',
              )}>
                {church.subscriptionStatus ?? '—'}
              </span>
            </div>
          </div>

          {/* Duration picker */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-church-gray mb-3">Select Duration</p>
            <div className="grid grid-cols-2 gap-2">
              {SUBSCRIPTION_DURATIONS.map(({ months, label }) => (
                <button
                  key={months}
                  onClick={() => setSelectedMonths(months)}
                  className={cn(
                    'py-3 rounded-xl text-sm font-black uppercase tracking-widest border transition-all active:scale-95',
                    selectedMonths === months
                      ? 'bg-church-blue text-white border-church-blue shadow-md'
                      : 'bg-church-soft text-church-gray border-church-blue/10 hover:border-church-blue/30 hover:text-church-black',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* New expiry preview */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-0.5">New Expiry Date</p>
              <p className="text-lg font-black text-emerald-800">{formatDate(newExpiry)}</p>
            </div>
            <CalendarDays className="w-8 h-8 text-emerald-400" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-church-soft flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-church-gray hover:bg-church-soft border border-church-blue/10 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleRenew}
            disabled={saving}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-white transition-all',
              saving
                ? 'bg-emerald-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95',
            )}
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <RefreshCw className="w-3.5 h-3.5" />
            Renew
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────

interface DeleteModalProps {
  church: ChurchWithMemberCount;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteModal({ church, onClose, onDeleted }: DeleteModalProps) {
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = confirmName.trim() === church.name.trim();

  const handleDelete = async () => {
    if (!matches) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'churches', church.id));
      onDeleted();
      onClose();
    } catch (err) {
      console.error('Failed to delete church:', err);
      setError('Delete failed. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="bg-red-600 px-6 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/60">Danger Zone</p>
            <h2 className="text-base font-black text-white">Delete Church</h2>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="w-4.5 h-4.5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-semibold leading-snug">
              This will permanently delete <span className="font-black">"{church.name}"</span> and all associated data. This action cannot be undone.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Confirmation input */}
          <div>
            <label className="block text-xs font-bold text-church-gray mb-2">
              Type <span className="text-church-black font-black">"{church.name}"</span> to confirm
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={church.name}
              className={cn(
                'w-full px-4 py-2.5 rounded-xl border text-sm text-church-black placeholder:text-church-gray/40 focus:outline-none focus:ring-2 transition-all',
                matches
                  ? 'border-red-400 bg-red-50 focus:ring-red-200'
                  : 'border-church-blue/15 bg-church-soft/50 focus:ring-church-blue/20 focus:border-church-blue/30',
              )}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-church-soft flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-church-gray hover:bg-church-soft border border-church-blue/10 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!matches || deleting}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-white transition-all',
              !matches || deleting
                ? 'bg-red-300 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 active:scale-95',
            )}
          >
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <Trash2 className="w-3.5 h-3.5" />
            Delete Permanently
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PlatformDashboard() {
  const [churches, setChurches] = useState<ChurchWithMemberCount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);

  // Modals
  const [editingChurch, setEditingChurch] = useState<ChurchWithMemberCount | null>(null);
  const [deletingChurch, setDeletingChurch] = useState<ChurchWithMemberCount | null>(null);
  const [renewingChurch, setRenewingChurch] = useState<ChurchWithMemberCount | null>(null);
  // Access override modal
  const [accessChurch, setAccessChurch] = useState<ChurchWithMemberCount | null>(null);
  const [accessAddModules, setAccessAddModules]    = useState<string[]>([]);
  const [accessRemoveModules, setAccessRemoveModules] = useState<string[]>([]);
  const [planModulesCache, setPlanModulesCache]    = useState<string[]>([]);
  const [savingAccess, setSavingAccess]            = useState(false);

  // Change Plan modal
  const [changePlanChurch, setChangePlanChurch]    = useState<ChurchWithMemberCount | null>(null);
  const [newPlanId, setNewPlanId]                  = useState('standard');
  const [changeDuration, setChangeDuration]        = useState(6);
  const [savingPlanChange, setSavingPlanChange]    = useState(false);

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Load member counts ─────────────────────────────────────────────────────
  const loadMemberCount = async (churchId: string): Promise<number> => {
    try {
      const snap = await getDocs(collection(db, 'churches', churchId, 'members'));
      return snap.size;
    } catch {
      return 0;
    }
  };

  // ── Real-time listener for churches ───────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'churches'),
      async (snapshot) => {
        const raw: ChurchWithMemberCount[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Church, 'id'>),
          memberCount: 0,
          memberCountLoading: true,
        }));

        setChurches(raw);
        setLoading(false);

        for (const church of raw) {
          loadMemberCount(church.id).then((count) => {
            setChurches((prev) =>
              prev.map((c) =>
                c.id === church.id
                  ? { ...c, memberCount: count, memberCountLoading: false }
                  : c,
              ),
            );
          });
        }
      },
      (error) => {
        console.error('Failed to load churches:', error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSuspend = async (churchId: string): Promise<void> => {
    if (!window.confirm('Suspend this church? Members will lose access.')) return;
    setActionLoading(churchId);
    try {
      await updateDoc(doc(db, 'churches', churchId), { status: 'suspended' });
    } catch (error) {
      console.error('Failed to suspend church:', error);
      showToast('Failed to suspend church.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (churchId: string): Promise<void> => {
    if (!window.confirm('Reactivate this church?')) return;
    setActionLoading(churchId);
    try {
      await updateDoc(doc(db, 'churches', churchId), { status: 'active' });
    } catch (error) {
      console.error('Failed to activate church:', error);
      showToast('Failed to activate church.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Restores full module access to the Super Admin of a church.
   * Uses createdBy (direct UID) and also queries all SUPER_ADMIN users in the church.
   */
  // ── Change Plan handlers ──────────────────────────────────────────────────
  const openChangePlan = (church: ChurchWithMemberCount) => {
    setNewPlanId(church.subscriptionPlan ?? 'standard');
    setChangeDuration(6);
    setChangePlanChurch(church);
  };

  const handleChangePlan = async () => {
    if (!changePlanChurch) return;
    setSavingPlanChange(true);
    try {
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === newPlanId);
      const now = new Date();
      // Calculate new expiry: extend from today (plan change resets the clock)
      const newExpiry = new Date(now);
      newExpiry.setMonth(newExpiry.getMonth() + changeDuration);

      await updateDoc(doc(db, 'churches', changePlanChurch.id), {
        subscriptionPlan: newPlanId,
        subscriptionStatus: 'active',
        subscriptionStartDate: now.toISOString(),
        subscriptionExpiryDate: newExpiry.toISOString(),
      });
      setChangePlanChurch(null);
      showToast(`${changePlanChurch.name} upgraded to ${plan?.name ?? newPlanId} plan.`);
    } catch {
      showToast('Failed to change plan.', 'error');
    } finally {
      setSavingPlanChange(false);
    }
  };

  // ── Manage Access handlers ────────────────────────────────────────────────
  const openManageAccess = async (church: ChurchWithMemberCount) => {
    // Load plan modules for this church's plan
    const planId = church.subscriptionPlan ?? 'standard';
    let planMods: string[] = DEFAULT_PLAN_MODULES[planId] ?? [...ALL_MODULE_IDS];
    try {
      const snap = await import('firebase/firestore').then(({ getDoc, doc }) =>
        getDoc(doc(db, 'subscriptionPlanModules', planId)),
      );
      if (snap.exists()) planMods = snap.data().modules as string[];
    } catch { /* use defaults */ }

    setPlanModulesCache(planMods);
    setAccessAddModules(church.moduleOverrides?.add ?? []);
    setAccessRemoveModules(church.moduleOverrides?.remove ?? []);
    setAccessChurch(church);
  };

  const handleSaveAccess = async () => {
    if (!accessChurch) return;
    setSavingAccess(true);
    try {
      const overrides = accessAddModules.length === 0 && accessRemoveModules.length === 0
        ? null
        : { add: accessAddModules, remove: accessRemoveModules };
      await updateDoc(doc(db, 'churches', accessChurch.id), { moduleOverrides: overrides });
      setAccessChurch(null);
      showToast(`Access overrides saved for ${accessChurch.name}.`);
    } catch (e) {
      showToast('Failed to save access overrides.', 'error');
    } finally {
      setSavingAccess(false);
    }
  };

  const handleResetAccess = async () => {
    if (!accessChurch) return;
    if (!window.confirm(`Reset ${accessChurch.name} to plan defaults? All overrides will be removed.`)) return;
    setSavingAccess(true);
    try {
      await updateDoc(doc(db, 'churches', accessChurch.id), { moduleOverrides: null });
      setAccessChurch(null);
      showToast(`${accessChurch.name} reset to plan defaults.`);
    } catch {
      showToast('Failed to reset access.', 'error');
    } finally {
      setSavingAccess(false);
    }
  };

  const handleResetPermissions = async (church: ChurchWithMemberCount): Promise<void> => {
    if (!window.confirm(
      `Reset Super Admin permissions for "${church.name}"?\n\n` +
      `This will restore FULL module access for the church owner. ` +
      `They will be able to access all modules again immediately.`,
    )) return;

    setResetLoading(church.id);
    try {
      if (church.createdBy) {
        await setDoc(
          doc(db, 'users', church.createdBy),
          {
            allowedModules: null,
            allowedActions: [],
            groupIds: [],
            permissionsResetBy: 'PLATFORM_OWNER',
            permissionsResetAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }

      const usersSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('churchId', '==', church.id),
          where('role', '==', 'SUPER_ADMIN'),
        ),
      );
      for (const userSnap of usersSnap.docs) {
        await setDoc(
          userSnap.ref,
          {
            allowedModules: null,
            allowedActions: [],
            groupIds: [],
            permissionsResetBy: 'PLATFORM_OWNER',
            permissionsResetAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }

      showToast('Permissions restored', 'success');
    } catch (error) {
      console.error('Failed to reset permissions:', error);
      showToast('Failed to reset permissions.', 'error');
    } finally {
      setResetLoading(null);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalChurches = churches.length;
  const activeChurches = churches.filter((c) => !c.status || c.status === 'active').length;
  const suspendedChurches = churches.filter((c) => c.status === 'suspended').length;
  const expiringSoon = churches.filter((c) => isExpiringSoon(c.subscriptionExpiryDate)).length;

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filteredChurches = churches.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-8">
        {/* Page heading */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-church-yellow/15 rounded-2xl flex items-center justify-center border border-yellow-400/30 flex-shrink-0">
            <Crown className="w-6 h-6 text-church-yellow" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-black text-church-black tracking-tight leading-none">
              Platform Overview
            </h1>
            <p className="text-sm text-church-gray font-medium mt-1">
              All registered churches on GraceFlow
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Churches"
            value={totalChurches}
            icon={Building2}
            iconBg="bg-church-blue/10"
            iconColor="text-church-blue"
            loading={loading}
          />
          <StatCard
            label="Active"
            value={activeChurches}
            icon={CheckCircle2}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            loading={loading}
          />
          <StatCard
            label="Suspended"
            value={suspendedChurches}
            icon={XCircle}
            iconBg="bg-red-50"
            iconColor="text-red-500"
            loading={loading}
          />
          <StatCard
            label="Expiring Soon"
            value={expiringSoon}
            icon={Clock}
            iconBg="bg-yellow-50"
            iconColor="text-church-yellow"
            loading={loading}
          />
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray pointer-events-none" />
          <input
            type="text"
            placeholder="Search churches by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full pl-11 pr-4 py-3.5 rounded-2xl border border-church-blue/10 bg-white',
              'text-sm text-church-black placeholder:text-church-gray/60',
              'focus:outline-none focus:ring-2 focus:ring-church-blue/20 focus:border-church-blue/30',
              'transition-all shadow-sm',
            )}
          />
        </div>

        {/* Loading spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 text-church-blue/40 animate-spin" />
            <p className="text-sm text-church-gray font-medium">Loading churches…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredChurches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Building2 className="w-12 h-12 text-church-blue/20" />
            <p className="text-base font-bold text-church-gray">
              {searchQuery ? 'No churches match your search.' : 'No churches registered yet.'}
            </p>
          </div>
        )}

        {/* Church cards grid */}
        {!loading && filteredChurches.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <AnimatePresence mode="popLayout">
              {filteredChurches.map((church) => (
                <ChurchCard
                  key={church.id}
                  church={church}
                  onSuspend={handleSuspend}
                  onActivate={handleActivate}
                  onResetPermissions={handleResetPermissions}
                  onEdit={setEditingChurch}
                  onDelete={setDeletingChurch}
                  onRenew={setRenewingChurch}
                  onManageAccess={openManageAccess}
                  onChangePlan={openChangePlan}
                  actionLoading={actionLoading}
                  resetLoading={resetLoading}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editingChurch && (
          <EditModal
            key="edit-modal"
            church={editingChurch}
            onClose={() => setEditingChurch(null)}
            onSaved={() => showToast(`${editingChurch.name} updated successfully.`)}
          />
        )}
        {renewingChurch && (
          <RenewModal
            key="renew-modal"
            church={renewingChurch}
            onClose={() => setRenewingChurch(null)}
            onRenewed={() => showToast(`Subscription renewed for ${renewingChurch.name}.`)}
          />
        )}
        {deletingChurch && (
          <DeleteModal
            key="delete-modal"
            church={deletingChurch}
            onClose={() => setDeletingChurch(null)}
            onDeleted={() => showToast(`${deletingChurch.name} has been deleted.`)}
          />
        )}
      </AnimatePresence>

      {/* ── Change Plan Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {changePlanChurch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="bg-white rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[92vh]"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-church-blue to-church-blue/80 px-7 py-5 rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-display font-black text-white">Change Subscription Plan</h3>
                    <p className="text-blue-200 text-xs mt-0.5">
                      {changePlanChurch.name} · Current: <strong>{changePlanChurch.subscriptionPlan ?? 'None'}</strong>
                    </p>
                  </div>
                  <button onClick={() => setChangePlanChurch(null)} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 px-7 py-5 space-y-5">
                {/* Plan selector */}
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-church-gray mb-3">Select New Plan</p>
                  <div className="grid grid-cols-2 gap-3">
                    {SUBSCRIPTION_PLANS.map(plan => {
                      const active = newPlanId === plan.id;
                      const isCurrent = changePlanChurch.subscriptionPlan === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setNewPlanId(plan.id)}
                          className={cn(
                            'relative text-left rounded-2xl border-2 p-4 transition-all',
                            active
                              ? 'bg-church-blue/5 border-church-blue text-church-blue'
                              : 'bg-white border-gray-200 text-church-gray hover:border-church-blue/30',
                          )}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-black text-sm">{plan.name}</p>
                            <div className="text-right flex-shrink-0 ml-2">
                              <p className={cn('text-xs font-bold', active ? 'text-church-blue' : 'text-church-black')}>{plan.priceLabel}</p>
                              <p className="text-[10px] text-church-gray">{(plan as any).priceUGXLabel}</p>
                            </div>
                          </div>
                          <p className="text-[11px] text-church-gray">{plan.description}</p>
                          {isCurrent && (
                            <span className="absolute top-2 right-2 text-[8px] bg-church-blue text-white px-1.5 py-0.5 rounded-full font-black uppercase">Current</span>
                          )}
                          {active && (
                            <div className="absolute bottom-2 right-2 w-4 h-4 bg-church-blue rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration selector */}
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-church-gray mb-3">Subscription Duration</p>
                  <div className="grid grid-cols-4 gap-2">
                    {SUBSCRIPTION_DURATIONS.map(d => (
                      <button
                        key={d.months}
                        type="button"
                        onClick={() => setChangeDuration(d.months)}
                        className={cn(
                          'py-2.5 rounded-xl text-xs font-black text-center border-2 transition-all',
                          changeDuration === d.months
                            ? 'bg-church-blue text-white border-church-blue'
                            : 'bg-white border-gray-200 text-church-gray hover:border-church-blue/30',
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Billing summary */}
                {(() => {
                  const plan = SUBSCRIPTION_PLANS.find(p => p.id === newPlanId);
                  const totalUGX = ((plan as any)?.priceUGX ?? 0) * changeDuration;
                  const totalUSD = (plan?.price ?? 0) * changeDuration;
                  const newExpiry = new Date();
                  newExpiry.setMonth(newExpiry.getMonth() + changeDuration);
                  return (
                    <div className="bg-church-soft rounded-2xl overflow-hidden border border-church-blue/8">
                      <div className="px-5 py-3 border-b border-gray-100">
                        <p className="text-xs font-black uppercase tracking-wider text-church-gray">Billing Summary</p>
                      </div>
                      <div className="px-5 py-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-church-gray">{plan?.name} × {changeDuration} months</span>
                          <div className="text-right">
                            <p className="font-black text-church-black">UGX {totalUGX.toLocaleString('en-UG')}</p>
                            <p className="text-xs text-church-gray">{totalUSD > 0 ? `$${totalUSD}` : 'Custom'}</p>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                          <span className="text-church-gray">New Expiry Date</span>
                          <span className="font-bold text-church-black">{formatDate(newExpiry.toISOString())}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-church-gray">Starts</span>
                          <span className="font-bold text-church-black">Today</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="px-7 py-5 border-t border-gray-100 flex gap-3">
                <button
                  onClick={handleChangePlan}
                  disabled={savingPlanChange}
                  className="flex-1 bg-church-blue text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-church-blue/90 transition disabled:opacity-60"
                >
                  {savingPlanChange
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><RefreshCw className="w-4 h-4" /> Confirm Plan Change</>}
                </button>
                <button onClick={() => setChangePlanChurch(null)} className="px-5 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition">
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Church Access Override Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {accessChurch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[88vh]"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-church-blue to-church-blue/80 px-7 py-5 rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-display font-black text-white">Manage Module Access</h3>
                    <p className="text-blue-200 text-xs mt-0.5">
                      {accessChurch.name} · Plan: <strong>{accessChurch.subscriptionPlan ?? 'none'}</strong>
                    </p>
                  </div>
                  <button onClick={() => setAccessChurch(null)} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 px-7 py-5 space-y-6">
                {/* Plan baseline */}
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-church-gray mb-3">
                    Plan Baseline ({planModulesCache.length} modules)
                    <span className="ml-2 font-normal normal-case text-church-gray/60">
                      — these come from the subscription plan and cannot be changed here
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {planModulesCache.map(id => {
                      const m = MODULE_DEFS.find(d => d.id === id);
                      const isRemoved = accessRemoveModules.includes(id);
                      return (
                        <span
                          key={id}
                          className={cn('px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
                            isRemoved ? 'bg-red-100 text-red-500 line-through' : 'bg-church-blue/8 text-church-blue')}
                        >
                          {m?.label ?? id}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Remove override — remove modules from the plan */}
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">
                    Remove from Plan (restrict this church)
                  </p>
                  <p className="text-[11px] text-church-gray mb-3">Tick to remove a plan module for this church only.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {planModulesCache.map(id => {
                      const m = MODULE_DEFS.find(d => d.id === id);
                      const removed = accessRemoveModules.includes(id);
                      return (
                        <button key={id} type="button"
                          onClick={() => setAccessRemoveModules(prev =>
                            removed ? prev.filter(x => x !== id) : [...prev, id])}
                          className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold text-left transition-all',
                            removed ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-100 text-church-gray hover:border-red-200')}
                        >
                          <div className={cn('w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0',
                            removed ? 'bg-red-500 border-red-500' : 'border-gray-300')}>
                            {removed && <X className="w-2 h-2 text-white" />}
                          </div>
                          {m?.label ?? id}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Add override — grant extra modules beyond the plan */}
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">
                    Add Extra Modules (grant beyond plan)
                  </p>
                  <p className="text-[11px] text-church-gray mb-3">Tick to grant modules NOT included in this church's plan.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {ALL_MODULE_IDS.filter(id => !planModulesCache.includes(id)).map(id => {
                      const m = MODULE_DEFS.find(d => d.id === id);
                      const added = accessAddModules.includes(id);
                      return (
                        <button key={id} type="button"
                          onClick={() => setAccessAddModules(prev =>
                            added ? prev.filter(x => x !== id) : [...prev, id])}
                          className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold text-left transition-all',
                            added ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-100 text-church-gray hover:border-emerald-200')}
                        >
                          <div className={cn('w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0',
                            added ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300')}>
                            {added && <Check className="w-2 h-2 text-white" />}
                          </div>
                          {m?.label ?? id}
                        </button>
                      );
                    })}
                    {ALL_MODULE_IDS.filter(id => !planModulesCache.includes(id)).length === 0 && (
                      <p className="text-xs text-church-gray italic col-span-3">
                        This church is already on the Enterprise plan (all modules included).
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-7 py-5 border-t border-gray-100 flex gap-3">
                <button
                  onClick={handleSaveAccess}
                  disabled={savingAccess}
                  className="flex-1 bg-church-blue text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-church-blue/90 transition disabled:opacity-60"
                >
                  {savingAccess ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Save Overrides</>}
                </button>
                <button
                  onClick={handleResetAccess}
                  disabled={savingAccess}
                  className="px-5 py-3 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-xl font-bold text-sm hover:bg-yellow-100 transition disabled:opacity-60"
                >
                  Reset to Plan
                </button>
                <button
                  onClick={() => setAccessChurch(null)}
                  className="px-5 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Toast stack (fixed, top-right) ─────────────────────────────────── */}
      <div className="fixed top-6 right-6 z-[60] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <Toast toast={toast} onDismiss={dismissToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
