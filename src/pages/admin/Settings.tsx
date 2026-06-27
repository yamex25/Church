/**
 * Super Administrator Settings — Odoo-style module permission management.
 * Only the church owner (SUPER_ADMIN) can access this page.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Shield, Plus, Save, X, Trash2, Search,
  Layers, UserPlus, Crown, Settings as SettingsIcon,
  Loader2, AlertCircle, Check, Package, ShieldCheck,
  Eye, EyeOff, Copy, AtSign, KeyRound, CheckCircle2, XCircle,
} from 'lucide-react';
import { db, auth } from '@/src/lib/firebase';
import {
  collection, query, where, onSnapshot, setDoc, doc,
  addDoc, updateDoc, deleteDoc, getDocs,
} from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { AppUser, PermissionGroup, PendingInvite, UserRole } from '@/src/types';
import { MODULE_DEFS, ALL_MODULE_IDS, ACTION_DEFS } from '@/src/lib/permissions';
import { cn } from '@/src/lib/utils';

// ─── Username account helpers ─────────────────────────────────────────────────

function generateDefaultPassword(): string {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const D = '23456789';
  const r = (p: string) => p[Math.floor(Math.random() * p.length)];
  return `${r(L)}${r(L)}${r(D)}${r(D)}${r(L)}${r(D)}!`;
}

async function checkUsernameAvailable(username: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, 'usernames'), where('__name__', '==', username.toLowerCase())),
  );
  return snap.empty;
}

/**
 * Creates a Firebase Auth account via the REST API (does NOT sign out the
 * current admin) then writes the Firestore user + username docs.
 */
async function createUsernameAccount(opts: {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  churchId: string;
  allowedModules: string[];
  allowedActions: string[];
  createdBy: string;
}): Promise<string /* uid */> {
  const { username, displayName, password, role, churchId, allowedModules, allowedActions, createdBy } = opts;
  const usernameLower = username.toLowerCase().trim();
  const internalEmail = `${usernameLower}@graceflow.internal`;

  // ── Step 1: Create Firebase Auth user via REST API (no SDK sign-in side-effect) ──
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

  // ── Step 2: Username lookup doc (allows signInWithUsername flow) ──────────
  await setDoc(doc(db, 'usernames', usernameLower), {
    uid,
    email: internalEmail,
    createdAt: new Date().toISOString(),
  });

  // ── Step 3: Firestore user profile ────────────────────────────────────────
  await setDoc(doc(db, 'users', uid), {
    uid,
    email: internalEmail,
    displayName: displayName.trim(),
    username: usernameLower,
    role,
    churchId,
    allowedModules,
    allowedActions,
    authProvider: 'username',
    accountStatus: 'active',
    createdAt: new Date().toISOString(),
    createdBy,
  });

  return uid;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'admins' | 'users' | 'groups';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.PLATFORM_OWNER]: 'Platform Owner',
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.ADMIN]: 'Admin',
  [UserRole.DEPARTMENT_HEAD]: 'Dept Head',
  [UserRole.MEMBER]: 'Member',
};

const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.PLATFORM_OWNER]: 'bg-yellow-100 text-church-yellow',
  [UserRole.SUPER_ADMIN]: 'bg-church-yellow text-church-black',
  [UserRole.ADMIN]: 'bg-church-blue/10 text-church-blue',
  [UserRole.DEPARTMENT_HEAD]: 'bg-emerald-100 text-emerald-700',
  [UserRole.MEMBER]: 'bg-gray-100 text-gray-600',
};

// ─── Module checkbox grid ─────────────────────────────────────────────────────

