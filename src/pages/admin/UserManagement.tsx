/**
 * User Management — comprehensive admin page for creating, viewing, editing
 * permissions, enabling/disabling, and deleting church admin users.
 *
 * Access guard: users:view action OR isSuperAdmin
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, ShieldX, Search, Plus, Save, X, Trash2, Check,
  Loader2, AlertCircle, ChevronDown, UserCog, AtSign,
  KeyRound, Eye, EyeOff, CheckCircle2, XCircle, Copy,
  ShieldCheck, Building2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import {
  collection, query, where, onSnapshot, setDoc, doc,
  deleteDoc, getDocs,
} from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { useAuth } from '@/src/components/AuthContext';
import { AppUser, UserRole, AccountStatus } from '@/src/types';
import {
  MODULE_DEFS, ACTION_DEFS, ALL_MODULE_IDS,
  suggestActionsForDepartment, ActionId,
} from '@/src/lib/permissions';
import { logAudit, AUDIT_ACTIONS } from '@/src/lib/audit';
import { cn } from '@/src/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  [UserRole.SUPER_ADMIN]:    'Super Admin',
  [UserRole.ADMIN]:          'Admin',
  [UserRole.DEPARTMENT_HEAD]:'Dept Head',
  [UserRole.MEMBER]:         'Member',
  [UserRole.PLATFORM_OWNER]: 'Platform Owner',
};

const ROLE_COLORS: Record<string, string> = {
  [UserRole.SUPER_ADMIN]:    'bg-church-yellow text-church-black',
  [UserRole.ADMIN]:          'bg-church-blue/10 text-church-blue',
  [UserRole.DEPARTMENT_HEAD]:'bg-emerald-100 text-emerald-700',
  [UserRole.MEMBER]:         'bg-gray-100 text-gray-600',
  [UserRole.PLATFORM_OWNER]: 'bg-violet-100 text-violet-700',
};

const AVATAR_BG: Record<string, string> = {
  [UserRole.SUPER_ADMIN]:    'bg-church-yellow',
  [UserRole.ADMIN]:          'bg-church-blue',
  [UserRole.DEPARTMENT_HEAD]:'bg-emerald-600',
  [UserRole.MEMBER]:         'bg-gray-400',
  [UserRole.PLATFORM_OWNER]: 'bg-violet-600',
};

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-emerald-100 text-emerald-700',
  disabled: 'bg-red-100 text-red-600',
  pending:  'bg-church-yellow/20 text-church-black',
};

type FilterTab = 'all' | 'admins' | 'deptHeads' | 'members' | 'disabled';

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

async function createUsernameAccount(opts: {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  churchId: string;
  department: string;
  allowedModules: string[];
  allowedActions: string[];
  createdBy: string;
}): Promise<string> {
  const { username, displayName, password, role, churchId, department, allowedModules, allowedActions, createdBy } = opts;
  const usernameLower = username.toLowerCase().trim();
  const internalEmail = `${usernameLower}@graceflow.internal`;

  const apiKey = (auth.app.options as Record<string, string>).apiKey;
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
    const msg: string = data.error?.message ?? 'Failed to create account';
    throw new Error(msg === 'EMAIL_EXISTS' ? 'Username is already taken.' : msg);
  }
  const uid: string = data.localId;

  await setDoc(doc(db, 'usernames', usernameLower), {
    uid,
    email: internalEmail,
    createdAt: new Date().toISOString(),
  });

  await setDoc(doc(db, 'users', uid), {
    uid,
    email: internalEmail,
    displayName: displayName.trim(),
    username: usernameLower,
    role,
    churchId,
    department: department.trim() || null,
    allowedModules,
    allowedActions,
    authProvider: 'username',
    accountStatus: 'active' as AccountStatus,
    createdAt: new Date().toISOString(),
    createdBy,
  });

  return uid;
}

// ─── Module checkbox grid ─────────────────────────────────────────────────────

function ModuleGrid({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (m: string[]) => void;
  disabled?: boolean;
}) {
  const all = selected.length === ALL_MODULE_IDS.length;
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(m => m !== id) : [...selected, id]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-black uppercase tracking-wider text-church-gray">Module Access</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(all ? [] : [...ALL_MODULE_IDS])}
          className="text-xs font-bold text-church-blue hover:underline disabled:opacity-40"
        >
          {all ? 'Remove All' : 'Grant All'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {MODULE_DEFS.map(m => {
          const checked = selected.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(m.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all text-xs',
                checked
                  ? 'bg-church-blue/5 border-church-blue/30 text-church-blue'
                  : 'bg-white border-gray-100 text-church-gray hover:border-church-blue/20',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <div className={cn(
                'w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0',
                checked ? 'bg-church-blue border-church-blue' : 'border-gray-300',
              )}>
                {checked && <Check className="w-2 h-2 text-white" />}
              </div>
              <span className="truncate font-semibold">{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Action grid ──────────────────────────────────────────────────────────────

function ActionGrid({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (a: string[]) => void;
}) {
  const allChecked = selected.length === ACTION_DEFS.length;
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const byModule = Array.from(new Set(ACTION_DEFS.map(a => a.moduleId)));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-black uppercase tracking-wider text-church-gray">Action Permissions</p>
        <button
          type="button"
          onClick={() => onChange(allChecked ? [] : ACTION_DEFS.map(a => a.id))}
          className="text-xs font-bold text-church-blue hover:underline"
        >
          {allChecked ? 'Remove All' : 'Grant All'}
        </button>
      </div>
      <div className="space-y-2">
        {byModule.map(mid => {
          const mod = MODULE_DEFS.find(m => m.id === mid);
          const actions = ACTION_DEFS.filter(a => a.moduleId === mid);
          return (
            <div key={mid} className="bg-church-soft rounded-xl p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-church-gray mb-2">
                {mod?.label ?? mid}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {actions.map(a => {
                  const checked = selected.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggle(a.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all',
                        checked
                          ? 'bg-church-blue/5 border-church-blue/30 text-church-blue'
                          : 'bg-white border-gray-100 text-church-gray hover:border-church-blue/20',
                      )}
                    >
                      <div className={cn(
                        'w-3 h-3 rounded border flex items-center justify-center flex-shrink-0',
                        checked ? 'bg-church-blue border-church-blue' : 'border-gray-300',
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
  );
}

// ─── Edit Permissions Panel ───────────────────────────────────────────────────

interface EditPanelProps {
  target: AppUser;
  churchId: string;
  currentUser: AppUser;
  onClose: () => void;
}

function EditPermissionsPanel({ target, churchId, currentUser, onClose }: EditPanelProps) {
  const [role, setRole] = useState<UserRole>(target.role as UserRole);
  const [department, setDepartment] = useState(target.department ?? '');
  const [isAccountant, setIsAccountant] = useState(
    (target as AppUser & { isAccountant?: boolean }).isAccountant ?? false
  );
  const [isDepartmentHead, setIsDepartmentHead] = useState(
    (target as AppUser & { isDepartmentHead?: boolean }).isDepartmentHead ?? false
  );
  const [modules, setModules] = useState<string[]>(target.allowedModules ?? [...ALL_MODULE_IDS]);
  const [actions, setActions] = useState<string[]>(target.allowedActions ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const applyPreset = () => {
    if (!department.trim()) return;
    const preset = suggestActionsForDepartment(department);
    setActions(preset as string[]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', target.uid),
        {
          role,
          department: department.trim() || null,
          isAccountant,
          isDepartmentHead,
          allowedModules: modules,
          allowedActions: actions,
          permissionsUpdatedBy: currentUser.uid,
          permissionsUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      await logAudit(churchId, currentUser, {
        module: 'users',
        action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
        entityType: 'user',
        entityId: target.uid,
        details: `Updated role/permissions for ${target.displayName} → ${role}`,
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch (e) {
      console.error(e);
      alert('Failed to save permissions.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-church-blue to-church-blue/80 px-6 py-5 flex items-center gap-3">
        <div className={cn(
          'w-11 h-11 rounded-full flex items-center justify-center font-black text-white text-lg flex-shrink-0',
          AVATAR_BG[target.role] ?? 'bg-church-blue',
        )}>
          {target.displayName?.charAt(0) ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold truncate">{target.displayName}</p>
          <p className="text-blue-200 text-xs truncate">
            {target.username ? `@${target.username}` : target.email}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* Role */}
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-church-gray mb-2">Role</p>
          <div className="grid grid-cols-3 gap-2">
            {([UserRole.ADMIN, UserRole.DEPARTMENT_HEAD, UserRole.MEMBER] as const).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  'flex flex-col items-center py-3 px-2 rounded-xl border text-center text-xs font-bold transition-all',
                  role === r
                    ? 'bg-church-blue/5 border-church-blue text-church-blue'
                    : 'bg-white border-gray-200 text-church-gray hover:border-church-blue/30',
                )}
              >
                <div className={cn(
                  'w-3 h-3 rounded-full border-2 mb-1',
                  role === r ? 'bg-church-blue border-church-blue' : 'border-gray-300',
                )} />
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Department */}
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">
            Department
          </p>
          <div className="flex gap-2">
            <input
              value={department}
              onChange={e => setDepartment(e.target.value)}
              placeholder="e.g. Finance, HR, Administration"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
            />
            <button
              type="button"
              onClick={applyPreset}
              disabled={!department.trim()}
              title="Use department preset"
              className="px-3 py-2.5 bg-church-blue/10 text-church-blue rounded-xl text-xs font-bold hover:bg-church-blue/20 transition disabled:opacity-40"
            >
              Preset
            </button>
          </div>
          <p className="text-[10px] text-church-gray mt-1">
            Click "Preset" to auto-fill action permissions for this department.
          </p>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setIsDepartmentHead(v => !v)}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl border transition-all',
              isDepartmentHead
                ? 'bg-church-blue/5 border-church-blue/30'
                : 'bg-white border-gray-200 hover:border-church-blue/20',
            )}
          >
            {isDepartmentHead
              ? <ToggleRight className="w-5 h-5 text-church-blue flex-shrink-0" />
              : <ToggleLeft className="w-5 h-5 text-gray-300 flex-shrink-0" />}
            <div className="text-left">
              <p className="text-xs font-bold text-church-black">Dept Head</p>
              <p className="text-[10px] text-church-gray">HOD privileges</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setIsAccountant(v => !v)}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl border transition-all',
              isAccountant
                ? 'bg-church-blue/5 border-church-blue/30'
                : 'bg-white border-gray-200 hover:border-church-blue/20',
            )}
          >
            {isAccountant
              ? <ToggleRight className="w-5 h-5 text-church-blue flex-shrink-0" />
              : <ToggleLeft className="w-5 h-5 text-gray-300 flex-shrink-0" />}
            <div className="text-left">
              <p className="text-xs font-bold text-church-black">Accountant</p>
              <p className="text-[10px] text-church-gray">Finance approval</p>
            </div>
          </button>
        </div>

        {/* Module Access */}
        <ModuleGrid selected={modules} onChange={setModules} />

        {/* Action Permissions */}
        <ActionGrid selected={actions} onChange={setActions} />
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-church-blue text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-church-blue/90 transition disabled:opacity-60"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : saved ? (
            <><Check className="w-4 h-4" /> Saved!</>
          ) : (
            <><Save className="w-4 h-4" /> Save Permissions</>
          )}
        </button>
        <button
          onClick={onClose}
          className="px-5 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────────

