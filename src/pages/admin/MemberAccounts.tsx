import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, ShieldX, Loader2, AlertCircle, Users, Mail,
  KeyRound, UserX, UserCheck, Trash2, RefreshCw, ChevronDown,
  Check, X, UserPlus, Eye, EyeOff, AtSign, CheckCircle2, XCircle, Copy,
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '@/src/lib/firebase';
import { useAuth } from '@/src/components/AuthContext';
import { AppUser, UserRole, AccountStatus } from '@/src/types';
import { cn, formatDate } from '@/src/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const PORTAL_ROLES: UserRole[] = [UserRole.MEMBER, UserRole.DEPARTMENT_HEAD];

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.PLATFORM_OWNER]: 'Platform Owner',
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.ADMIN]: 'Admin',
  [UserRole.DEPARTMENT_HEAD]: 'Dept Head',
  [UserRole.MEMBER]: 'Member',
};

const ROLE_COLORS: Record<string, string> = {
  [UserRole.DEPARTMENT_HEAD]: 'bg-emerald-100 text-emerald-700',
  [UserRole.MEMBER]: 'bg-gray-100 text-gray-600',
};

const STATUS_CONFIG: Record<AccountStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  disabled: { label: 'Disabled', color: 'bg-red-100 text-red-700' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-church-yellow' },
};

type FilterTab = 'all' | AccountStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'disabled', label: 'Disabled' },
  { key: 'pending', label: 'Pending' },
];

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

interface ConfirmDialog {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant: 'danger' | 'primary';
  onConfirm: () => void;
}

const DEFAULT_CONFIRM: ConfirmDialog = {
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  confirmVariant: 'primary',
  onConfirm: () => {},
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ user }: { user: AppUser }) {
  const initials = (user.displayName || user.email || '?')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  if (user.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName}
        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
      />
    );
  }

  return (
    <div className="w-9 h-9 rounded-full bg-church-blue/10 text-church-blue flex items-center justify-center text-sm font-semibold flex-shrink-0">
      {initials}
    </div>
  );
}

// ─── Action Menu ──────────────────────────────────────────────────────────────

interface ActionMenuProps {
  user: AppUser;
  onPasswordReset: (u: AppUser) => void;
  onDisable: (u: AppUser) => void;
  onEnable: (u: AppUser) => void;
  onDelete: (u: AppUser) => void;
}

