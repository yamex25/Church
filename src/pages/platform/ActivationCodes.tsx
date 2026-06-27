import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Key, Plus, Copy, Trash2, X, Loader2, Check, CheckCircle,
  Clock, Ban, Search, RefreshCw, Mail, Phone, AlertCircle,
  CheckCircle2, Users, Building2, MessageCircle,
} from 'lucide-react';
import { db } from '@/src/lib/firebase';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy,
} from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import {
  ActivationCode, ActivationCodeStatus,
  SUBSCRIPTION_PLANS, SUBSCRIPTION_DURATIONS,
} from '@/src/types';
import { cn } from '@/src/lib/utils';

// ─── Local types ──────────────────────────────────────────────────────────────

type PageTab = 'requests' | 'codes';
type CodeFilter = 'all' | ActivationCodeStatus;
type ReqFilter = 'all' | 'pending' | 'code_generated' | 'completed' | 'rejected';

interface ActivationRequest {
  id: string;
  churchName: string;
  requesterName: string;
  email: string;
  phone?: string;
  userId?: string;
  status: 'pending' | 'code_generated' | 'completed' | 'rejected';
  generatedCode?: string;
  createdAt: string;
  respondedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCode(): string {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O
  const D = '23456789';                  // no 0 or 1
  const r = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  const parts = [r(L), r(L), r(L), r(D), r(D), r(D)];
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  return parts.join('');
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Status config — requests ─────────────────────────────────────────────────

const REQ_META: Record<ActivationRequest['status'], {
  label: string;
  stripe: string;
  badge: string;
}> = {
  pending:        { label: 'Pending',   stripe: 'bg-church-yellow', badge: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
  code_generated: { label: 'Code Sent', stripe: 'bg-church-blue',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed:      { label: 'Completed', stripe: 'bg-emerald-500',   badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected:       { label: 'Rejected',  stripe: 'bg-red-500',       badge: 'bg-red-50 text-red-600 border-red-200' },
};

// ─── Status config — codes ────────────────────────────────────────────────────

const CODE_META: Record<ActivationCodeStatus, {
  label: string;
  color: string;
  Icon: React.ElementType;
}> = {
  unused:  { label: 'Unused',  color: 'text-church-blue bg-blue-50 border-blue-200',      Icon: Clock },
  used:    { label: 'Used',    color: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: CheckCircle },
  expired: { label: 'Expired', color: 'text-gray-500 bg-gray-50 border-gray-200',         Icon: Check },
  revoked: { label: 'Revoked', color: 'text-red-600 bg-red-50 border-red-200',            Icon: Ban },
};

// ─── RequestCard ──────────────────────────────────────────────────────────────

function RequestCard({ req, userId }: { req: ActivationRequest; userId: string }) {
  const meta = REQ_META[req.status] ?? REQ_META.pending;

  const [generating, setGenerating] = useState(false);
  const [localCode, setLocalCode]   = useState(req.generatedCode ?? '');
  const [copied, setCopied]         = useState('');

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2500);
  };

  /** Build a wa.me deep-link with the activation code and instructions pre-filled. */
  const buildWhatsAppLink = (code: string) => {
    const planName   = (req as any).selectedPlanName ?? 'Standard';
    const duration   = (req as any).selectedDurationMonths
      ? `${(req as any).selectedDurationMonths} month${(req as any).selectedDurationMonths !== 1 ? 's' : ''}`
      : '';
    const totalUGX   = (req as any).totalBillUGX
      ? `UGX ${Number((req as any).totalBillUGX).toLocaleString('en-UG')}` : '';

    const lines = [
      `Hello ${req.requesterName},`,
      '',
      `Your GraceFlow activation code for *${req.churchName}* is ready:`,
      '',
      `*${code}*`,
      '',
      'How to use it:',
      `1. Visit: ${window.location.origin}`,
      '2. Sign in or create your account',
      '3. Choose "Create a Church"',
      '4. Select your plan and duration',
      '5. Enter the code above when prompted',
      '',
      [planName, duration, totalUGX].filter(Boolean).join(' · '),
      '',
      'Thank you for choosing GraceFlow!',
    ];

    const message = encodeURIComponent(lines.join('\n'));
    // Strip non-digits from phone for wa.me
    const phone = req.phone?.replace(/[^0-9]/g, '') ?? '';
    return phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const code = makeCode();
      // Use the plan the requester chose; fall back to standard
      const planId   = (req as any).selectedPlan    ?? 'standard';
      const planName = (req as any).selectedPlanName ?? 'Standard';
      await addDoc(collection(db, 'activationCodes'), {
        code,
        plan: planId,
        planName,
        durationMonths: 6,
        status: 'unused',
        notes: `Auto-generated for ${req.requesterName} — ${req.churchName}`,
        linkedRequestId: req.id,
        generatedAt: new Date().toISOString(),
        generatedBy: userId,
      });
      await updateDoc(doc(db, 'activationRequests', req.id), {
        status: 'code_generated',
        generatedCode: code,
        respondedAt: new Date().toISOString(),
      });
      setLocalCode(code);
    } catch (err) {
      console.error('Code generation error:', err);
      alert('Failed to generate code. Please check your Firestore rules are published.');
    } finally {
      setGenerating(false);
    }
  };

  const handleReject = async () => {
    if (!window.confirm(`Reject request from ${req.requesterName}?`)) return;
    await updateDoc(doc(db, 'activationRequests', req.id), {
      status: 'rejected',
      respondedAt: new Date().toISOString(),
    });
  };

  const handleComplete = async () => {
    await updateDoc(doc(db, 'activationRequests', req.id), {
      status: 'completed',
      respondedAt: new Date().toISOString(),
    });
  };

  const displayCode = localCode || req.generatedCode;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      className="bg-white rounded-2xl border border-church-blue/8 shadow-sm overflow-hidden"
    >
      {/* Colored top stripe */}
      <div className={cn('h-1.5 w-full', meta.stripe)} />

      <div className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-church-blue/8 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-church-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-church-black text-base truncate">{req.churchName}</h3>
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide flex-shrink-0', meta.badge)}>
                {meta.label}
              </span>
            </div>
            <p className="text-church-gray text-xs mt-0.5">
              {req.requesterName} &middot; {fmtDate(req.createdAt)}
            </p>
          </div>
        </div>

        {/* Contact row */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => copy(req.email, 'email')}
            className="flex items-center gap-1.5 bg-church-blue/8 hover:bg-church-blue/15 text-church-blue px-3 py-1.5 rounded-xl text-xs font-bold transition"
            title="Copy email"
          >
            {copied === 'email'
              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              : <Mail className="w-3.5 h-3.5" />}
            {req.email}
          </button>
          {req.phone && (
            <button
              onClick={() => copy(req.phone!, 'phone')}
              className="flex items-center gap-1.5 bg-church-blue/8 hover:bg-church-blue/15 text-church-blue px-3 py-1.5 rounded-xl text-xs font-bold transition"
              title="Copy phone"
            >
              {copied === 'phone'
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                : <Phone className="w-3.5 h-3.5" />}
              {req.phone}
            </button>
          )}
        </div>

        {/* Subscription plan requested */}
        {(req as any).selectedPlanName && (
          <div className="bg-church-soft rounded-xl px-3 py-2.5 space-y-1.5 border-t border-church-soft">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-church-gray">Requested Plan:</span>
              <span className="bg-church-blue text-white px-2.5 py-0.5 rounded-lg text-[11px] font-bold">
                {(req as any).selectedPlanName}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-church-gray">Price:</span>
              {(req as any).selectedPlanPriceUGXLabel && (
                <span className="bg-church-yellow text-church-black px-2.5 py-0.5 rounded-lg text-[11px] font-black">
                  {(req as any).selectedPlanPriceUGXLabel}
                </span>
              )}
              {(req as any).selectedPlanPriceLabel && (
                <span className="bg-church-blue/10 text-church-blue px-2.5 py-0.5 rounded-lg text-[11px] font-bold">
                  {(req as any).selectedPlanPriceLabel}
                </span>
              )}
            </div>
            {(req as any).selectedPlanFeatures?.length > 0 && (
              <p className="text-[10px] text-church-gray">
                Includes: {((req as any).selectedPlanFeatures as string[]).slice(0, 3).join(', ')}
                {(req as any).selectedPlanFeatures.length > 3 ? '…' : ''}
              </p>
            )}
          </div>
        )}

        {/* Generated code display */}
        {displayCode && (
          <div className="bg-church-blue rounded-2xl p-4 space-y-3">
            <p className="text-church-yellow text-[10px] font-black uppercase tracking-widest">
              Activation Code
            </p>
            <div className="flex items-center justify-between gap-3">
              <code className="font-mono font-black text-white text-xl tracking-[0.25em]">
                {displayCode}
              </code>
              <button
                onClick={() => copy(displayCode, 'code')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0',
                  copied === 'code'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-church-yellow text-church-black hover:bg-yellow-300',
                )}
              >
                {copied === 'code'
                  ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</>
                  : <><Copy className="w-3.5 h-3.5" /> Copy Code</>}
              </button>
            </div>

            {/* WhatsApp send button */}
            <a
              href={buildWhatsAppLink(displayCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1ebe59] text-white py-2.5 rounded-xl text-xs font-bold transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              Send Code via WhatsApp
            </a>

            <p className="text-blue-200 text-[11px]">
              WhatsApp will open with the code and instructions pre-filled for {req.requesterName}.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {req.status === 'pending' && (
            <>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 flex items-center justify-center gap-2 bg-church-blue text-white py-2.5 rounded-xl text-xs font-bold hover:bg-church-blue/90 transition disabled:opacity-60"
              >
                {generating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                  : <><Key className="w-3.5 h-3.5" /> Generate Code</>}
              </button>
              <button
                onClick={handleReject}
                className="px-3 py-2.5 bg-red-50 text-red-500 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition"
                title="Reject request"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {req.status === 'code_generated' && (
            <>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-2 bg-church-blue/10 text-church-blue rounded-xl text-xs font-bold hover:bg-church-blue/20 transition disabled:opacity-60"
              >
                {generating
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                New Code
              </button>
              <button
                onClick={handleComplete}
                className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold hover:bg-emerald-600 transition"
              >
                <Check className="w-3.5 h-3.5" />
                Mark Completed
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ActivationCodes() {
  const { user } = useAuth();

  // Tab
  const [tab, setTab] = useState<PageTab>('requests');

  // Requests state
  const [requests, setRequests]     = useState<ActivationRequest[]>([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [reqError, setReqError]     = useState(false);
  const [reqFilter, setReqFilter]   = useState<ReqFilter>('pending');
  const [reqSearch, setReqSearch]   = useState('');

  // Codes state
  const [codes, setCodes]               = useState<ActivationCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(true);
  const [codesError, setCodesError]     = useState(false);
  const [codeFilter, setCodeFilter]     = useState<CodeFilter>('all');
  const [codeSearch, setCodeSearch]     = useState('');
  const [copiedCode, setCopiedCode]     = useState('');

  // Generate modal
  const [showModal, setShowModal]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({ plan: 'standard', duration: 6, notes: '' });

  // ── Firestore subscriptions ────────────────────────────────────────────────

  useEffect(() => {
    const q = query(collection(db, 'activationRequests'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      snap => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivationRequest)));
        setReqLoading(false);
        setReqError(false);
      },
      err => {
        console.error('activationRequests error:', err);
        setReqLoading(false);
        if (err.code === 'permission-denied') setReqError(true);
      },
    );
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'activationCodes'), orderBy('generatedAt', 'desc'));
    return onSnapshot(
      q,
      snap => {
        setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivationCode)));
        setCodesLoading(false);
        setCodesError(false);
      },
      err => {
        console.error('activationCodes error:', err);
        setCodesLoading(false);
        if (err.code === 'permission-denied') setCodesError(true);
      },
    );
  }, []);

  // ── Derived counts ─────────────────────────────────────────────────────────

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const unusedCount  = codes.filter(c => c.status === 'unused').length;

  // ── Filtered lists ─────────────────────────────────────────────────────────

  const filteredReqs = requests.filter(r => {
    const matchFilter = reqFilter === 'all' || r.status === reqFilter;
    const q = reqSearch.toLowerCase();
    const matchSearch = !q ||
      r.churchName.toLowerCase().includes(q) ||
      r.requesterName.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.phone ?? '').includes(q);
    return matchFilter && matchSearch;
  });

  const filteredCodes = codes.filter(c => {
    const matchFilter = codeFilter === 'all' || c.status === codeFilter;
    const q = codeSearch.toLowerCase();
    const matchSearch = !q ||
      c.code.toLowerCase().includes(q) ||
      (c.notes ?? '').toLowerCase().includes(q) ||
      c.planName.toLowerCase().includes(q) ||
      (c.churchName ?? '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  // ── Code actions ───────────────────────────────────────────────────────────

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2500);
  };

  const revokeCode = async (id: string) => {
    if (!window.confirm('Revoke this code? It can no longer be used to activate a church.')) return;
    await updateDoc(doc(db, 'activationCodes', id), { status: 'revoked' });
  };

  const deleteCode = async (id: string) => {
    if (!window.confirm('Permanently delete this activation code?')) return;
    await deleteDoc(doc(db, 'activationCodes', id));
  };

  // ── Generate standalone code ───────────────────────────────────────────────

  const generateStandalone = async () => {
    if (!user) return;
    setGenerating(true);
    const timeout = setTimeout(() => {
      setGenerating(false);
      alert('Request timed out. Please check your connection and Firestore rules.');
    }, 10_000);
    try {
      const code = makeCode();
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === form.plan);
      await addDoc(collection(db, 'activationCodes'), {
        code,
        plan: form.plan,
        planName: plan?.name ?? form.plan,
        durationMonths: form.duration,
        status: 'unused',
        notes: form.notes.trim() || undefined,
        generatedAt: new Date().toISOString(),
        generatedBy: user.uid,
      });
      clearTimeout(timeout);
      setShowModal(false);
      setForm({ plan: 'standard', duration: 6, notes: '' });
      setTab('codes');
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 3000);
    } catch (err) {
      clearTimeout(timeout);
      console.error('Generate error:', err);
      alert('Failed to generate code. Check Firestore rules.');
    } finally {
      setGenerating(false);
    }
  };

  // ─── UI ────────────────────────────────────────────────────────────────────

  const reqFilterButtons = [
    ['all',            'All'],
    ['pending',        'Pending'],
    ['code_generated', 'Code Sent'],
    ['completed',      'Completed'],
    ['rejected',       'Rejected'],
  ] as const;

  const codeFilterButtons = [
    ['all',     'All'],
    ['unused',  'Unused'],
    ['used',    'Used'],
    ['expired', 'Expired'],
    ['revoked', 'Revoked'],
  ] as const;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-black text-church-black">Activation Codes</h1>
          <p className="text-church-gray text-sm mt-0.5">
            Manage registration requests and generate activation codes for Church Spaces.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="flex items-center gap-2 bg-yellow-50 border border-yellow-300 text-yellow-700 px-4 py-2 rounded-xl text-sm font-bold">
            <span className="w-2 h-2 bg-church-yellow rounded-full animate-pulse" />
            {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'}
          </span>
        )}
      </div>

      {/* ── Firestore rules error banner ── */}
      {(reqError || codesError) && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-700 text-sm">
              Cannot load data — Firestore rules not published
            </p>
            <p className="text-red-600 text-xs mt-1">
              The{' '}
              {reqError && <code className="bg-red-100 px-1 rounded">activationRequests</code>}
              {reqError && codesError && ' and '}
              {codesError && <code className="bg-red-100 px-1 rounded">activationCodes</code>}
              {' '}collection rules have not been published to your Firebase database.
            </p>
            <ol className="text-red-600 text-xs mt-2 list-decimal list-inside space-y-0.5">
              <li>Open Firebase Console → Firestore → your database → <strong>Rules</strong></li>
              <li>Paste the contents of your <strong>firestore.rules</strong> file</li>
              <li>Click <strong>Publish</strong>, then refresh this page</li>
            </ol>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-church-blue/8">
        <button
          onClick={() => setTab('requests')}
          className={cn(
            'relative pb-3 px-1 text-sm font-bold transition-colors',
            tab === 'requests' ? 'text-church-blue' : 'text-church-gray hover:text-church-black',
          )}
        >
          <span className="flex items-center gap-2">
            Registration Requests
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full">
                {pendingCount}
              </span>
            )}
          </span>
          {tab === 'requests' && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-church-blue rounded-full"
            />
          )}
        </button>

        <button
          onClick={() => setTab('codes')}
          className={cn(
            'relative pb-3 px-1 ml-4 text-sm font-bold transition-colors',
            tab === 'codes' ? 'text-church-blue' : 'text-church-gray hover:text-church-black',
          )}
        >
          <span className="flex items-center gap-2">
            All Codes
            {unusedCount > 0 && (
              <span className={cn(
                'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black rounded-full',
                tab === 'codes' ? 'bg-church-blue text-white' : 'bg-church-blue/10 text-church-blue',
              )}>
                {unusedCount}
              </span>
            )}
          </span>
          {tab === 'codes' && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-church-blue rounded-full"
            />
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          REQUESTS TAB
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'requests' && (
        <div className="space-y-5">
          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2">
            {reqFilterButtons.map(([key, label]) => {
              const count = key === 'all'
                ? requests.length
                : requests.filter(r => r.status === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setReqFilter(key)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
                    reqFilter === key
                      ? 'bg-church-blue text-white shadow-md'
                      : 'bg-church-soft text-church-gray hover:bg-church-blue/10',
                  )}
                >
                  {label}
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-black',
                    reqFilter === key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600',
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray" />
            <input
              value={reqSearch}
              onChange={e => setReqSearch(e.target.value)}
              placeholder="Search name, church, email, phone…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-church-blue/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
            />
          </div>

          {/* Content */}
          {reqLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-church-blue" />
            </div>
          ) : filteredReqs.length === 0 && !reqError ? (
            <div className="text-center py-16 bg-church-soft rounded-3xl">
              <Users className="w-12 h-12 text-church-gray/30 mx-auto mb-3" />
              <p className="text-church-gray font-medium text-sm">
                {reqSearch || reqFilter !== 'all' ? 'No matching requests' : 'No requests yet'}
              </p>
              <p className="text-church-gray text-xs mt-1">
                Requests appear here when someone fills the form on the Church Setup page.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredReqs.map(req => (
                  <RequestCard key={req.id} req={req} userId={user?.uid ?? ''} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          CODES TAB
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'codes' && (
        <div className="space-y-5">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-wrap gap-2">
              {codeFilterButtons.map(([key, label]) => {
                const count = key === 'all'
                  ? codes.length
                  : codes.filter(c => c.status === key).length;
                return (
                  <button
                    key={key}
                    onClick={() => setCodeFilter(key)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
                      codeFilter === key
                        ? 'bg-church-blue text-white shadow-md'
                        : 'bg-church-soft text-church-gray hover:bg-church-blue/10',
                    )}
                  >
                    {label}
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-black',
                      codeFilter === key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600',
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-church-blue text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-church-blue/90 transition shadow-md"
            >
              <Plus className="w-4 h-4" />
              Generate Code
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray" />
            <input
              value={codeSearch}
              onChange={e => setCodeSearch(e.target.value)}
              placeholder="Search code, plan, church, notes…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-church-blue/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
            />
          </div>

          {/* Code list */}
          {codesLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-church-blue" />
            </div>
          ) : filteredCodes.length === 0 && !codesError ? (
            <div className="text-center py-16 bg-church-soft rounded-3xl">
              <Key className="w-12 h-12 text-church-gray/30 mx-auto mb-3" />
              <p className="text-church-gray font-medium text-sm">
                {codeSearch || codeFilter !== 'all' ? 'No matching codes' : 'No codes generated yet'}
              </p>
              <p className="text-church-gray text-xs mt-1">
                Click "Generate Code" to create an activation code you can share.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-church-blue/8 shadow-sm overflow-hidden">
              <AnimatePresence mode="popLayout">
                {filteredCodes.map((c, idx) => {
                  const meta = CODE_META[c.status] ?? CODE_META.unused;
                  const StatusIcon = meta.Icon;
                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      layout
                      className={cn(
                        'flex items-center gap-4 px-5 py-4 group',
                        idx !== 0 && 'border-t border-church-blue/5',
                        c.status === 'unused' && 'bg-blue-50/30',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <code className={cn(
                            'font-mono font-black text-lg tracking-[0.2em]',
                            c.status === 'unused' ? 'text-church-blue' : 'text-church-gray',
                          )}>
                            {c.code}
                          </code>
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                            meta.color,
                          )}>
                            <StatusIcon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-church-gray font-medium">
                            {c.planName} · {c.durationMonths}mo
                          </span>
                          {c.churchName && (
                            <span className="text-xs text-emerald-600 font-semibold">
                              → {c.churchName}
                            </span>
                          )}
                          {c.notes && (
                            <span className="text-xs text-church-gray/70 italic truncate max-w-[160px]">
                              {c.notes}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-church-gray/60 mt-0.5">
                          Generated {fmtDate(c.generatedAt)}
                          {c.activatedAt && ` · Used ${fmtDate(c.activatedAt)}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyCode(c.code)}
                          title="Copy code"
                          className={cn(
                            'p-2 rounded-lg transition',
                            copiedCode === c.code
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-church-soft hover:bg-church-blue/10 text-church-gray hover:text-church-blue',
                          )}
                        >
                          {copiedCode === c.code
                            ? <CheckCircle2 className="w-4 h-4" />
                            : <Copy className="w-4 h-4" />}
                        </button>

                        {c.status === 'unused' && (
                          <button
                            onClick={() => revokeCode(c.id)}
                            title="Revoke code"
                            className="p-2 rounded-lg bg-church-soft hover:bg-red-50 text-church-gray hover:text-red-500 transition"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}

                        {(c.status === 'revoked' || c.status === 'expired') && (
                          <button
                            onClick={() => deleteCode(c.id)}
                            title="Delete code"
                            className="p-2 rounded-lg bg-church-soft hover:bg-red-50 text-church-gray hover:text-red-500 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          GENERATE STANDALONE MODAL
      ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-church-blue/10 rounded-xl flex items-center justify-center">
                    <Key className="w-5 h-5 text-church-blue" />
                  </div>
                  <div>
                    <h2 className="font-black text-church-black text-base">Generate Activation Code</h2>
                    <p className="text-church-gray text-xs">Create a standalone code to share</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl hover:bg-church-soft text-church-gray transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-church-gray uppercase tracking-wider mb-2">
                  Subscription Plan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SUBSCRIPTION_PLANS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setForm(f => ({ ...f, plan: p.id }))}
                      className={cn(
                        'text-left p-3 rounded-xl border-2 transition-all',
                        form.plan === p.id
                          ? 'border-church-blue bg-church-blue/5 text-church-blue'
                          : 'border-church-blue/10 text-church-gray hover:border-church-blue/30',
                      )}
                    >
                      <span className="block font-black text-sm">{p.name}</span>
                      <span className="block text-[10px] font-semibold opacity-80">{(p as any).priceUGXLabel}</span>
                      <span className="block text-[10px] font-normal opacity-60">{p.priceLabel} · {p.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-church-gray uppercase tracking-wider mb-2">
                  Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {SUBSCRIPTION_DURATIONS.map(d => (
                    <button
                      key={d.months}
                      onClick={() => setForm(f => ({ ...f, duration: d.months }))}
                      className={cn(
                        'py-2 rounded-xl border-2 text-xs font-bold transition-all',
                        form.duration === d.months
                          ? 'border-church-blue bg-church-blue text-white'
                          : 'border-church-blue/10 text-church-gray hover:border-church-blue/30',
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-church-gray uppercase tracking-wider mb-2">
                  Notes (optional)
                </label>
                <input
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. customer name, payment reference…"
                  className="w-full px-4 py-2.5 rounded-xl border border-church-blue/10 bg-church-soft text-sm focus:outline-none focus:ring-2 focus:ring-church-blue/20"
                />
              </div>

              <button
                onClick={generateStandalone}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 bg-church-blue text-white py-3 rounded-xl font-bold text-sm hover:bg-church-blue/90 transition disabled:opacity-60"
              >
                {generating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Key className="w-4 h-4" /> Generate Code</>}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