interface CreateModalProps {
  churchId: string;
  currentUser: AppUser;
  onClose: () => void;
  onCreated: () => void;
}

function CreateUserModal({ churchId, currentUser, onClose, onCreated }: CreateModalProps) {
  const [form, setForm] = useState({
    displayName: '',
    username: '',
    role: UserRole.ADMIN as UserRole,
    department: '',
    allowedModules: [...ALL_MODULE_IDS] as string[],
    allowedActions: [] as string[],
    password: generateDefaultPassword(),
  });
  const [usnStatus, setUsnStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [credCopied, setCredCopied] = useState(false);
  const usnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (usnTimer.current) clearTimeout(usnTimer.current);
    const uname = form.username.trim().toLowerCase();
    if (!uname || uname.length < 2) { setUsnStatus('idle'); return; }
    setUsnStatus('checking');
    usnTimer.current = setTimeout(async () => {
      const avail = await checkUsernameAvailable(uname);
      setUsnStatus(avail ? 'available' : 'taken');
    }, 500);
    return () => { if (usnTimer.current) clearTimeout(usnTimer.current); };
  }, [form.username]);

  const handleCreate = async () => {
    const errs: Record<string, string> = {};
    if (!form.displayName.trim()) errs.displayName = 'Full name is required.';
    if (form.username.trim().length < 2) errs.username = 'Username must be at least 2 characters.';
    if (usnStatus === 'taken') errs.username = 'Username already taken.';
    if (usnStatus === 'checking') errs.username = 'Please wait for the availability check.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setCreating(true);
    try {
      await createUsernameAccount({
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        password: form.password,
        role: form.role,
        churchId,
        department: form.department,
        allowedModules: form.allowedModules,
        allowedActions: form.allowedActions,
        createdBy: currentUser.uid,
      });
      await logAudit(churchId, currentUser, {
        module: 'users',
        action: AUDIT_ACTIONS.USER_CREATED,
        entityType: 'user',
        details: `Created user account @${form.username.trim().toLowerCase()} (${form.role})`,
      });
      setCreated({ username: form.username.trim().toLowerCase(), password: form.password });
      onCreated();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (msg.includes('Username')) setErrors({ username: msg });
      else alert('Failed to create account: ' + msg);
    } finally {
      setCreating(false);
    }
  };

  const copyCredentials = () => {
    if (!created) return;
    navigator.clipboard.writeText(
      `GraceFlow Login\nUsername: ${created.username}\nPassword: ${created.password}\nURL: ${window.location.origin}`
    );
    setCredCopied(true);
    setTimeout(() => setCredCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]"
      >
        {created ? (
          /* Success screen */
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
                    <p className="font-mono font-black text-xl text-church-black tracking-wider">
                      {created.username}
                    </p>
                  </div>
                  <AtSign className="w-8 h-8 text-church-blue/20" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-church-gray mb-0.5">
                      Default Password
                    </p>
                    <p className={cn(
                      'font-mono font-black text-xl text-church-black tracking-wider',
                      !showPass && 'blur-sm select-none',
                    )}>
                      {created.password}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPass(v => !v)}
                    className="p-2 rounded-xl hover:bg-church-blue/5 text-church-gray"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="bg-church-yellow/10 border border-church-yellow rounded-xl px-4 py-3 text-xs text-church-black">
                <strong>How to log in:</strong> Visit the app → "Sign In" → choose "Username" →
                enter the username and password above. The user should change their password after first login.
              </div>
            </div>

            <div className="px-7 py-5 border-t border-gray-100 flex gap-3">
              <button
                onClick={copyCredentials}
                className={cn(
                  'flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
                  credCopied ? 'bg-emerald-500 text-white' : 'bg-church-blue text-white hover:bg-church-blue/90',
                )}
              >
                {credCopied
                  ? <><Check className="w-4 h-4" /> Copied!</>
                  : <><Copy className="w-4 h-4" /> Copy Login Details</>}
              </button>
              <button
                onClick={onClose}
                className="px-5 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          /* Form */
          <>
            <div className="bg-gradient-to-r from-church-blue to-church-blue/80 px-7 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-display font-black text-white">Create User Account</h3>
                  <p className="text-blue-200 text-xs mt-0.5">User logs in with username + password</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-7 py-5 space-y-4">
              {/* Display Name */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={e => { setForm(f => ({ ...f, displayName: e.target.value })); setErrors(p => ({ ...p, displayName: '' })); }}
                  placeholder="John Doe"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                />
                {errors.displayName && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />{errors.displayName}
                  </p>
                )}
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">
                  Username <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray/50 pointer-events-none" />
                  <input
                    type="text"
                    value={form.username}
                    onChange={e => {
                      setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }));
                      setErrors(p => ({ ...p, username: '' }));
                    }}
                    placeholder="john_doe"
                    className={cn(
                      'w-full border rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all',
                      usnStatus === 'taken' || errors.username
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-200 focus:ring-church-blue/20',
                    )}
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {usnStatus === 'checking'  && <Loader2 className="w-4 h-4 animate-spin text-church-blue" />}
                    {usnStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {usnStatus === 'taken'     && <XCircle className="w-4 h-4 text-red-500" />}
                  </div>
                </div>
                {errors.username && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />{errors.username}
                  </p>
                )}
                {usnStatus === 'available' && !errors.username && (
                  <p className="text-emerald-500 text-xs mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Username available
                  </p>
                )}
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-2">Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {([UserRole.ADMIN, UserRole.DEPARTMENT_HEAD, UserRole.MEMBER] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, role: r }))}
                      className={cn(
                        'flex flex-col items-center py-2.5 px-2 rounded-xl border text-center text-xs font-bold transition-all',
                        form.role === r
                          ? 'bg-church-blue/5 border-church-blue text-church-blue'
                          : 'bg-white border-gray-200 text-church-gray hover:border-church-blue/30',
                      )}
                    >
                      <div className={cn(
                        'w-3 h-3 rounded-full border-2 mb-1',
                        form.role === r ? 'bg-church-blue border-church-blue' : 'border-gray-300',
                      )} />
                      {r === UserRole.ADMIN ? 'Admin' : r === UserRole.DEPARTMENT_HEAD ? 'Dept Head' : 'Member'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">
                  Department
                </label>
                <input
                  type="text"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  placeholder="e.g. Finance, HR, Communications"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                />
              </div>

              {/* Module Access */}
              <ModuleGrid
                selected={form.allowedModules}
                onChange={mods => setForm(f => ({ ...f, allowedModules: mods }))}
              />

              {/* Password */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-church-gray mb-1.5">
                  Default Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray/50 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-20 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="p-1 text-church-gray hover:text-church-black"
                    >
                      {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, password: generateDefaultPassword() }))}
                      className="text-[10px] text-church-blue font-bold hover:underline"
                    >
                      New
                    </button>
                  </div>
                </div>
                <p className="text-xs text-church-gray mt-1">User should change this after first login.</p>
              </div>
            </div>

            <div className="px-7 py-5 border-t border-gray-100 flex gap-3">
              <button
                onClick={handleCreate}
                disabled={creating || usnStatus === 'taken' || usnStatus === 'checking'}
                className="flex-1 bg-church-blue disabled:opacity-50 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-church-blue/90 transition"
              >
                {creating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                  : <><Plus className="w-4 h-4" /> Create Account</>}
              </button>
              <button
                onClick={onClose}
                className="px-5 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────