function ActionMenu({ user, onPasswordReset, onDisable, onEnable, onDelete }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const isDisabled = (user.accountStatus ?? 'active') === 'disabled';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        title="Actions"
      >
        <ChevronDown className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden py-1"
            >
              <button
                onClick={() => { setOpen(false); onPasswordReset(user); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <KeyRound className="w-4 h-4 text-church-blue" />
                Send Password Reset
              </button>

              {isDisabled ? (
                <button
                  onClick={() => { setOpen(false); onEnable(user); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <UserCheck className="w-4 h-4 text-green-600" />
                  Enable Account
                </button>
              ) : (
                <button
                  onClick={() => { setOpen(false); onDisable(user); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <UserX className="w-4 h-4 text-church-yellow" />
                  Disable Account
                </button>
              )}

              <div className="border-t border-gray-100 my-1" />

              <button
                onClick={() => { setOpen(false); onDelete(user); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Invite helpers ───────────────────────────────────────────────────────────

function genPassword(): string {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const D = '23456789';
  const r = (p: string) => p[Math.floor(Math.random() * p.length)];
  return `${r(L)}${r(L)}${r(D)}${r(D)}${r(L)}${r(D)}!`;
}

async function checkUsernameAvail(username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  return !snap.exists();
}

async function createMemberAccount(opts: {
  displayName: string;
  username: string;
  password: string;
  role: UserRole;
  churchId: string;
  createdBy: string;
}): Promise<string> {
  const { displayName, username, password, role, churchId, createdBy } = opts;
  const usernameLower = username.toLowerCase().trim();
  const internalEmail = `${usernameLower}@graceflow.internal`;

  const apiKey = (auth.app.options as any).apiKey as string;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: internalEmail, password, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error?.message ?? 'Failed to create account';
    throw new Error(msg === 'EMAIL_EXISTS' ? 'Username is already taken.' : msg);
  }
  const uid: string = data.localId;

  await setDoc(doc(db, 'usernames', usernameLower), {
    uid, email: internalEmail, createdAt: new Date().toISOString(),
  });
  await setDoc(doc(db, 'users', uid), {
    uid, email: internalEmail, displayName: displayName.trim(),
    username: usernameLower, role, churchId,
    authProvider: 'username', accountStatus: 'active',
    createdAt: new Date().toISOString(), createdBy,
  });
  return uid;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MemberAccounts() {
  const { user: adminUser, churchId, isSuperAdmin, hasAction } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmDialog>(DEFAULT_CONFIRM);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Invite member modal ─────────────────────────────────────────────────────
  const [showInvite, setShowInvite]     = useState(false);
  const [inviteStep, setInviteStep]     = useState<'form' | 'done'>('form');
  const [inviteForm, setInviteForm]     = useState({
    displayName: '', username: '', role: UserRole.MEMBER as UserRole, password: genPassword(),
  });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});
  const [usnStatus, setUsnStatus]       = useState<'idle'|'checking'|'ok'|'taken'>('idle');
  const [creating, setCreating]         = useState(false);
  const [showPass, setShowPass]         = useState(false);
  const [credCopied, setCredCopied]     = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ username: string; password: string } | null>(null);
  const usnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (usnTimer.current) clearTimeout(usnTimer.current);
    const u = inviteForm.username.trim().toLowerCase();
    if (u.length < 2) { setUsnStatus('idle'); return; }
    setUsnStatus('checking');
    usnTimer.current = setTimeout(async () => {
      setUsnStatus((await checkUsernameAvail(u)) ? 'ok' : 'taken');
    }, 500);
  }, [inviteForm.username]);

  // ── Permission guard ────────────────────────────────────────────────────────
  const canAccess = isSuperAdmin || hasAction('members:manage_accounts');

  // ── Firestore subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!churchId || !canAccess) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('churchId', '==', churchId),
    );

    const unsub = onSnapshot(
      q,
      snap => {
        const all = snap.docs
          .map(d => ({ ...d.data(), uid: d.id } as AppUser))
          .filter(u => PORTAL_ROLES.includes(u.role));
        setUsers(all);
        setLoading(false);
        setError(null);
      },
      err => {
        setError('Failed to load member accounts. Please try again.');
        setLoading(false);
      },
    );

    return () => unsub();
  }, [churchId, canAccess]);

  // ── Toast helpers ───────────────────────────────────────────────────────────
  const addToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // ── Invite member submit ────────────────────────────────────────────────────
  const handleInviteSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!inviteForm.displayName.trim())     errs.displayName = 'Full name is required.';
    if (inviteForm.username.trim().length < 2) errs.username = 'Username must be at least 2 characters.';
    if (usnStatus === 'taken')              errs.username = 'Username is already taken.';
    if (usnStatus === 'checking')           errs.username = 'Please wait…';
    if (inviteForm.password.length < 6)    errs.password  = 'Password must be at least 6 characters.';
    setInviteErrors(errs);
    if (Object.keys(errs).length) return;

    if (!adminUser || !churchId) return;
    setCreating(true);
    try {
      await createMemberAccount({
        displayName: inviteForm.displayName,
        username: inviteForm.username,
        password: inviteForm.password,
        role: inviteForm.role,
        churchId,
        createdBy: adminUser.uid,
      });
      setCreatedCreds({ username: inviteForm.username.trim().toLowerCase(), password: inviteForm.password });
      setInviteStep('done');
      addToast(`Account created for ${inviteForm.displayName}.`, 'success');
    } catch (e: any) {
      if (e.message?.includes('Username')) setInviteErrors({ username: e.message });
      else addToast(e.message ?? 'Failed to create account.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openInvite = () => {
    setInviteForm({ displayName: '', username: '', role: UserRole.MEMBER, password: genPassword() });
    setInviteErrors({});
    setUsnStatus('idle');
    setInviteStep('form');
    setCreatedCreds(null);
    setShowPass(false);
    setCredCopied(false);
    setShowInvite(true);
  };

  const copyCredentials = () => {
    if (!createdCreds) return;
    navigator.clipboard.writeText(
      `GraceFlow Member Portal Login\nUsername: ${createdCreds.username}\nPassword: ${createdCreds.password}\nURL: ${window.location.origin}/portal`
    );
    setCredCopied(true);
    setTimeout(() => setCredCopied(false), 2500);
  };

  // ── Filtered + searched list ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return users.filter(u => {
      const status: AccountStatus = u.accountStatus ?? 'active';
      if (filterTab !== 'all' && status !== filterTab) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          u.displayName?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, filterTab, search]);

  // ── Tab counts ──────────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = { all: users.length, active: 0, disabled: 0, pending: 0 };
    for (const u of users) {
      const s = (u.accountStatus ?? 'active') as AccountStatus;
      if (s in counts) counts[s]++;
    }
    return counts;
  }, [users]);

  // ── API helper ──────────────────────────────────────────────────────────────
  async function callAuthApi(
    path: string,
    method: 'POST' | 'DELETE',
    body: Record<string, string>,
  ): Promise<void> {
    const token = await auth.currentUser!.getIdToken();
    const res = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message ?? `Request failed (${res.status})`);
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  function askPasswordReset(u: AppUser) {
    setConfirm({
      open: true,
      title: 'Send Password Reset?',
      message: `A password reset email will be sent to ${u.email}.`,
      confirmLabel: 'Send Email',
      confirmVariant: 'primary',
      onConfirm: () => doPasswordReset(u),
    });
  }

  async function doPasswordReset(u: AppUser) {
    setConfirm(DEFAULT_CONFIRM);
    setActionLoading(u.uid);
    try {
      await sendPasswordResetEmail(auth, u.email);
      addToast(`Password reset email sent to ${u.email}.`, 'success');
    } catch (e: any) {
      addToast(e.message ?? 'Failed to send reset email.', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  function askDisable(u: AppUser) {
    setConfirm({
      open: true,
      title: 'Disable Account?',
      message: `${u.displayName || u.email} will no longer be able to sign in.`,
      confirmLabel: 'Disable',
      confirmVariant: 'danger',
      onConfirm: () => doDisable(u),
    });
  }

  async function doDisable(u: AppUser) {
    setConfirm(DEFAULT_CONFIRM);
    setActionLoading(u.uid);
    try {
      await callAuthApi('/api/auth/disable-user', 'POST', { targetUid: u.uid, churchId: churchId! });
      await updateDoc(doc(db, 'users', u.uid), { accountStatus: 'disabled' });
      addToast(`${u.displayName || u.email} has been disabled.`, 'success');
    } catch (e: any) {
      addToast(e.message ?? 'Failed to disable account.', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  function askEnable(u: AppUser) {
    setConfirm({
      open: true,
      title: 'Enable Account?',
      message: `${u.displayName || u.email} will be able to sign in again.`,
      confirmLabel: 'Enable',
      confirmVariant: 'primary',
      onConfirm: () => doEnable(u),
    });
  }

  async function doEnable(u: AppUser) {
    setConfirm(DEFAULT_CONFIRM);
    setActionLoading(u.uid);
    try {
      await callAuthApi('/api/auth/enable-user', 'POST', { targetUid: u.uid, churchId: churchId! });
      await updateDoc(doc(db, 'users', u.uid), { accountStatus: 'active' });
      addToast(`${u.displayName || u.email} has been enabled.`, 'success');
    } catch (e: any) {
      addToast(e.message ?? 'Failed to enable account.', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  function askDelete(u: AppUser) {
    setConfirm({
      open: true,
      title: 'Delete Account?',
      message: `This will permanently delete ${u.displayName || u.email}'s account. This action cannot be undone.`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: () => doDelete(u),
    });
  }

  async function doDelete(u: AppUser) {
    setConfirm(DEFAULT_CONFIRM);
    setActionLoading(u.uid);
    try {
      await callAuthApi('/api/auth/delete-user', 'DELETE', { targetUid: u.uid, churchId: churchId! });
      setUsers(prev => prev.filter(x => x.uid !== u.uid));
      addToast(`${u.displayName || u.email}'s account has been deleted.`, 'success');
    } catch (e: any) {
      addToast(e.message ?? 'Failed to delete account.', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  // ── Access denied ───────────────────────────────────────────────────────────
  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <ShieldX className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-church-black">Access Denied</h2>
        <p className="text-church-gray max-w-sm">
          You don't have permission to manage member accounts. Contact your administrator.
        </p>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-church-blue animate-spin" />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-church-black">Something went wrong</h2>
        <p className="text-church-gray max-w-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-church-blue text-white rounded-lg text-sm font-medium hover:bg-church-blue/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-church-black">Member Accounts</h1>
          <p className="text-church-gray text-sm mt-0.5">
            Manage portal access for members and department heads.
          </p>
        </div>
        <button
          onClick={openInvite}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-church-blue text-white rounded-xl text-sm font-semibold hover:bg-church-blue/90 active:scale-95 transition-all self-start sm:self-auto shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {/* Filter tabs + Search row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Tabs */}
        <div className="flex gap-1 bg-church-soft rounded-xl p-1 self-start">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                filterTab === tab.key
                  ? 'bg-white text-church-blue shadow-sm'
                  : 'text-church-gray hover:text-church-black',
              )}
            >
              {tab.label}
              <span className={cn(
                'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                filterTab === tab.key ? 'bg-church-blue/10 text-church-blue' : 'bg-white/60 text-church-gray',
              )}>
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-church-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-church-blue/30 focus:border-church-blue transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop table / Mobile cards */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 gap-3 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-church-soft flex items-center justify-center">
            <Users className="w-7 h-7 text-church-gray" />
          </div>
          <p className="text-church-black font-semibold">No accounts found</p>
          <p className="text-church-gray text-sm">
            {search ? 'Try a different search term.' : 'No member portal accounts yet.'}
          </p>
        </motion.div>
      ) : (
        <>
          {/* ── Desktop table ─────────────────────────────────────────────── */}
          <div className="hidden md:block rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-church-soft/60 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-church-gray">Member</th>
                  <th className="text-left px-4 py-3 font-semibold text-church-gray">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-church-gray">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-church-gray">Last Login</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtered.map((u, i) => {
                    const status: AccountStatus = u.accountStatus ?? 'active';
                    const statusCfg = STATUS_CONFIG[status];
                    const isProcessing = actionLoading === u.uid;

                    return (
                      <motion.tr
                        key={u.uid}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-gray-50 last:border-0 hover:bg-church-soft/30 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {isProcessing ? (
                              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0">
                                <Loader2 className="w-5 h-5 text-church-blue animate-spin" />
                              </div>
                            ) : (
                              <Avatar user={u} />
                            )}
                            <div>
                              <p className="font-medium text-church-black leading-snug">
                                {u.displayName || '—'}
                              </p>
                              <p className="text-xs text-church-gray flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600',
                          )}>
                            {ROLE_LABELS[u.role] ?? u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            statusCfg.color,
                          )}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-church-gray text-xs">
                          {(u as any).lastLogin
                            ? formatDate((u as any).lastLogin)
                            : <span className="italic text-gray-400">Never</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <ActionMenu
                            user={u}
                            onPasswordReset={askPasswordReset}
                            onDisable={askDisable}
                            onEnable={askEnable}
                            onDelete={askDelete}
                          />
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ───────────────────────────────────────────────── */}
          <div className="md:hidden space-y-3">
            <AnimatePresence initial={false}>
              {filtered.map((u, i) => {
                const status: AccountStatus = u.accountStatus ?? 'active';
                const statusCfg = STATUS_CONFIG[status];
                const isProcessing = actionLoading === u.uid;

                return (
                  <motion.div
                    key={u.uid}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {isProcessing ? (
                          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0">
                            <Loader2 className="w-5 h-5 text-church-blue animate-spin" />
                          </div>
                        ) : (
                          <Avatar user={u} />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-church-black text-sm leading-snug truncate">
                            {u.displayName || '—'}
                          </p>
                          <p className="text-xs text-church-gray truncate">{u.email}</p>
                        </div>
                      </div>
                      <ActionMenu
                        user={u}
                        onPasswordReset={askPasswordReset}
                        onDisable={askDisable}
                        onEnable={askEnable}
                        onDelete={askDelete}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600',
                      )}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        statusCfg.color,
                      )}>
                        {statusCfg.label}
                      </span>
                    </div>

                    {(u as any).lastLogin && (
                      <p className="text-xs text-church-gray mt-2">
                        Last login: {formatDate((u as any).lastLogin)}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirm.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
            >
              <h3 className="text-lg font-bold text-church-black">{confirm.title}</h3>
              <p className="text-church-gray text-sm leading-relaxed">{confirm.message}</p>
              <div className="flex gap-3 justify-end pt-1">
                <button
                  onClick={() => setConfirm(DEFAULT_CONFIRM)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-church-gray hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirm.onConfirm}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
                    confirm.confirmVariant === 'danger'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-church-blue text-white hover:bg-church-blue/90',
                  )}
                >
                  {confirm.confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast stack */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={cn(
                'flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto max-w-xs',
                t.type === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white',
              )}
            >
              {t.type === 'success' ? (
                <Check className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Invite Member Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showInvite && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]"
            >
              {inviteStep === 'done' && createdCreds ? (
                /* ── Step 2: Credentials ─────────────────────────────────── */
                <>
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-7 py-5 rounded-t-3xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-black text-white">Account Created!</h3>
                      <p className="text-emerald-100 text-xs">Share these login details with the member</p>
                    </div>
                  </div>

                  <div className="px-7 py-5 space-y-4 overflow-y-auto flex-1">
                    <div className="bg-church-soft rounded-2xl p-5 space-y-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-church-gray mb-0.5">Username</p>
                        <p className="font-mono font-black text-xl text-church-black tracking-wider">{createdCreds.username}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-church-gray mb-0.5">Password</p>
                          <p className={cn('font-mono font-black text-xl text-church-black tracking-wider', !showPass && 'blur-sm select-none')}>
                            {createdCreds.password}
                          </p>
                        </div>
                        <button onClick={() => setShowPass(v => !v)} className="p-2 rounded-xl hover:bg-church-blue/5 text-church-gray">
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="bg-church-blue/5 border border-church-blue/15 rounded-xl px-4 py-3 text-xs text-church-gray">
                      The member logs in at <strong>{window.location.origin}/portal</strong> using their username and password above.
                    </div>
                  </div>

                  <div className="px-7 py-5 border-t border-gray-100 flex gap-3">
                    <button
                      onClick={copyCredentials}
                      className={cn('flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
                        credCopied ? 'bg-emerald-500 text-white' : 'bg-church-blue text-white hover:bg-church-blue/90')}
                    >
                      {credCopied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Login Details</>}
                    </button>
                    <button
                      onClick={() => { setShowInvite(false); setInviteStep('form'); }}
                      className="px-5 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition"
                    >
                      Done
                    </button>
                  </div>
                </>
              ) : (
                /* ── Step 1: Form ────────────────────────────────────────── */
                <>
                  <div className="bg-gradient-to-r from-church-blue to-church-blue/80 px-7 py-5 rounded-t-3xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-display font-black text-white">Invite Member</h3>
                        <p className="text-blue-200 text-xs mt-0.5">Creates a portal account with username + password</p>
                      </div>
                      <button onClick={() => setShowInvite(false)} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1 px-7 py-5 space-y-4">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={inviteForm.displayName}
                        onChange={e => { setInviteForm(f => ({ ...f, displayName: e.target.value })); setInviteErrors(e => ({ ...e, displayName: '' })); }}
                        placeholder="John Doe"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                      />
                      {inviteErrors.displayName && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{inviteErrors.displayName}</p>}
                    </div>

                    {/* Username with live check */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">
                        Username <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray/50 pointer-events-none" />
                        <input
                          type="text"
                          value={inviteForm.username}
                          onChange={e => { setInviteForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })); setInviteErrors(e => ({ ...e, username: '' })); }}
                          placeholder="john_doe"
                          className={cn('w-full border rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all',
                            inviteErrors.username || usnStatus === 'taken' ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-church-blue/20')}
                        />
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                          {usnStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-church-blue" />}
                          {usnStatus === 'ok'       && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          {usnStatus === 'taken'    && <XCircle className="w-4 h-4 text-red-500" />}
                        </div>
                      </div>
                      {inviteErrors.username && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{inviteErrors.username}</p>}
                      {usnStatus === 'ok' && !inviteErrors.username && <p className="text-emerald-500 text-xs mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Username available</p>}
                    </div>

                    {/* Role */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">Role</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([UserRole.MEMBER, UserRole.DEPARTMENT_HEAD] as const).map(r => (
                          <button key={r} type="button"
                            onClick={() => setInviteForm(f => ({ ...f, role: r }))}
                            className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm font-bold transition-all',
                              inviteForm.role === r ? 'bg-church-blue/5 border-church-blue text-church-blue' : 'bg-white border-gray-200 text-church-gray hover:border-church-blue/30')}
                          >
                            <div className={cn('w-3 h-3 rounded-full border-2', inviteForm.role === r ? 'bg-church-blue border-church-blue' : 'border-gray-300')} />
                            {r === UserRole.MEMBER ? 'Member' : 'Dept Head'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">Default Password</label>
                      <div className="relative">
                        <input
                          type={showPass ? 'text' : 'password'}
                          value={inviteForm.password}
                          onChange={e => { setInviteForm(f => ({ ...f, password: e.target.value })); setInviteErrors(e => ({ ...e, password: '' })); }}
                          className="w-full border border-gray-200 rounded-xl px-4 pr-20 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <button type="button" onClick={() => setShowPass(v => !v)} className="p-1 text-church-gray hover:text-church-black">
                            {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button type="button" onClick={() => setInviteForm(f => ({ ...f, password: genPassword() }))} className="text-[10px] text-church-blue font-bold hover:underline">New</button>
                        </div>
                      </div>
                      {inviteErrors.password && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{inviteErrors.password}</p>}
                      <p className="text-xs text-church-gray mt-1">Share this with the member — they can change it after logging in.</p>
                    </div>
                  </div>

                  <div className="px-7 py-5 border-t border-gray-100 flex gap-3">
                    <button
                      onClick={handleInviteSubmit}
                      disabled={creating || usnStatus === 'taken' || usnStatus === 'checking'}
                      className="flex-1 bg-church-blue disabled:opacity-50 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-church-blue/90 transition"
                    >
                      {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><UserPlus className="w-4 h-4" /> Create Account</>}
                    </button>
                    <button onClick={() => setShowInvite(false)} className="px-5 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