function ModuleGrid({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (modules: string[]) => void;
  disabled?: boolean;
}) {
  const all = selected.length === ALL_MODULE_IDS.length;

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter(m => m !== id)
        : [...selected, id],
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-church-gray uppercase tracking-wider">Module Access</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(all ? [] : [...ALL_MODULE_IDS])}
          className="text-xs font-bold text-church-blue hover:underline disabled:opacity-40"
        >
          {all ? 'Remove All' : 'Grant All'}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {MODULE_DEFS.map(m => {
          const checked = selected.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(m.id)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                checked
                  ? 'bg-church-blue/5 border-church-blue/30 text-church-blue'
                  : 'bg-white border-gray-100 text-church-gray hover:border-church-blue/20',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                checked ? 'bg-church-blue border-church-blue' : 'border-gray-300',
              )}>
                {checked && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{m.label}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Settings() {
  const { user, church, churchId, isSuperAdmin } = useAuth();

  const [tab, setTab] = useState<Tab>('admins');
  const [churchUsers, setChurchUsers] = useState<AppUser[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchUser, setSearchUser] = useState('');

  // User permissions editing
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);
  const [editActions, setEditActions] = useState<string[]>([]);
  const [savingUser, setSavingUser] = useState(false);
  const [savedUser, setSavedUser] = useState(false);

  // Admin invite management
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: UserRole.ADMIN as UserRole,
    allowedModules: [...ALL_MODULE_IDS] as string[],
    allowedActions: [] as string[],
  });
  const [savingInvite, setSavingInvite] = useState(false);
  const [inviteEmailError, setInviteEmailError] = useState('');
  const [createdInvite, setCreatedInvite] = useState<{ email: string; role: UserRole } | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Create-by-username modal ──────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    displayName: '',
    username: '',
    role: UserRole.ADMIN as UserRole,
    allowedModules: [...ALL_MODULE_IDS] as string[],
    allowedActions: [] as string[],
    password: generateDefaultPassword(),
  });
  const [createUsnStatus, setCreateUsnStatus] = useState<'idle'|'checking'|'available'|'taken'>('idle');
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<{ username: string; password: string } | null>(null);
  const [credCopied, setCredCopied] = useState(false);
  const [showCreatedPass, setShowCreatedPass] = useState(false);
  const createUsnTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live username availability check for create modal
  React.useEffect(() => {
    if (createUsnTimer.current) clearTimeout(createUsnTimer.current);
    const uname = createForm.username.trim().toLowerCase();
    if (!uname || uname.length < 2) { setCreateUsnStatus('idle'); return; }
    setCreateUsnStatus('checking');
    createUsnTimer.current = setTimeout(async () => {
      const avail = await checkUsernameAvailable(uname);
      setCreateUsnStatus(avail ? 'available' : 'taken');
    }, 500);
  }, [createForm.username]);

  const handleCreateAccount = async () => {
    const errs: Record<string, string> = {};
    if (!createForm.displayName.trim())           errs.displayName = 'Full name is required.';
    if (createForm.username.trim().length < 2)    errs.username = 'Username must be at least 2 characters.';
    if (createUsnStatus === 'taken')              errs.username = 'Username already taken.';
    if (createUsnStatus === 'checking')           errs.username = 'Please wait for the check to complete.';
    setCreateErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (!user || !churchId) return;
    setCreatingAccount(true);
    try {
      await createUsernameAccount({
        username: createForm.username.trim(),
        displayName: createForm.displayName.trim(),
        password: createForm.password,
        role: createForm.role,
        churchId,
        allowedModules: createForm.allowedModules,
        allowedActions: createForm.allowedActions,
        createdBy: user.uid,
      });
      setCreatedAccount({ username: createForm.username.trim().toLowerCase(), password: createForm.password });
    } catch (e: any) {
      if (e.message?.includes('Username')) {
        setCreateErrors({ username: e.message });
      } else {
        alert('Failed to create account: ' + (e.message ?? 'Unknown error'));
      }
    } finally {
      setCreatingAccount(false);
    }
  };

  const copyCredentials = () => {
    if (!createdAccount) return;
    navigator.clipboard.writeText(
      `GraceFlow Login\nUsername: ${createdAccount.username}\nPassword: ${createdAccount.password}\nURL: ${window.location.origin}`
    );
    setCredCopied(true);
    setTimeout(() => setCredCopied(false), 2500);
  };

  // Group editing
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [groupForm, setGroupForm] = useState({ name: '', modules: [] as string[] });
  const [savingGroup, setSavingGroup] = useState(false);

  // Guard: only Super Admin can access
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <Crown className="w-16 h-16 text-church-yellow mb-4" />
        <h2 className="text-2xl font-display font-black text-church-black mb-2">
          Super Administrator Only
        </h2>
        <p className="text-church-gray text-sm max-w-sm">
          Settings are restricted to the church owner (Super Administrator).
          Contact your church administrator for access.
        </p>
      </div>
    );
  }

  // ── Load church users ────────────────────────────────────────────────────
  useEffect(() => {
    if (!churchId) return;
    return onSnapshot(
      query(collection(db, 'users'), where('churchId', '==', churchId)),
      snap => {
        const list = snap.docs
          .map(d => ({ ...(d.data() as AppUser) }))
          .filter(u => u.uid !== user?.uid); // exclude self (Super Admin can't restrict themselves)
        setChurchUsers(list);
        setLoadingUsers(false);
      },
    );
  }, [churchId, user?.uid]);

  // ── Load groups ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!churchId) return;
    return onSnapshot(
      collection(db, 'churches', churchId, 'groups'),
      snap => {
        setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as PermissionGroup)));
      },
    );
  }, [churchId]);

  // ── Load pending invites ─────────────────────────────────────────────────
  useEffect(() => {
    if (!churchId) return;
    return onSnapshot(
      query(
        collection(db, 'pendingInvites'),
        where('churchId', '==', churchId),
        where('status', '==', 'pending'),
      ),
      snap => setPendingInvites(snap.docs.map(d => ({ id: d.id, ...d.data() } as PendingInvite))),
    );
  }, [churchId]);

  // ── Send admin invite ────────────────────────────────────────────────────
  const buildInviteMessage = (email: string, role: UserRole): string => {
    const appUrl = window.location.origin;
    const churchLabel = church?.name ?? 'our church';
    const roleName = ROLE_LABELS[role];
    return [
      `Hello,`,
      ``,
      `You have been invited to join ${churchLabel} on GraceFlow as ${roleName}.`,
      ``,
      `To accept this invitation, follow these steps:`,
      ``,
      `1. Open the GraceFlow app: ${appUrl}`,
      `2. Click "Sign In with Google"`,
      `3. Sign in using this exact email address: ${email}`,
      `4. Your ${roleName} access will be set up automatically — no extra steps needed.`,
      ``,
      `⚠ Important: You must sign in with the email address above (${email}).`,
      `   Using a different email will NOT give you admin access.`,
      ``,
      `— ${user?.displayName ?? 'Church Admin'} | ${churchLabel}`,
    ].join('\n');
  };

  const copyInviteMessage = (email: string, role: UserRole) => {
    navigator.clipboard.writeText(buildInviteMessage(email, role)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const sendInvite = async () => {
    if (!user || !churchId) return;
    const emailClean = inviteForm.email.trim().toLowerCase();
    if (!emailClean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      setInviteEmailError('Enter a valid email address.');
      return;
    }
    // Prevent duplicate pending invite
    if (pendingInvites.some(i => i.emailLower === emailClean)) {
      setInviteEmailError('There is already a pending invite for this email.');
      return;
    }
    // Prevent inviting someone already in the church
    if (churchUsers.some(u => u.email?.toLowerCase() === emailClean)) {
      setInviteEmailError('This email already belongs to an existing church user.');
      return;
    }
    setSavingInvite(true);
    setInviteEmailError('');
    try {
      await addDoc(collection(db, 'pendingInvites'), {
        churchId,
        churchName: '', // will be filled at sign-in
        email: emailClean,
        emailLower: emailClean,
        role: inviteForm.role,
        allowedModules: inviteForm.allowedModules,
        allowedActions: inviteForm.allowedActions,
        invitedBy: user.uid,
        invitedByName: user.displayName,
        invitedAt: new Date().toISOString(),
        status: 'pending',
      });
      // Don't close — switch to "share" screen so admin can copy the invite message
      setCreatedInvite({ email: emailClean, role: inviteForm.role });
      setInviteForm({ email: '', role: UserRole.ADMIN, allowedModules: [...ALL_MODULE_IDS], allowedActions: [] });
    } catch (e) {
      console.error(e);
      alert('Failed to send invite. Please try again.');
    } finally {
      setSavingInvite(false);
    }
  };

  const cancelInvite = async (inviteId: string) => {
    if (!window.confirm('Cancel this invite?')) return;
    await updateDoc(doc(db, 'pendingInvites', inviteId), { status: 'cancelled' });
  };

  // ── Open user permission editor ──────────────────────────────────────────
  const openUserEditor = (u: AppUser) => {
    setEditingUser(u);
    setEditModules(u.allowedModules ?? [...ALL_MODULE_IDS]);
    setEditGroupIds(u.groupIds ?? []);
    setEditActions(u.allowedActions ?? []);
    setSavedUser(false);
  };

  // ── Save user permissions ────────────────────────────────────────────────
  const saveUserPermissions = async () => {
    if (!editingUser || !churchId) return;
    setSavingUser(true);
    try {
      await setDoc(
        doc(db, 'users', editingUser.uid),
        {
          allowedModules: editModules,
          groupIds: editGroupIds,
          allowedActions: editActions,
          permissionsUpdatedBy: user?.uid,
          permissionsUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      setSavedUser(true);
      setTimeout(() => setSavedUser(false), 2000);
    } catch (e) {
      console.error('Save permissions error:', e);
      alert('Failed to save permissions. Please try again.');
    } finally {
      setSavingUser(false);
    }
  };

  // ── Group modal ──────────────────────────────────────────────────────────
  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm({ name: '', modules: [] });
    setShowGroupModal(true);
  };

  const openEditGroup = (g: PermissionGroup) => {
    setEditingGroup(g);
    setGroupForm({ name: g.name, modules: g.modules });
    setShowGroupModal(true);
  };

  const saveGroup = async () => {
    if (!churchId || !user) return;
    if (!groupForm.name.trim()) { alert('Group name is required.'); return; }
    setSavingGroup(true);
    try {
      if (editingGroup) {
        await updateDoc(doc(db, 'churches', churchId, 'groups', editingGroup.id), {
          name: groupForm.name.trim(),
          modules: groupForm.modules,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, 'churches', churchId, 'groups'), {
          churchId,
          name: groupForm.name.trim(),
          modules: groupForm.modules,
          memberUids: [],
          isAutoCreated: false,
          createdAt: new Date().toISOString(),
          createdBy: user.uid,
        });
      }
      setShowGroupModal(false);
    } catch (e) {
      console.error('Save group error:', e);
      alert('Failed to save group.');
    } finally {
      setSavingGroup(false);
    }
  };

  const deleteGroup = async (g: PermissionGroup) => {
    if (!churchId) return;
    if (!window.confirm(`Delete group "${g.name}"? Users will lose any access granted only through this group.`)) return;
    try {
      await deleteDoc(doc(db, 'churches', churchId, 'groups', g.id));
    } catch (e) {
      alert('Failed to delete group.');
    }
  };

  // ── Toggle a group membership for the editing user ───────────────────────
  const toggleGroupForUser = (gid: string) => {
    setEditGroupIds(prev =>
      prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid],
    );
  };

  // ── Filtered users ───────────────────────────────────────────────────────
  const filteredUsers = churchUsers.filter(u =>
    u.displayName?.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchUser.toLowerCase()),
  );

  const moduleCountFor = (u: AppUser) => {
    if (u.allowedModules == null) return ALL_MODULE_IDS.length; // all
    const fromGroups = (u.groupIds ?? [])
      .flatMap(gid => groups.find(g => g.id === gid)?.modules ?? []);
    return new Set([...u.allowedModules, ...fromGroups]).size;
  };

  return (
    <div className="space-y-6 text-church-black">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-church-yellow rounded-2xl flex items-center justify-center shadow-md">
          <SettingsIcon className="w-6 h-6 text-church-black" />
        </div>
        <div>
          <h2 className="text-3xl font-display font-black tracking-tight">Settings</h2>
          <p className="text-church-gray text-sm">
            Super Administrator · Module access control and user permissions
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-church-soft p-1 rounded-2xl w-fit">
        {([
          ['admins', 'Admin Users', Shield],
          ['users', 'Module Permissions', Users],
          ['groups', 'Groups', Layers],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
              tab === key
                ? 'bg-white text-church-blue shadow-sm'
                : 'text-church-gray hover:text-church-black',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── ADMIN USERS TAB ──────────────────────────────────────────────── */}
      {tab === 'admins' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-church-gray">
                Create and manage admin-level users for this church.
                Invited users automatically receive their role when they first sign in with the invited email.
              </p>
            </div>
            <button
              onClick={() => { setShowInviteModal(true); setInviteEmailError(''); setCreatedInvite(null); setCopied(false); }}
              className="flex items-center gap-2 bg-church-blue text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg shadow-church-blue/20 flex-shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              Invite by Email
            </button>
            <button
              onClick={() => {
                setCreateForm({ displayName: '', username: '', role: UserRole.ADMIN, allowedModules: [...ALL_MODULE_IDS], allowedActions: [], password: generateDefaultPassword() });
                setCreateErrors({});
                setCreatedAccount(null);
                setCreateUsnStatus('idle');
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg shadow-emerald-600/20 flex-shrink-0"
            >
              <AtSign className="w-4 h-4" />
              Create Username Account
            </button>
          </div>

          {/* Current admin users */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-church-gray mb-3 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Current Admin Users
            </h3>
            {loadingUsers ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-church-blue" /></div>
            ) : churchUsers.filter(u => u.role === UserRole.ADMIN || u.role === UserRole.DEPARTMENT_HEAD).length === 0 ? (
              <div className="bg-church-soft rounded-2xl p-8 text-center">
                <Users className="w-10 h-10 text-church-gray/30 mx-auto mb-2" />
                <p className="text-church-gray text-sm">No admin users yet. Invite one below.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {churchUsers
                  .filter(u => u.role === UserRole.ADMIN || u.role === UserRole.DEPARTMENT_HEAD)
                  .map(u => (
                    <div key={u.uid} className="flex items-center gap-3 bg-white rounded-2xl border border-church-blue/8 px-4 py-3 shadow-sm">
                      <div className="w-9 h-9 rounded-full bg-church-blue flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {u.displayName?.charAt(0) ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-church-black truncate">{u.displayName}</p>
                        <p className="text-xs text-church-gray truncate">{u.email}</p>
                      </div>
                      <span className={cn('text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide flex-shrink-0', ROLE_COLORS[u.role])}>
                        {ROLE_LABELS[u.role]}
                      </span>
                      <button
                        onClick={() => { setTab('users'); openUserEditor(u); }}
                        className="text-xs text-church-blue font-bold hover:underline flex-shrink-0"
                      >
                        Edit Permissions
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Pending invites */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-church-gray mb-3 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-church-yellow" /> Pending Invitations
            </h3>
            {pendingInvites.length === 0 ? (
              <p className="text-xs text-church-gray italic px-1">No pending invitations.</p>
            ) : (
              <div className="space-y-2">
                {pendingInvites.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 bg-yellow-50 border border-yellow-400 rounded-2xl px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-4 h-4 text-church-yellow" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-church-black truncate">{inv.email}</p>
                      <p className="text-xs text-church-yellow">Invited as <strong>{ROLE_LABELS[inv.role]}</strong> · {new Date(inv.invitedAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-[10px] bg-yellow-200 text-church-yellow px-2 py-0.5 rounded-full font-bold uppercase flex-shrink-0 hidden sm:inline">
                      Awaiting Sign-in
                    </span>
                    {/* Re-share button */}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(buildInviteMessage(inv.email, inv.role));
                        alert(`Invite message for ${inv.email} copied to clipboard!`);
                      }}
                      className="p-1.5 text-church-blue hover:bg-church-blue/10 rounded-lg transition flex-shrink-0"
                      title="Copy invite message"
                    >
                      <Package className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => cancelInvite(inv.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                      title="Cancel invite"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── USERS & PERMISSIONS TAB ──────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: user list */}
          <div className="lg:col-span-2 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray" />
              <input
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
                placeholder="Search users…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-church-blue/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
              />
            </div>

            {loadingUsers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-church-blue" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-church-gray text-sm text-center py-6">No other users in your church yet.</p>
            ) : (
              filteredUsers.map(u => (
                <button
                  key={u.uid}
                  onClick={() => openUserEditor(u)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all hover:shadow-sm',
                    editingUser?.uid === u.uid
                      ? 'bg-church-blue/5 border-church-blue/30'
                      : 'bg-white border-church-blue/8 hover:border-church-blue/20',
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-church-blue flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {u.displayName?.charAt(0) ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-church-black truncate">{u.displayName}</p>
                    <p className="text-xs text-church-gray truncate">{u.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide', ROLE_COLORS[u.role])}>
                      {ROLE_LABELS[u.role]}
                    </span>
                    <span className="text-[10px] text-church-gray">
                      {moduleCountFor(u)}/{ALL_MODULE_IDS.length} modules
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Right: permission editor */}
          <div className="lg:col-span-3">
            {!editingUser ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-center bg-church-soft rounded-3xl">
                <Users className="w-10 h-10 text-church-gray/30 mb-3" />
                <p className="text-church-gray font-medium text-sm">Select a user to manage their permissions</p>
              </div>
            ) : (
              <motion.div
                key={editingUser.uid}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-3xl border border-church-blue/10 shadow-sm overflow-hidden"
              >
                {/* User header */}
                <div className="bg-gradient-to-r from-church-blue to-church-blue/80 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-church-yellow flex items-center justify-center font-black text-church-black text-lg">
                      {editingUser.displayName?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-bold">{editingUser.displayName}</p>
                      <p className="text-blue-200 text-xs">{editingUser.email}</p>
                    </div>
                    <span className={cn('ml-auto text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide', ROLE_COLORS[editingUser.role])}>
                      {ROLE_LABELS[editingUser.role]}
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Groups section */}
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-church-gray mb-3">
                      Group Memberships
                      <span className="ml-2 text-[10px] font-normal normal-case">(permissions are cumulative from all groups)</span>
                    </p>
                    {groups.length === 0 ? (
                      <p className="text-xs text-church-gray italic">No groups yet. Create groups in the Groups tab.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {groups.map(g => {
                          const inGroup = editGroupIds.includes(g.id);
                          return (
                            <button
                              key={g.id}
                              onClick={() => toggleGroupForUser(g.id)}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                                inGroup
                                  ? 'bg-church-blue text-white border-church-blue'
                                  : 'bg-white text-church-gray border-gray-200 hover:border-church-blue/30',
                              )}
                            >
                              {inGroup ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                              {g.name}
                              <span className="opacity-60">({g.modules.length})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Module checkboxes */}
                  <ModuleGrid
                    selected={editModules}
                    onChange={setEditModules}
                  />

                  {/* Action-level permissions */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black uppercase tracking-wider text-church-gray">
                        Action Permissions
                        <span className="ml-2 text-[10px] font-normal normal-case">
                          (fine-grained control within modules)
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setEditActions(
                            editActions.length === ACTION_DEFS.length
                              ? []
                              : ACTION_DEFS.map(a => a.id),
                          )
                        }
                        className="text-xs font-bold text-church-blue hover:underline"
                      >
                        {editActions.length === ACTION_DEFS.length ? 'Remove All' : 'Grant All'}
                      </button>
                    </div>
                    {/* Group actions by module */}
                    <div className="space-y-3">
                      {Array.from(new Set(ACTION_DEFS.map(a => a.moduleId))).map(mid => {
                        const mod = MODULE_DEFS.find(m => m.id === mid);
                        const actions = ACTION_DEFS.filter(a => a.moduleId === mid);
                        return (
                          <div key={mid} className="bg-church-soft rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-church-gray mb-2">
                              {mod?.label ?? mid}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {actions.map(a => {
                                const checked = editActions.includes(a.id);
                                return (
                                  <button
                                    key={a.id}
                                    type="button"
                                    onClick={() =>
                                      setEditActions(prev =>
                                        prev.includes(a.id)
                                          ? prev.filter(x => x !== a.id)
                                          : [...prev, a.id],
                                      )
                                    }
                                    className={cn(
                                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all',
                                      checked
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                        : 'bg-white border-gray-100 text-church-gray hover:border-church-blue/20',
                                    )}
                                  >
                                    <div className={cn(
                                      'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                                      checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300',
                                    )}>
                                      {checked && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    {a.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Save */}
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
                    <button
                      onClick={saveUserPermissions}
                      disabled={savingUser}
                      className="flex items-center gap-2 bg-church-blue text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-church-blue/90 transition disabled:opacity-60"
                    >
                      {savingUser ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                      ) : savedUser ? (
                        <><Check className="w-4 h-4" /> Saved!</>
                      ) : (
                        <><Save className="w-4 h-4" /> Save Permissions</>
                      )}
                    </button>
                    <p className="text-xs text-church-gray">Changes take effect on the user's next page load.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* ── GROUPS TAB ────────────────────────────────────────────────────── */}
      {tab === 'groups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-church-gray">
              Groups bundle module permissions. Assign users to groups to grant access in bulk.
              Groups are auto-created when departments are added.
            </p>
            <button
              onClick={openCreateGroup}
              className="flex items-center gap-2 bg-church-blue text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg shadow-church-blue/20"
            >
              <Plus className="w-4 h-4" />
              New Group
            </button>
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-16 bg-church-soft rounded-3xl">
              <Layers className="w-12 h-12 text-church-gray/30 mx-auto mb-3" />
              <p className="text-church-gray font-medium">No groups yet</p>
              <p className="text-church-gray text-xs mt-1">
                Groups are auto-created with departments, or create one manually.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map(g => (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-church-blue/8 shadow-sm p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-church-blue/10 rounded-xl flex items-center justify-center">
                        <Layers className="w-4 h-4 text-church-blue" />
                      </div>
                      <div>
                        <p className="font-bold text-church-black text-sm">{g.name}</p>
                        {g.isAutoCreated && (
                          <span className="text-[9px] bg-yellow-100 text-church-yellow px-1.5 py-0.5 rounded font-bold uppercase">
                            Auto · {g.departmentName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditGroup(g)}
                        className="p-1.5 text-church-gray hover:text-church-blue hover:bg-church-blue/5 rounded-lg transition"
                      >
                        <SettingsIcon className="w-3.5 h-3.5" />
                      </button>
                      {!g.isAutoCreated && (
                        <button
                          onClick={() => deleteGroup(g)}
                          className="p-1.5 text-church-gray hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Module chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {g.modules.length === 0 ? (
                      <span className="text-xs text-church-gray italic">No modules assigned</span>
                    ) : g.modules.slice(0, 4).map(mid => {
                      const m = MODULE_DEFS.find(d => d.id === mid);
                      return m ? (
                        <span key={mid} className="text-[10px] bg-church-blue/8 text-church-blue px-2 py-0.5 rounded-full font-semibold">
                          {m.label}
                        </span>
                      ) : null;
                    })}
                    {g.modules.length > 4 && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                        +{g.modules.length - 4} more
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-church-gray pt-2 border-t border-gray-50">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {g.modules.length} modules
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {g.memberUids.length} members
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Invite Admin Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]"
            >
              {createdInvite ? (
                /* ── STEP 2: Invite created — share it ─────────────────────── */
                <>
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-7 py-5 rounded-t-3xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-display font-black text-white">Invite Created!</h3>
                        <p className="text-emerald-100 text-xs mt-0.5">
                          Share the message below — no email was sent automatically.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-7 py-5 space-y-4 overflow-y-auto flex-1">
                    {/* Who + role summary */}
                    <div className="flex items-center gap-3 bg-church-soft rounded-xl p-4">
                      <div className="w-10 h-10 bg-church-blue rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {createdInvite.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-church-black text-sm">{createdInvite.email}</p>
                        <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide', ROLE_COLORS[createdInvite.role])}>
                          {ROLE_LABELS[createdInvite.role]}
                        </span>
                      </div>
                    </div>

                    {/* The invite message */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-black uppercase tracking-wider text-church-gray">
                          Invite Message — Copy &amp; Send via WhatsApp, SMS or Email
                        </p>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-church-black font-mono leading-relaxed whitespace-pre-wrap select-all">
                        {buildInviteMessage(createdInvite.email, createdInvite.role)}
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-400 rounded-xl px-4 py-3 text-xs text-church-yellow">
                      <strong>Note:</strong> No email was automatically sent. You must copy this message and
                      send it to <strong>{createdInvite.email}</strong> yourself via WhatsApp, SMS, or your email.
                    </div>
                  </div>

                  <div className="px-7 py-5 border-t border-gray-100 flex gap-3">
                    <button
                      onClick={() => copyInviteMessage(createdInvite.email, createdInvite.role)}
                      className={cn(
                        'flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
                        copied
                          ? 'bg-emerald-500 text-white'
                          : 'bg-church-blue text-white hover:bg-church-blue/90',
                      )}
                    >
                      {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Package className="w-4 h-4" /> Copy Invite Message</>}
                    </button>
                    <button
                      onClick={() => { setShowInviteModal(false); setCreatedInvite(null); }}
                      className="px-5 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition"
                    >
                      Done
                    </button>
                  </div>
                </>
              ) : (
                /* ── STEP 1: Invite form ─────────────────────────────────── */
                <>
                  <div className="bg-gradient-to-r from-church-blue to-church-blue/80 px-7 py-5 rounded-t-3xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-display font-black text-white">Invite Admin User</h3>
                        <p className="text-blue-200 text-xs mt-0.5">
                          They sign in with Google using this email to get access automatically.
                        </p>
                      </div>
                      <button onClick={() => setShowInviteModal(false)} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1 px-7 py-5 space-y-5">
                    {/* Email */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={inviteForm.email}
                        onChange={e => { setInviteForm(p => ({ ...p, email: e.target.value })); setInviteEmailError(''); }}
                        placeholder="admin@example.com"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                      />
                      {inviteEmailError && (
                        <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />{inviteEmailError}
                        </p>
                      )}
                    </div>

                    {/* Role */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">Role</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([UserRole.ADMIN, UserRole.DEPARTMENT_HEAD] as const).map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setInviteForm(p => ({ ...p, role: r }))}
                            className={cn(
                              'flex flex-col items-start px-4 py-3 rounded-xl border text-left transition-all',
                              inviteForm.role === r
                                ? 'bg-church-blue/5 border-church-blue text-church-blue'
                                : 'bg-white border-gray-200 text-church-gray hover:border-church-blue/30',
                            )}
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <div className={cn('w-3.5 h-3.5 rounded-full border-2', inviteForm.role === r ? 'bg-church-blue border-church-blue' : 'border-gray-300')} />
                              <span className="text-sm font-bold">{ROLE_LABELS[r]}</span>
                            </div>
                            <p className="text-[11px] opacity-70 pl-5">
                              {r === UserRole.ADMIN ? 'Full admin access based on permissions' : 'Department-level access + Requisitions'}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Module access (for ADMIN role) */}
                    {inviteForm.role === UserRole.ADMIN && (
                      <ModuleGrid
                        selected={inviteForm.allowedModules}
                        onChange={mods => setInviteForm(p => ({ ...p, allowedModules: mods }))}
                      />
                    )}

                    <div className="bg-yellow-50 border border-yellow-400 rounded-xl px-4 py-3 text-xs text-church-yellow">
                      <strong>How it works:</strong> After creating the invite, you will get a message
                      to copy and share with <strong>{inviteForm.email || 'the person'}</strong> via WhatsApp, SMS or email.
                      When they sign in with Google using that email, their access is configured automatically.
                    </div>
                  </div>

                  <div className="px-7 py-5 border-t border-gray-100 flex gap-3">
                    <button
                      onClick={sendInvite}
                      disabled={savingInvite || !inviteForm.email.trim()}
                      className="flex-1 bg-church-blue disabled:opacity-50 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-church-blue/90 transition"
                    >
                      {savingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      Create Invite
                    </button>
                    <button
                      onClick={() => setShowInviteModal(false)}
                      className="px-5 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Create Username Account Modal ────────────────────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]"
            >
              {createdAccount ? (
                /* ── Success: show credentials ─────────────────────────────── */
                <>
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-7 py-5 rounded-t-3xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-black text-white">Account Created!</h3>
                      <p className="text-emerald-100 text-xs mt-0.5">Share these login details with the user</p>
                    </div>
                  </div>

                  <div className="px-7 py-6 space-y-4 overflow-y-auto flex-1">
                    <div className="bg-church-soft rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-church-gray mb-0.5">Username</p>
                          <p className="font-mono font-black text-xl text-church-black tracking-wider">{createdAccount.username}</p>
                        </div>
                        <AtSign className="w-8 h-8 text-church-blue/20" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-church-gray mb-0.5">Default Password</p>
                          <p className={cn('font-mono font-black text-xl text-church-black tracking-wider', !showCreatedPass && 'blur-sm select-none')}>
                            {createdAccount.password}
                          </p>
                        </div>
                        <button onClick={() => setShowCreatedPass(v => !v)} className="p-2 rounded-xl hover:bg-church-blue/5 text-church-gray">
                          {showCreatedPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-400 rounded-xl px-4 py-3 text-xs text-church-yellow">
                      <strong>How to log in:</strong> Visit the app → "Sign In" tab → choose "Username" → enter username + password above.
                      The user should change their password after first login.
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
                      onClick={() => { setShowCreateModal(false); setCreatedAccount(null); setShowCreatedPass(false); }}
                      className="px-5 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition"
                    >
                      Done
                    </button>
                  </div>
                </>
              ) : (
                /* ── Form ──────────────────────────────────────────────────── */
                <>
                  <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-7 py-5 rounded-t-3xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-display font-black text-white">Create Username Account</h3>
                        <p className="text-emerald-100 text-xs mt-0.5">No email needed — user logs in with username + password</p>
                      </div>
                      <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1 px-7 py-5 space-y-4">
                    {/* Display Name */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">Full Name <span className="text-red-500">*</span></label>
                      <input
                        type="text" value={createForm.displayName}
                        onChange={e => { setCreateForm(f => ({ ...f, displayName: e.target.value })); setCreateErrors(e => ({ ...e, displayName: '' })); }}
                        placeholder="John Doe"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                      />
                      {createErrors.displayName && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{createErrors.displayName}</p>}
                    </div>

                    {/* Username */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">Username <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray/50 pointer-events-none" />
                        <input
                          type="text" value={createForm.username}
                          onChange={e => { setCreateForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })); setCreateErrors(e => ({ ...e, username: '' })); }}
                          placeholder="john_doe"
                          className={cn('w-full border rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all',
                            createUsnStatus === 'taken' || createErrors.username ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-church-blue/20')}
                        />
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                          {createUsnStatus === 'checking'  && <Loader2 className="w-4 h-4 animate-spin text-church-blue" />}
                          {createUsnStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          {createUsnStatus === 'taken'     && <XCircle className="w-4 h-4 text-red-500" />}
                        </div>
                      </div>
                      {createErrors.username && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{createErrors.username}</p>}
                      {createUsnStatus === 'available' && !createErrors.username && <p className="text-emerald-500 text-xs mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Username available</p>}
                    </div>

                    {/* Role */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-2">Role</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([UserRole.ADMIN, UserRole.DEPARTMENT_HEAD] as const).map(r => (
                          <button key={r} type="button"
                            onClick={() => setCreateForm(f => ({ ...f, role: r }))}
                            className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm font-bold transition-all',
                              createForm.role === r ? 'bg-church-blue/5 border-church-blue text-church-blue' : 'bg-white border-gray-200 text-church-gray hover:border-church-blue/30')}
                          >
                            <div className={cn('w-3 h-3 rounded-full border-2', createForm.role === r ? 'bg-church-blue border-church-blue' : 'border-gray-300')} />
                            {r === UserRole.ADMIN ? 'Admin' : 'Dept Head'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Module access (Admin only) */}
                    {createForm.role === UserRole.ADMIN && (
                      <ModuleGrid selected={createForm.allowedModules} onChange={mods => setCreateForm(f => ({ ...f, allowedModules: mods }))} />
                    )}

                    {/* Default password */}
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">Default Password</label>
                      <div className="relative">
                        <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray/50 pointer-events-none" />
                        <input
                          type={showCreatedPass ? 'text' : 'password'}
                          value={createForm.password}
                          onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl pl-10 pr-20 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <button type="button" onClick={() => setShowCreatedPass(v => !v)} className="p-1 text-church-gray hover:text-church-black">
                            {showCreatedPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button type="button" onClick={() => setCreateForm(f => ({ ...f, password: generateDefaultPassword() }))} className="text-[10px] text-church-blue font-bold hover:underline">
                            New
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-church-gray mt-1">User should change this after first login.</p>
                    </div>
                  </div>

                  <div className="px-7 py-5 border-t border-gray-100 flex gap-3">
                    <button
                      onClick={handleCreateAccount}
                      disabled={creatingAccount || createUsnStatus === 'taken' || createUsnStatus === 'checking'}
                      className="flex-1 bg-emerald-600 disabled:opacity-50 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition"
                    >
                      {creatingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <AtSign className="w-4 h-4" />}
                      Create Account
                    </button>
                    <button onClick={() => setShowCreateModal(false)} className="px-5 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Group modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showGroupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-gray-100">
                <h3 className="font-display font-black text-xl">
                  {editingGroup ? 'Edit Group' : 'Create New Group'}
                </h3>
                <button onClick={() => setShowGroupModal(false)} className="p-2 rounded-xl bg-church-soft text-church-gray hover:text-church-blue">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-7 py-5 space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-church-gray mb-1.5">
                    Group Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={groupForm.name}
                    onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Finance Team, Events Crew"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                  />
                </div>

                <ModuleGrid
                  selected={groupForm.modules}
                  onChange={modules => setGroupForm(p => ({ ...p, modules }))}
                />
              </div>

              <div className="px-7 py-5 border-t border-gray-100 flex gap-3">
                <button
                  onClick={saveGroup}
                  disabled={savingGroup || !groupForm.name.trim()}
                  className="flex-1 bg-church-blue disabled:opacity-50 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-church-blue/90 transition"
                >
                  {savingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingGroup ? 'Save Changes' : 'Create Group'}
                </button>
                <button
                  onClick={() => setShowGroupModal(false)}
                  className="px-5 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