interface UserCardProps {
  u: AppUser;
  isSelf: boolean;
  canCreate: boolean;
  isSuperAdmin: boolean;
  currentUser: AppUser;
  churchId: string;
  onEditPermissions: (u: AppUser) => void;
  onRefresh: () => void;
}

function UserCard({
  u,
  isSelf,
  isSuperAdmin,
  currentUser,
  churchId,
  onEditPermissions,
  onRefresh,
}: UserCardProps) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const status: AccountStatus = (u.accountStatus ?? 'active') as AccountStatus;
  const isDisabled = status === 'disabled';

  const toggleStatus = async () => {
    if (!currentUser) return;
    setToggling(true);
    try {
      const newStatus: AccountStatus = isDisabled ? 'active' : 'disabled';
      await setDoc(doc(db, 'users', u.uid), { accountStatus: newStatus }, { merge: true });

      // Call server API to mirror Firebase Auth disabled state
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        const endpoint = isDisabled ? '/api/auth/enable-user' : '/api/auth/disable-user';
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ uid: u.uid }),
        }).catch(() => null); // non-fatal if API not available
      }

      await logAudit(churchId, currentUser, {
        module: 'users',
        action: isDisabled ? AUDIT_ACTIONS.USER_ENABLED : AUDIT_ACTIONS.USER_DISABLED,
        entityType: 'user',
        entityId: u.uid,
        details: `${isDisabled ? 'Enabled' : 'Disabled'} account for ${u.displayName}`,
      });
    } catch (e) {
      console.error(e);
      alert('Failed to update account status.');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!isSuperAdmin || isSelf) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'users', u.uid));
      await logAudit(churchId, currentUser, {
        module: 'users',
        action: AUDIT_ACTIONS.USER_DISABLED,
        entityType: 'user',
        entityId: u.uid,
        details: `Deleted user account for ${u.displayName}`,
      });
      setConfirmDelete(false);
      onRefresh();
    } catch (e) {
      console.error(e);
      alert('Failed to delete user.');
    } finally {
      setDeleting(false);
    }
  };

  const moduleCount = u.allowedModules == null ? ALL_MODULE_IDS.length : u.allowedModules.length;
  const actionCount = u.allowedActions?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all',
        isDisabled ? 'border-red-100 opacity-75' : 'border-church-blue/8 hover:border-church-blue/20',
      )}
    >
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          {/* Avatar */}
          <div className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg flex-shrink-0',
            AVATAR_BG[u.role] ?? 'bg-church-blue',
          )}>
            {u.displayName?.charAt(0)?.toUpperCase() ?? '?'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-church-black text-sm truncate">{u.displayName}</p>
              {isSelf && (
                <span className="text-[9px] bg-church-yellow text-church-black px-1.5 py-0.5 rounded font-black uppercase">
                  You
                </span>
              )}
            </div>
            {u.username && (
              <p className="text-xs text-church-blue font-mono">@{u.username}</p>
            )}
            <p className="text-xs text-church-gray truncate">{u.email}</p>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide', ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600')}>
            {ROLE_LABELS[u.role] ?? u.role}
          </span>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', STATUS_STYLES[status])}>
            {status}
          </span>
        </div>

        {/* Department */}
        {u.department && (
          <div className="flex items-center gap-1.5 mb-3">
            <Building2 className="w-3 h-3 text-church-gray flex-shrink-0" />
            <span className="text-xs text-church-gray truncate">{u.department}</span>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-church-soft rounded-xl py-2">
            <p className="text-sm font-black text-church-blue">{moduleCount}</p>
            <p className="text-[9px] text-church-gray uppercase tracking-wide font-bold">Modules</p>
          </div>
          <div className="bg-church-soft rounded-xl py-2">
            <p className="text-sm font-black text-church-blue">{actionCount}</p>
            <p className="text-[9px] text-church-gray uppercase tracking-wide font-bold">Actions</p>
          </div>
          <div className="bg-church-soft rounded-xl py-2">
            <p className="text-[10px] font-black text-church-black">
              {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
            </p>
            <p className="text-[9px] text-church-gray uppercase tracking-wide font-bold">Last Login</p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="border-t border-gray-50 px-4 py-3 flex gap-2">
        <button
          onClick={() => onEditPermissions(u)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-church-blue/5 text-church-blue text-xs font-bold hover:bg-church-blue/10 transition"
        >
          <UserCog className="w-3.5 h-3.5" />
          Permissions
        </button>

        <button
          onClick={toggleStatus}
          disabled={toggling}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition',
            isDisabled
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'bg-red-50 text-red-600 hover:bg-red-100',
            toggling && 'opacity-60',
          )}
        >
          {toggling ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isDisabled ? (
            <><ToggleRight className="w-3.5 h-3.5" /> Enable</>
          ) : (
            <><ToggleLeft className="w-3.5 h-3.5" /> Disable</>
          )}
        </button>

        {isSuperAdmin && !isSelf && (
          confirmDelete ? (
            <div className="flex gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2.5 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-2 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition"
              title="Delete user"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UserManagement() {
  const { user, churchId, isSuperAdmin, isAdmin, hasAction } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Access guard
  if (!hasAction('users:view') && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-4">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-display font-black text-church-black mb-2">Access Denied</h2>
        <p className="text-church-gray text-sm max-w-sm">
          You don't have permission to view User Management.
          Contact your Super Administrator.
        </p>
      </div>
    );
  }

  // Load users
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!churchId) return;
    setLoading(true);
    const unsubscribe = onSnapshot(
      query(collection(db, 'users'), where('churchId', '==', churchId)),
      snap => {
        const list = snap.docs
          .map(d => d.data() as AppUser)
          .filter(u => u.role !== UserRole.PLATFORM_OWNER);
        setUsers(list);
        setLoading(false);
        setError(null);
      },
      err => {
        console.error(err);
        setError('Failed to load users. Check your permissions.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [churchId, refreshKey]);

  const canCreate = isSuperAdmin || hasAction('users:create');

  // Filter
  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.displayName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q);

    const matchTab =
      tab === 'all' ||
      (tab === 'admins' && (u.role === UserRole.ADMIN || u.role === UserRole.SUPER_ADMIN)) ||
      (tab === 'deptHeads' && u.role === UserRole.DEPARTMENT_HEAD) ||
      (tab === 'members' && u.role === UserRole.MEMBER) ||
      (tab === 'disabled' && u.accountStatus === 'disabled');

    return matchSearch && matchTab;
  });

  const tabCounts: Record<FilterTab, number> = {
    all: users.length,
    admins: users.filter(u => u.role === UserRole.ADMIN || u.role === UserRole.SUPER_ADMIN).length,
    deptHeads: users.filter(u => u.role === UserRole.DEPARTMENT_HEAD).length,
    members: users.filter(u => u.role === UserRole.MEMBER).length,
    disabled: users.filter(u => u.accountStatus === 'disabled').length,
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'admins',   label: 'Admins' },
    { key: 'deptHeads',label: 'Dept Heads' },
    { key: 'members',  label: 'Members' },
    { key: 'disabled', label: 'Disabled' },
  ];

  return (
    <div className="space-y-6 text-church-black">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-church-blue rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-display font-black tracking-tight">User Management</h2>
            <p className="text-church-gray text-sm">
              Manage church user accounts and permissions
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg shadow-emerald-600/20 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create User Account
          </button>
        )}
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1 bg-church-soft p-1 rounded-2xl w-fit flex-wrap">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                tab === key
                  ? 'bg-white text-church-blue shadow-sm'
                  : 'text-church-gray hover:text-church-black',
              )}
            >
              {label}
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-black',
                tab === key ? 'bg-church-blue text-white' : 'bg-gray-200 text-gray-500',
              )}>
                {tabCounts[key]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, username, email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-church-blue/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-church-blue" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
          <p className="text-church-black font-bold">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-church-soft rounded-3xl">
          <Users className="w-12 h-12 text-church-gray/30 mb-3" />
          <p className="text-church-black font-bold text-sm">No users found</p>
          <p className="text-church-gray text-xs mt-1">
            {search ? 'Try a different search term.' : 'No users match this filter yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(u => (
            <UserCard
              key={u.uid}
              u={u}
              isSelf={u.uid === user?.uid}
              canCreate={canCreate}
              isSuperAdmin={isSuperAdmin}
              currentUser={user!}
              churchId={churchId!}
              onEditPermissions={setEditingUser}
              onRefresh={() => setRefreshKey(k => k + 1)}
            />
          ))}
        </div>
      )}

      {/* Edit Permissions Side Panel */}
      <AnimatePresence>
        {editingUser && user && churchId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <EditPermissionsPanel
              target={editingUser}
              churchId={churchId}
              currentUser={user}
              onClose={() => setEditingUser(null)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreateModal && user && churchId && (
          <CreateUserModal
            churchId={churchId}
            currentUser={user}
            onClose={() => setShowCreateModal(false)}
            onCreated={() => setRefreshKey(k => k + 1)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
