/**
 * Audit Trail — system-wide action history viewer.
 *
 * Access guard: hasModule('audit') OR isSuperAdmin
 * Loads churches/{churchId}/auditLogs ordered by timestamp desc, limit 200.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  History, ShieldX, Search, Filter, ChevronDown,
  Loader2, AlertCircle, Clock, User, Package,
  Building2, X, Calendar,
} from 'lucide-react';
import {
  collection, query, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/components/AuthContext';
import { AuditLog } from '@/src/types';
import { MODULE_DEFS } from '@/src/lib/permissions';
import { cn } from '@/src/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

function formatDateOnly(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return '';
  }
}

/** Human-readable action label from dot-notation string */
function actionLabel(action: string): string {
  const map: Record<string, string> = {
    'member.created':               'Member Created',
    'member.updated':               'Member Updated',
    'member.deleted':               'Member Deleted',
    'member.account_disabled':      'Member Account Disabled',
    'member.account_enabled':       'Member Account Enabled',
    'member.password_reset':        'Member Password Reset',
    'requisition.submitted':        'Requisition Submitted',
    'requisition.under_review':     'Requisition Under Review',
    'requisition.admin_approved':   'Requisition Admin Approved',
    'requisition.finance_approved': 'Requisition Finance Approved',
    'requisition.declined':         'Requisition Declined',
    'finance.income_recorded':      'Income Recorded',
    'finance.expense_recorded':     'Expense Recorded',
    'finance.payment_approved':     'Payment Approved',
    'payroll.processed':            'Payroll Processed',
    'payroll.approved':             'Payroll Approved',
    'payroll.salary_paid':          'Salary Paid',
    'user.created':                 'User Account Created',
    'user.role_changed':            'User Permissions Updated',
    'user.disabled':                'User Disabled',
    'user.enabled':                 'User Enabled',
    'event.created':                'Event Created',
    'event.cancelled':              'Event Cancelled',
  };
  return map[action] ?? action.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function moduleLabel(moduleId: string): string {
  return MODULE_DEFS.find(m => m.id === moduleId)?.label ?? moduleId;
}

/** Color chip for a module */
function moduleColor(moduleId: string): string {
  const palette: Record<string, string> = {
    members:        'bg-blue-100 text-blue-700',
    finance:        'bg-emerald-100 text-emerald-700',
    hr:             'bg-violet-100 text-violet-700',
    requisitions:   'bg-church-yellow/20 text-church-black',
    events:         'bg-pink-100 text-pink-700',
    communications: 'bg-cyan-100 text-cyan-700',
    users:          'bg-church-blue/10 text-church-blue',
    audit:          'bg-gray-100 text-gray-600',
    attendance:     'bg-teal-100 text-teal-700',
    dashboard:      'bg-slate-100 text-slate-600',
  };
  return palette[moduleId] ?? 'bg-gray-100 text-gray-600';
}

/** Color dot for an action */
function actionColor(action: string): string {
  if (action.includes('created') || action.includes('enabled'))  return 'bg-emerald-500';
  if (action.includes('deleted') || action.includes('disabled')) return 'bg-red-500';
  if (action.includes('approved') || action.includes('paid'))    return 'bg-church-blue';
  if (action.includes('declined') || action.includes('cancel'))  return 'bg-red-400';
  if (action.includes('updated') || action.includes('changed'))  return 'bg-church-yellow';
  return 'bg-gray-400';
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:    'Super Admin',
  ADMIN:          'Admin',
  DEPARTMENT_HEAD:'Dept Head',
  MEMBER:         'Member',
  PLATFORM_OWNER: 'Platform Owner',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:    'bg-church-yellow text-church-black',
  ADMIN:          'bg-church-blue/10 text-church-blue',
  DEPARTMENT_HEAD:'bg-emerald-100 text-emerald-700',
  MEMBER:         'bg-gray-100 text-gray-600',
  PLATFORM_OWNER: 'bg-violet-100 text-violet-700',
};

// ─── Log Entry Component ──────────────────────────────────────────────────────

interface LogEntryProps {
  log: AuditLog;
  isLast: boolean;
}

function LogEntry({ log, isLast }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = log.details || log.entityId || log.metadata;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-4"
    >
      {/* Timeline stem */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn(
          'w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ring-2 ring-white',
          actionColor(log.action),
        )} />
        {!isLast && <div className="w-px flex-1 bg-gray-100 mt-1" />}
      </div>

      {/* Card */}
      <div className={cn(
        'flex-1 bg-white rounded-2xl border border-church-blue/8 shadow-sm mb-3 overflow-hidden transition-all',
        expanded && 'border-church-blue/20',
      )}>
        <div className="px-4 py-3">
          {/* Top row: timestamp + module chip */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-church-gray">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>{formatTimestamp(log.timestamp)}</span>
            </div>
            <span className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
              moduleColor(log.module),
            )}>
              {moduleLabel(log.module)}
            </span>
          </div>

          {/* Action label */}
          <p className="font-bold text-church-black text-sm mb-2">
            {actionLabel(log.action)}
          </p>

          {/* User info row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-church-blue flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {log.displayName?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-church-black">{log.displayName}</span>
                {log.username && (
                  <span className="text-xs text-church-blue font-mono">@{log.username}</span>
                )}
                <span className={cn(
                  'text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide',
                  ROLE_COLORS[log.role] ?? 'bg-gray-100 text-gray-600',
                )}>
                  {ROLE_LABELS[log.role] ?? log.role}
                </span>
                {log.department && (
                  <span className="flex items-center gap-0.5 text-[10px] text-church-gray">
                    <Building2 className="w-2.5 h-2.5" />{log.department}
                  </span>
                )}
              </div>
            </div>

            {/* Expand toggle */}
            {hasDetails && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="p-1 rounded-lg hover:bg-church-soft text-church-gray transition"
              >
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
              </button>
            )}
          </div>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && hasDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-50 px-4 py-3 bg-church-soft/50 space-y-2"
            >
              {log.details && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-church-gray mb-0.5">Details</p>
                  <p className="text-xs text-church-black">{log.details}</p>
                </div>
              )}
              {log.entityId && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-church-gray mb-0.5">
                    {log.entityType ? `${log.entityType.charAt(0).toUpperCase() + log.entityType.slice(1)} Reference` : 'Entity'}
                  </p>
                  <p className="text-xs font-mono text-church-blue">{log.entityId}</p>
                </div>
              )}
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-church-gray mb-0.5">Metadata</p>
                  <pre className="text-[10px] font-mono text-church-gray bg-white rounded-lg px-3 py-2 overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const { churchId, isSuperAdmin, hasModule } = useAuth();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Access guard
  if (!hasModule('audit') && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-4">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-display font-black text-church-black mb-2">Access Denied</h2>
        <p className="text-church-gray text-sm max-w-sm">
          You don't have permission to view the Audit Trail.
          Contact your Super Administrator.
        </p>
      </div>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!churchId) return;
    setLoading(true);
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'churches', churchId, 'auditLogs'),
        orderBy('timestamp', 'desc'),
        limit(200),
      ),
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
        setLogs(list);
        setLoading(false);
        setError(null);
      },
      err => {
        console.error(err);
        setError('Failed to load audit logs.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [churchId]);

  // Derive unique modules + actions for filter dropdowns
  const uniqueModules = useMemo(
    () => Array.from(new Set(logs.map(l => l.module))).sort(),
    [logs],
  );
  const uniqueActions = useMemo(
    () => Array.from(new Set(logs.map(l => l.action))).sort(),
    [logs],
  );

  // Apply filters
  const filtered = useMemo(() => {
    return logs.filter(log => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        log.displayName?.toLowerCase().includes(q) ||
        log.username?.toLowerCase().includes(q) ||
        log.details?.toLowerCase().includes(q) ||
        log.entityId?.toLowerCase().includes(q);

      const matchModule = !moduleFilter || log.module === moduleFilter;
      const matchAction = !actionFilter || log.action === actionFilter;

      const ts = log.timestamp.slice(0, 10); // YYYY-MM-DD
      const matchFrom = !dateFrom || ts >= dateFrom;
      const matchTo   = !dateTo   || ts <= dateTo;

      return matchSearch && matchModule && matchAction && matchFrom && matchTo;
    });
  }, [logs, search, moduleFilter, actionFilter, dateFrom, dateTo]);

  const hasActiveFilters = moduleFilter || actionFilter || dateFrom || dateTo;

  const clearFilters = () => {
    setModuleFilter('');
    setActionFilter('');
    setDateFrom('');
    setDateTo('');
  };

  // Group filtered logs by date for display
  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: AuditLog[] }[] = [];
    let currentDate = '';
    for (const log of filtered) {
      const d = formatDateOnly(log.timestamp);
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, items: [] });
      }
      groups[groups.length - 1].items.push(log);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-6 text-church-black">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-church-blue rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
          <History className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-display font-black tracking-tight">Audit Trail</h2>
          <p className="text-church-gray text-sm">
            System-wide action history — last 200 records
          </p>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="space-y-3">
        <div className="flex gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by user, details, entity…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-church-blue/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all',
              showFilters || hasActiveFilters
                ? 'bg-church-blue text-white border-church-blue'
                : 'bg-white border-church-blue/10 text-church-gray hover:border-church-blue/30',
            )}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-4 h-4 bg-church-yellow text-church-black rounded-full text-[9px] font-black flex items-center justify-center">
                !
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-bold hover:bg-red-50 transition"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Expanded filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-church-soft rounded-2xl">
                {/* Module filter */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-church-gray mb-1.5">
                    Module
                  </label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-church-gray pointer-events-none" />
                    <select
                      value={moduleFilter}
                      onChange={e => setModuleFilter(e.target.value)}
                      className="w-full appearance-none pl-9 pr-8 py-2.5 bg-white rounded-xl border border-gray-200 text-xs text-church-black focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                    >
                      <option value="">All Modules</option>
                      {uniqueModules.map(m => (
                        <option key={m} value={m}>{moduleLabel(m)}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-church-gray pointer-events-none" />
                  </div>
                </div>

                {/* Action filter */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-church-gray mb-1.5">
                    Action
                  </label>
                  <div className="relative">
                    <select
                      value={actionFilter}
                      onChange={e => setActionFilter(e.target.value)}
                      className="w-full appearance-none px-3 py-2.5 bg-white rounded-xl border border-gray-200 text-xs text-church-black focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                    >
                      <option value="">All Actions</option>
                      {uniqueActions.map(a => (
                        <option key={a} value={a}>{actionLabel(a)}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-church-gray pointer-events-none" />
                  </div>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-church-gray mb-1.5">
                    From
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-church-gray pointer-events-none" />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-white rounded-xl border border-gray-200 text-xs text-church-black focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                    />
                  </div>
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-church-gray mb-1.5">
                    To
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-church-gray pointer-events-none" />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-white rounded-xl border border-gray-200 text-xs text-church-black focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results count */}
      {!loading && !error && (
        <div className="flex items-center justify-between text-xs text-church-gray">
          <span>
            Showing <strong className="text-church-black">{filtered.length}</strong> of{' '}
            <strong className="text-church-black">{logs.length}</strong> records
          </span>
          {filtered.length < logs.length && (
            <span className="text-church-blue font-bold">Filtered</span>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-church-blue" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
          <p className="text-church-black font-bold">{error}</p>
          <p className="text-church-gray text-xs mt-1">
            Make sure the auditLogs collection exists and Firestore rules allow read access.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-church-soft rounded-3xl">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-4 shadow-sm">
            <Clock className="w-10 h-10 text-church-gray/30" />
          </div>
          <p className="font-display font-black text-church-black text-xl mb-1">No Audit Records</p>
          <p className="text-church-gray text-sm max-w-sm">
            {search || hasActiveFilters
              ? 'No records match your current filters. Try clearing them.'
              : 'System actions will appear here as users interact with the platform.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 px-5 py-2.5 bg-church-blue text-white rounded-xl text-sm font-bold hover:bg-church-blue/90 transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        /* Timeline grouped by date */
        <div className="space-y-6">
          {groupedByDate.map(({ date, items }) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 bg-church-blue text-white px-3 py-1.5 rounded-full text-xs font-bold">
                  <Calendar className="w-3 h-3" />
                  {date}
                </div>
                <div className="flex-1 h-px bg-church-blue/10" />
                <span className="text-[10px] text-church-gray font-bold">{items.length} records</span>
              </div>

              {/* Log entries */}
              <div className="pl-2">
                {items.map((log, idx) => (
                  <LogEntry
                    key={log.id}
                    log={log}
                    isLast={idx === items.length - 1 && date === groupedByDate[groupedByDate.length - 1].date}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* End indicator */}
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-church-gray">
            <div className="w-1.5 h-1.5 rounded-full bg-church-blue/30" />
            End of records — showing last {logs.length} entries
            <div className="w-1.5 h-1.5 rounded-full bg-church-blue/30" />
          </div>
        </div>
      )}
    </div>
  );
}
