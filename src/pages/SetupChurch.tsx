import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Landmark, ArrowRight, LogOut, Users, ShieldCheck,
  CheckCircle2, XCircle, Loader2, ArrowLeft, Building2,
  Hash, Church, MapPin, Phone, Mail, AlertCircle, Clock,
} from 'lucide-react';
import { addDoc, setDoc, updateDoc, getDocs, query, where, collection, runTransaction, doc } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { userDoc } from '@/src/lib/db';
import { UserRole, SUBSCRIPTION_PLANS, SUBSCRIPTION_DURATIONS } from '@/src/types';
import { db } from '@/src/lib/firebase';
import { cn } from '@/src/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'choose' | 'create' | 'plan' | 'activate' | 'join';
type NameStatus = 'idle' | 'checking' | 'available' | 'taken';
type FieldStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
type CodeStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'used' | 'revoked' | 'expired';

interface ValidatedCode {
  id: string;
  plan: string;
  planName: string;
  durationMonths: number;
}
type JoinStatus = 'idle' | 'searching' | 'found' | 'not_found';

interface FoundChurch {
  id: string;
  name: string;
  address?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateChurchCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${rand(3)}-${rand(4)}`;
}

function formatCodeInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (clean.length > 3) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return clean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InputField({
  icon: Icon,
  label,
  required,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ElementType;
  label: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-blue-200 mb-1.5 uppercase tracking-wider">
        {label} {required && <span className="text-church-yellow">*</span>}
      </label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 pointer-events-none" />
        <input
          className={cn(
            'w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-sm text-white',
            'placeholder:text-blue-300/60 focus:outline-none focus:ring-2 focus:ring-church-yellow/50',
            'focus:border-church-yellow/60 transition-all duration-200',
          )}
          {...props}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SetupChurch() {
  const { user, church: existingChurch, isAdmin, logout, refreshUser } = useAuth();

  // Guard: if this user already belongs to a church, send them home.
  // The only legitimate path here is for users who have NO church yet.
  // (Direct URL access, bookmarks, stale redirects — all blocked.)
  if (user && user.churchId) {
    return <Navigate to={isAdmin ? '/admin' : '/portal'} replace />;
  }
  const navigate = useNavigate();
  const nameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [step, setStep] = useState<Step>('choose');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ── Create path state ──────────────────────────────────────────────────────
  const [createForm, setCreateForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [nameStatus, setNameStatus] = useState<NameStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<FieldStatus>('idle');
  const [phoneStatus, setPhoneStatus] = useState<FieldStatus>('idle');
  const [churchCode] = useState<string>(generateChurchCode);

  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Subscription plan selection ───────────────────────────────────────────
  const [selectedPlan, setSelectedPlan] = useState('standard');
  const [selectedDurationMonths, setSelectedDurationMonths] = useState(6);

  // Billing computation
  const activePlanInfo = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
  const totalBillUSD = (activePlanInfo?.price ?? 0) * selectedDurationMonths;
  const totalBillUGX = ((activePlanInfo as any)?.priceUGX ?? 0) * selectedDurationMonths;
  const formattedTotalUGX = `UGX ${totalBillUGX.toLocaleString('en-UG')}`;
  const formattedTotalUSD = totalBillUSD > 0 ? `$${totalBillUSD}` : 'Custom';

  // ── Registration request tracking ─────────────────────────────────────────
  // Auto-created when user reaches the activate step; updated on success
  const [requestId, setRequestId] = useState<string | null>(null);

  // ── Activation code state ─────────────────────────────────────────────────
  const [activationCode, setActivationCode] = useState('');
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('idle');
  const [validatedCode, setValidatedCode] = useState<ValidatedCode | null>(null);
  const codeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Join path state ────────────────────────────────────────────────────────
  const [joinCode, setJoinCode] = useState('');
  const [joinStatus, setJoinStatus] = useState<JoinStatus>('idle');
  const [foundChurch, setFoundChurch] = useState<FoundChurch | null>(null);

  // ── Name uniqueness check (debounced) ─────────────────────────────────────
  const checkName = useCallback(async (name: string) => {
    const clean = name.trim();
    if (clean.length < 3) { setNameStatus('idle'); return; }
    setNameStatus('checking');
    try {
      const snap = await getDocs(query(collection(db, 'churches'), where('nameLower', '==', clean.toLowerCase())));
      setNameStatus(snap.empty ? 'available' : 'taken');
    } catch { setNameStatus('idle'); }
  }, []);

  useEffect(() => {
    if (nameCheckTimer.current) clearTimeout(nameCheckTimer.current);
    nameCheckTimer.current = setTimeout(() => checkName(createForm.name), 600);
    return () => { if (nameCheckTimer.current) clearTimeout(nameCheckTimer.current); };
  }, [createForm.name, checkName]);

  // ── Email uniqueness + format check (debounced) ───────────────────────────
  const checkEmail = useCallback(async (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean) { setEmailStatus('idle'); return; }
    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clean)) { setEmailStatus('invalid'); return; }
    setEmailStatus('checking');
    try {
      const snap = await getDocs(query(collection(db, 'churches'), where('emailLower', '==', clean)));
      setEmailStatus(snap.empty ? 'available' : 'taken');
    } catch { setEmailStatus('idle'); }
  }, []);

  useEffect(() => {
    if (emailTimer.current) clearTimeout(emailTimer.current);
    emailTimer.current = setTimeout(() => checkEmail(createForm.email), 600);
    return () => { if (emailTimer.current) clearTimeout(emailTimer.current); };
  }, [createForm.email, checkEmail]);

  // ── Phone uniqueness check (debounced) ────────────────────────────────────
  const checkPhone = useCallback(async (phone: string) => {
    const clean = phone.trim().replace(/\s+/g, '');
    if (clean.length < 9) { setPhoneStatus('idle'); return; }
    setPhoneStatus('checking');
    try {
      const snap = await getDocs(query(collection(db, 'churches'), where('phone', '==', clean)));
      setPhoneStatus(snap.empty ? 'available' : 'taken');
    } catch { setPhoneStatus('idle'); }
  }, []);

  useEffect(() => {
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    phoneTimer.current = setTimeout(() => checkPhone(createForm.phone), 600);
    return () => { if (phoneTimer.current) clearTimeout(phoneTimer.current); };
  }, [createForm.phone, checkPhone]);

  // ── Activation code live-check (debounced) ────────────────────────────────
  const checkActivationCode = useCallback(async (raw: string) => {
    const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    if (code.length < 6) { setCodeStatus('idle'); setValidatedCode(null); return; }
    setCodeStatus('checking');
    setValidatedCode(null);
    try {
      const snap = await getDocs(query(collection(db, 'activationCodes'), where('code', '==', code)));
      if (snap.empty) { setCodeStatus('invalid'); return; }
      const data = snap.docs[0].data();
      if (data.status === 'used')    { setCodeStatus('used');    return; }
      if (data.status === 'revoked') { setCodeStatus('revoked'); return; }
      if (data.status === 'expired') { setCodeStatus('expired'); return; }
      if (data.status === 'unused') {
        setValidatedCode({ id: snap.docs[0].id, plan: data.plan, planName: data.planName, durationMonths: data.durationMonths });
        setCodeStatus('valid');
      }
    } catch { setCodeStatus('idle'); }
  }, []);

  useEffect(() => {
    if (codeTimer.current) clearTimeout(codeTimer.current);
    codeTimer.current = setTimeout(() => checkActivationCode(activationCode), 700);
    return () => { if (codeTimer.current) clearTimeout(codeTimer.current); };
  }, [activationCode, checkActivationCode]);

  // ── Step 1: Validate form, then proceed to activation step ────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Name validation
    if (!createForm.name.trim()) { setError('Church name is required.'); return; }
    if (nameStatus === 'taken') { setError('That church name is already taken.'); return; }
    if (nameStatus !== 'available') { setError('Please wait for the name check.'); return; }
    // Email validation
    if (!createForm.email.trim()) { setError('Church email address is required.'); return; }
    if (emailStatus === 'invalid') { setError('Please enter a valid email address.'); return; }
    if (emailStatus === 'taken') { setError('That email is already registered to another church.'); return; }
    if (emailStatus !== 'available') { setError('Please wait for the email check.'); return; }
    // Phone validation
    if (!createForm.phone.trim()) { setError('Phone number is required.'); return; }
    if (phoneStatus === 'taken') { setError('That phone number is already registered to another church.'); return; }
    if (phoneStatus !== 'available') { setError('Please wait for the phone check.'); return; }

    setError('');
    // Go to plan selection first — request is created when plan is confirmed
    setStep('plan');
  };

  // ── Confirm plan and create the activation request ─────────────────────────
  const handlePlanContinue = async () => {
    const planInfo = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
    try {
      const reqRef = await addDoc(collection(db, 'activationRequests'), {
        churchName: createForm.name.trim(),
        requesterName: user?.displayName || 'Unknown',
        email: createForm.email.trim().toLowerCase(),
        phone: createForm.phone.trim(),
        userId: user?.uid || '',
        selectedPlan,
        selectedPlanName: planInfo?.name ?? selectedPlan,
        selectedPlanPrice: planInfo?.price ?? 0,
        selectedPlanPriceLabel: planInfo?.priceLabel ?? '',
        selectedPlanPriceUGX: (planInfo as any)?.priceUGX ?? 0,
        selectedPlanPriceUGXLabel: (planInfo as any)?.priceUGXLabel ?? '',
        selectedPlanFeatures: planInfo ? [...planInfo.features] : [],
        selectedDurationMonths,
        totalBillUGX,
        totalBillUSD,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      setRequestId(reqRef.id);
    } catch (e) {
      console.warn('Could not create activation request:', e);
    }
    setStep('activate');
  };

  // ── Step 2: Validate code + create church (Firestore transaction) ─────────
  const handleActivate = async () => {
    if (!user || !validatedCode) return;
    setSubmitting(true);
    setError('');
    try {
      const cleanPhone = createForm.phone.trim().replace(/\s+/g, '');
      const cleanEmail = createForm.email.trim().toLowerCase();
      const now = new Date();

      // Calculate expiry date from duration
      const expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + validatedCode.durationMonths);

      // Atomic transaction: verify code is still valid + create church + mark code used
      const codeRef = doc(db, 'activationCodes', validatedCode.id);
      let churchId_: string;

      await runTransaction(db, async (tx) => {
        const codeSnap = await tx.get(codeRef);
        if (!codeSnap.exists() || codeSnap.data().status !== 'unused') {
          throw new Error('INVALID_CODE');
        }

        // Create church
        const churchRef = doc(collection(db, 'churches'));
        churchId_ = churchRef.id;
        tx.set(churchRef, {
          name: createForm.name.trim(),
          nameLower: createForm.name.trim().toLowerCase(),
          address: createForm.address.trim(),
          phone: cleanPhone,
          email: cleanEmail,
          emailLower: cleanEmail,
          churchCode,
          subscriptionPlan: validatedCode.plan,
          subscriptionStatus: 'active',
          subscriptionStartDate: now.toISOString(),
          subscriptionExpiryDate: expiry.toISOString(),
          activationCodeId: validatedCode.id,
          status: 'active',
          createdAt: now.toISOString(),
          createdBy: user.uid,
        });

        // Mark code as used
        tx.update(codeRef, {
          status: 'used',
          activatedAt: now.toISOString(),
          expiresAt: expiry.toISOString(),
          churchId: churchId_!,
          churchName: createForm.name.trim(),
        });
      });

      // Update user profile
      await setDoc(userDoc(user.uid), {
        churchId: churchId_!,
        role: UserRole.SUPER_ADMIN,
      }, { merge: true });

      // Mark the registration request as completed (non-blocking)
      if (requestId) {
        updateDoc(doc(db, 'activationRequests', requestId), {
          status: 'completed',
          completedAt: now.toISOString(),
          churchId: churchId_!,
        }).catch(() => {});
      }

      await refreshUser();
      navigate('/admin', { replace: true });
    } catch (err: any) {
      if (err?.message === 'INVALID_CODE') {
        setError('This activation code is no longer valid. It may have already been used.');
        setCodeStatus('used');
        setValidatedCode(null);
      } else {
        console.error('Church creation error:', err);
        setError('Failed to create church. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Find church by code ────────────────────────────────────────────────────
  const handleFindChurch = async () => {
    const code = joinCode.replace('-', '').length >= 7
      ? joinCode.toUpperCase().trim()
      : null;
    if (!code) { setError('Enter a complete church code (e.g. GRC-X7K2)'); return; }

    setJoinStatus('searching');
    setError('');
    setFoundChurch(null);
    try {
      const q = query(collection(db, 'churches'), where('churchCode', '==', code));
      const snap = await getDocs(q);
      if (snap.empty) {
        setJoinStatus('not_found');
      } else {
        const d = snap.docs[0];
        setFoundChurch({ id: d.id, name: d.data().name, address: d.data().address });
        setJoinStatus('found');
      }
    } catch {
      setJoinStatus('idle');
      setError('Search failed. Try again.');
    }
  };

  // ── Join church ────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!user || !foundChurch) return;
    setSubmitting(true);
    setError('');
    try {
      await setDoc(userDoc(user.uid), {
        churchId: foundChurch.id,
        role: UserRole.MEMBER,
      }, { merge: true });
      await refreshUser();
      navigate('/portal', { replace: true });
    } catch (err) {
      console.error('Church join error:', err);
      setError('Failed to join church. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const nameStatusIcon = () => {
    if (nameStatus === 'checking') return <Loader2 className="w-4 h-4 text-blue-300 animate-spin" />;
    if (nameStatus === 'available') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (nameStatus === 'taken') return <XCircle className="w-4 h-4 text-red-400" />;
    return null;
  };

  const canCreate =
    nameStatus === 'available' &&
    emailStatus === 'available' &&
    phoneStatus === 'available';

  const codeStatusMsg: Record<CodeStatus, { text: string; color: string } | null> = {
    idle:     null,
    checking: { text: 'Checking code…', color: 'text-blue-300' },
    valid:    { text: `✓ Valid code — ${validatedCode?.planName ?? ''} plan, ${validatedCode?.durationMonths ?? 0} months`, color: 'text-emerald-400' },
    invalid:  { text: '✗ Code not found. Check for typos.', color: 'text-red-400' },
    used:     { text: '✗ This code has already been used.', color: 'text-red-400' },
    revoked:  { text: '✗ This code has been revoked.', color: 'text-red-400' },
    expired:  { text: '✗ This code has expired.', color: 'text-red-400' },
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1f5c] via-church-blue to-[#1240a6] flex flex-col">

      {/* Decorative background shapes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-church-yellow/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-church-yellow/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/3 rounded-full blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="bg-church-yellow p-2 rounded-xl shadow-lg shadow-church-yellow/30">
            <Church className="w-5 h-5 text-church-black" />
          </div>
          <span className="font-display font-extrabold text-white text-lg tracking-tight">GraceFlow</span>
        </div>
        <div className="flex items-center gap-3">
          {existingChurch && (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-blue-200 text-sm hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-blue-200 text-sm hover:text-red-400 transition px-3 py-1.5 rounded-lg hover:bg-white/10"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">

        {/* User greeting */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="w-10 h-10 rounded-full bg-church-yellow flex items-center justify-center font-bold text-church-black shadow-lg">
            {user?.displayName?.charAt(0) ?? 'U'}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{user?.displayName}</p>
            <p className="text-blue-300 text-xs">{user?.email}</p>
          </div>
        </motion.div>

        {/* (no existing-church banner needed — existing members are redirected before reaching here) */}

        <AnimatePresence mode="wait">

          {/* ── STEP: Choose path ────────────────────────────────────────────── */}
          {step === 'choose' && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl"
            >
              <div className="text-center mb-10">
                <h1 className="text-3xl md:text-4xl font-display font-extrabold text-white leading-tight">
                  {existingChurch ? 'Church Workspace' : 'Welcome to GraceFlow'}
                </h1>
                <p className="text-blue-200 mt-2 text-sm md:text-base">
                  {existingChurch
                    ? 'Create a new workspace or join another church'
                    : 'Choose how you want to get started'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Create card */}
                <motion.button
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setStep('create'); setError(''); }}
                  className="group relative bg-white/10 hover:bg-white/15 border border-white/20 hover:border-church-yellow/50 rounded-2xl p-8 text-left transition-all duration-300 shadow-xl"
                >
                  <div className="w-14 h-14 bg-church-yellow rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-church-yellow/30 group-hover:scale-110 transition-transform">
                    <Building2 className="w-7 h-7 text-church-black" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Create a Church</h2>
                  <p className="text-blue-200 text-sm leading-relaxed">
                    Set up a new church workspace. You'll be the Super Admin with full control.
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-church-yellow text-sm font-semibold">
                    Get started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                  {/* Corner badge */}
                  <div className="absolute top-4 right-4 bg-church-yellow/20 text-church-yellow text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border border-church-yellow/30">
                    Admin
                  </div>
                </motion.button>

                {/* Join card */}
                <motion.button
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setStep('join'); setError(''); }}
                  className="group relative bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/40 rounded-2xl p-8 text-left transition-all duration-300 shadow-xl"
                >
                  <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-white/25 transition-colors">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Join a Church</h2>
                  <p className="text-blue-200 text-sm leading-relaxed">
                    Already have a church code? Enter it to join as a member of an existing church.
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-blue-200 text-sm font-semibold">
                    Enter code <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                  {/* Corner badge */}
                  <div className="absolute top-4 right-4 bg-white/10 text-blue-200 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border border-white/20">
                    Member
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── STEP: Create church ─────────────────────────────────────────── */}
          {step === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-lg"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => { setStep('choose'); setError(''); setNameStatus('idle'); }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-2xl font-display font-bold text-white">Create Your Church</h2>
                  <p className="text-blue-200 text-xs mt-0.5">You'll become the Super Admin</p>
                </div>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">

                {/* Church name + live availability */}
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1.5 uppercase tracking-wider">
                    Church Name <span className="text-church-yellow">*</span>
                  </label>
                  <div className="relative">
                    <Landmark className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Grace Community Church"
                      className={cn(
                        'w-full bg-white/10 border rounded-xl pl-10 pr-10 py-3 text-sm text-white',
                        'placeholder:text-blue-300/60 focus:outline-none focus:ring-2 transition-all duration-200',
                        nameStatus === 'available' && 'border-emerald-400/50 focus:ring-emerald-400/30',
                        nameStatus === 'taken' && 'border-red-400/50 focus:ring-red-400/30',
                        nameStatus === 'checking' && 'border-white/20 focus:ring-church-yellow/30',
                        nameStatus === 'idle' && 'border-white/20 focus:ring-church-yellow/30 focus:border-church-yellow/50',
                      )}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {nameStatusIcon()}
                    </div>
                  </div>
                  {/* Status text */}
                  <AnimatePresence>
                    {nameStatus === 'available' && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-400 text-xs mt-1.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Name is available
                      </motion.p>
                    )}
                    {nameStatus === 'taken' && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> A church with this name already exists. Choose a unique name.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <InputField
                  icon={MapPin}
                  label="Address"
                  type="text"
                  value={createForm.address}
                  onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="e.g. Plot 12, Kampala Road"
                />

                {/* Email — required + unique */}
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1.5 uppercase tracking-wider">
                    Church Email <span className="text-church-yellow">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={createForm.email}
                      onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="info@yourchurch.org"
                      className={cn(
                        'w-full bg-white/10 border rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-blue-300/60 focus:outline-none focus:ring-2 transition-all duration-200',
                        emailStatus === 'available' && 'border-emerald-400/50 focus:ring-emerald-400/30',
                        emailStatus === 'taken'     && 'border-red-400/50 focus:ring-red-400/30',
                        emailStatus === 'invalid'   && 'border-red-400/50 focus:ring-red-400/30',
                        (emailStatus === 'idle' || emailStatus === 'checking') && 'border-white/20 focus:ring-church-yellow/30 focus:border-church-yellow/50',
                      )}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {emailStatus === 'checking'  && <Loader2 className="w-4 h-4 text-blue-300 animate-spin" />}
                      {emailStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {(emailStatus === 'taken' || emailStatus === 'invalid') && <XCircle className="w-4 h-4 text-red-400" />}
                    </div>
                  </div>
                  <AnimatePresence>
                    {emailStatus === 'available' && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-400 text-xs mt-1.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Email is available
                      </motion.p>
                    )}
                    {emailStatus === 'taken' && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> This email is already registered to another church.
                      </motion.p>
                    )}
                    {emailStatus === 'invalid' && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Please enter a valid email address.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Phone — required + unique */}
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1.5 uppercase tracking-wider">
                    Contact Phone <span className="text-church-yellow">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={createForm.phone}
                      onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="+256 700 000 000"
                      className={cn(
                        'w-full bg-white/10 border rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-blue-300/60 focus:outline-none focus:ring-2 transition-all duration-200',
                        phoneStatus === 'available' && 'border-emerald-400/50 focus:ring-emerald-400/30',
                        phoneStatus === 'taken'     && 'border-red-400/50 focus:ring-red-400/30',
                        (phoneStatus === 'idle' || phoneStatus === 'checking') && 'border-white/20 focus:ring-church-yellow/30 focus:border-church-yellow/50',
                      )}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {phoneStatus === 'checking'  && <Loader2 className="w-4 h-4 text-blue-300 animate-spin" />}
                      {phoneStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {phoneStatus === 'taken'     && <XCircle className="w-4 h-4 text-red-400" />}
                    </div>
                  </div>
                  <AnimatePresence>
                    {phoneStatus === 'available' && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-400 text-xs mt-1.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Contact number is available
                      </motion.p>
                    )}
                    {phoneStatus === 'taken' && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> This phone number is already registered to another church.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Church code preview */}
                <div className="bg-church-yellow/10 border border-church-yellow/30 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-church-yellow text-xs font-bold uppercase tracking-widest mb-1">
                        Your Church Code
                      </p>
                      <p className="text-white font-mono text-xl font-bold tracking-[0.2em]">
                        {churchCode}
                      </p>
                    </div>
                    <Hash className="w-8 h-8 text-church-yellow/40" />
                  </div>
                  <p className="text-blue-200 text-[11px] mt-2">
                    Share this code with members so they can join your church. You can find it later in Configurations.
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 bg-red-500/15 border border-red-400/30 rounded-xl px-4 py-3">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !canCreate}
                  className={cn(
                    'w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200',
                    canCreate && !submitting
                      ? 'bg-church-yellow text-church-black hover:bg-yellow-300 shadow-lg shadow-church-yellow/30 hover:scale-[1.02]'
                      : 'bg-white/10 text-blue-300 cursor-not-allowed',
                  )}
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating workspace…</>
                    : <><ArrowRight className="w-4 h-4" /> Continue to Activation</>}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── STEP: Choose Subscription Plan ─────────────────────────────── */}
          {step === 'plan' && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => { setStep('create'); setError(''); }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-2xl font-display font-bold text-white">Choose Your Plan</h2>
                  <p className="text-blue-200 text-xs mt-0.5">Select the subscription that suits {createForm.name || 'your church'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {SUBSCRIPTION_PLANS.map(plan => {
                  const active = selectedPlan === plan.id;
                  return (
                    <motion.button
                      key={plan.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={cn(
                        'relative text-left rounded-2xl border-2 p-5 transition-all',
                        active
                          ? 'bg-church-yellow border-church-yellow shadow-lg shadow-church-yellow/20'
                          : 'bg-white/10 border-white/20 hover:border-church-yellow/50',
                      )}
                    >
                      {/* Plan name + price */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className={cn('font-black text-lg', active ? 'text-church-black' : 'text-white')}>{plan.name}</p>
                          <p className={cn('text-xs mt-0.5', active ? 'text-church-black/70' : 'text-blue-200')}>{plan.description}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn('font-black text-lg leading-none', active ? 'text-church-black' : 'text-church-yellow')}>
                            {plan.priceLabel}
                          </p>
                          <p className={cn('text-[11px] font-semibold mt-0.5', active ? 'text-church-black/70' : 'text-blue-200')}>
                            {(plan as any).priceUGXLabel}
                          </p>
                        </div>
                      </div>

                      {/* Features */}
                      <ul className="space-y-1">
                        {plan.features.slice(0, 4).map(f => (
                          <li key={f} className={cn('flex items-center gap-1.5 text-xs', active ? 'text-church-black/80' : 'text-blue-100')}>
                            <CheckCircle2 className={cn('w-3 h-3 flex-shrink-0', active ? 'text-church-black' : 'text-church-yellow')} />
                            {f}
                          </li>
                        ))}
                        {plan.features.length > 4 && (
                          <li className={cn('text-xs font-semibold', active ? 'text-church-black/60' : 'text-blue-300')}>
                            +{plan.features.length - 4} more…
                          </li>
                        )}
                      </ul>

                      {/* Selected indicator */}
                      {active && (
                        <div className="absolute top-3 right-3 w-5 h-5 bg-church-black rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-3.5 h-3.5 text-church-yellow" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Duration selector */}
              <div className="bg-white/10 border border-white/15 rounded-2xl p-5">
                <p className="text-white font-bold text-sm mb-3">Subscription Duration</p>
                <div className="grid grid-cols-4 gap-2">
                  {SUBSCRIPTION_DURATIONS.map(d => {
                    const active = selectedDurationMonths === d.months;
                    return (
                      <button
                        key={d.months}
                        type="button"
                        onClick={() => setSelectedDurationMonths(d.months)}
                        className={cn(
                          'py-2.5 rounded-xl text-xs font-black tracking-wide transition-all text-center border-2',
                          active
                            ? 'bg-church-yellow text-church-black border-church-yellow shadow-lg'
                            : 'bg-white/10 text-blue-200 border-white/20 hover:border-church-yellow/50',
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Billing summary */}
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/10">
                  <p className="text-blue-200 text-xs font-bold uppercase tracking-wider">Total Bill</p>
                </div>
                <div className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 text-sm text-white/70">
                      <span>{activePlanInfo?.name} Plan</span>
                      <span>×</span>
                      <span>{selectedDurationMonths} month{selectedDurationMonths !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-blue-200 text-xs">{activePlanInfo?.priceLabel} × {selectedDurationMonths}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-church-yellow font-black text-2xl">{formattedTotalUGX}</p>
                    <p className="text-blue-300 text-xs mt-0.5">{formattedTotalUSD}</p>
                  </div>
                </div>
                <div className="px-5 py-3 bg-white/5 text-[11px] text-blue-300">
                  Pay via Mobile Money, Bank Transfer or Cash · Contact GraceFlow after payment to receive your Activation Code
                </div>
              </div>

              {/* Confirm */}
              <button
                onClick={handlePlanContinue}
                className="w-full bg-church-yellow text-church-black py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-yellow-300 shadow-lg shadow-church-yellow/30 hover:scale-[1.02] transition-all"
              >
                <ArrowRight className="w-4 h-4" />
                Continue — {activePlanInfo?.name} · {selectedDurationMonths}mo · {formattedTotalUGX}
              </button>
            </motion.div>
          )}

          {/* ── STEP: Activation code ──────────────────────────────────────── */}
          {step === 'activate' && (
            <motion.div
              key="activate"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-lg"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => { setStep('create'); setError(''); setCodeStatus('idle'); setActivationCode(''); setValidatedCode(null); }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-2xl font-display font-bold text-white">Enter Activation Code</h2>
                  <p className="text-blue-200 text-xs mt-0.5">Required to activate your Church Space</p>
                </div>
              </div>

              <div className="space-y-5">
                {/* How to get a code */}
                <div className="bg-church-yellow/10 border border-church-yellow/30 rounded-2xl p-4">
                  <p className="text-church-yellow text-xs font-bold uppercase tracking-widest mb-2">How to get your Activation Code</p>
                  <ol className="text-blue-100 text-sm space-y-1 list-decimal list-inside">
                    <li>Complete your subscription payment (Mobile Money, bank transfer, or cash)</li>
                    <li>Contact the GraceFlow team to confirm your payment</li>
                    <li>Receive your unique Activation Code via WhatsApp or SMS</li>
                    <li>Enter it below to activate your Church Space</li>
                  </ol>
                </div>

                {/* Church name summary */}
                <div className="bg-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-church-yellow flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-blue-300 uppercase tracking-wider">Creating church workspace for</p>
                    <p className="text-white font-bold">{createForm.name}</p>
                  </div>
                </div>

                {/* Code input */}
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1.5 uppercase tracking-wider">
                    Activation Code <span className="text-church-yellow">*</span>
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 pointer-events-none" />
                    <input
                      type="text"
                      value={activationCode}
                      onChange={e => {
                        // 6-character code: letters and digits only, uppercase
                        const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                        setActivationCode(clean);
                        setCodeStatus('idle');
                        setValidatedCode(null);
                        setError('');
                      }}
                      placeholder="e.g. A3B7C2"
                      maxLength={6}
                      className={cn(
                        'w-full bg-white/10 border rounded-xl pl-10 pr-10 py-3 text-sm text-white font-mono tracking-[0.1em] placeholder:font-sans placeholder:tracking-normal placeholder:text-blue-300/60 focus:outline-none focus:ring-2 transition-all duration-200',
                        codeStatus === 'valid'   && 'border-emerald-400/50 focus:ring-emerald-400/30',
                        codeStatus === 'invalid' || codeStatus === 'used' || codeStatus === 'revoked' || codeStatus === 'expired'
                          ? 'border-red-400/50 focus:ring-red-400/30'
                          : 'border-white/20 focus:ring-church-yellow/30 focus:border-church-yellow/50',
                      )}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {codeStatus === 'checking' && <Loader2 className="w-4 h-4 text-blue-300 animate-spin" />}
                      {codeStatus === 'valid'    && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {(codeStatus === 'invalid' || codeStatus === 'used' || codeStatus === 'revoked' || codeStatus === 'expired') &&
                        <XCircle className="w-4 h-4 text-red-400" />}
                    </div>
                  </div>

                  {/* Live status message */}
                  <AnimatePresence>
                    {codeStatusMsg[codeStatus] && (
                      <motion.p
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className={cn('text-xs mt-1.5', codeStatusMsg[codeStatus]!.color)}
                      >
                        {codeStatusMsg[codeStatus]!.text}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Subscription preview (shown when code is valid) */}
                <AnimatePresence>
                  {codeStatus === 'valid' && validatedCode && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4 space-y-2"
                    >
                      <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Subscription Details</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-blue-300 uppercase tracking-wider">Plan</p>
                          <p className="text-white font-bold">{validatedCode.planName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-blue-300 uppercase tracking-wider">Duration</p>
                          <p className="text-white font-bold">
                            {SUBSCRIPTION_DURATIONS.find(d => d.months === validatedCode.durationMonths)?.label ?? `${validatedCode.durationMonths} months`}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-blue-300 uppercase tracking-wider">Starts</p>
                          <p className="text-white font-bold">Today</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-blue-300 uppercase tracking-wider">Expires</p>
                          <p className="text-white font-bold">
                            {(() => {
                              const d = new Date();
                              d.setMonth(d.getMonth() + validatedCode.durationMonths);
                              return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                            })()}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 bg-red-500/15 border border-red-400/30 rounded-xl px-4 py-3">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleActivate}
                  disabled={submitting || codeStatus !== 'valid'}
                  className={cn(
                    'w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200',
                    codeStatus === 'valid' && !submitting
                      ? 'bg-church-yellow text-church-black hover:bg-yellow-300 shadow-lg shadow-church-yellow/30 hover:scale-[1.02]'
                      : 'bg-white/10 text-blue-300 cursor-not-allowed',
                  )}
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating workspace…</>
                    : <><Building2 className="w-4 h-4" /> Activate &amp; Create Church Space</>}
                </button>

                {/* ── Waiting notice ───────────────────────────────────── */}
                <div className="bg-church-yellow/10 border border-church-yellow/30 rounded-2xl px-4 py-3 flex items-start gap-3">
                  <Clock className="w-4 h-4 text-church-yellow flex-shrink-0 mt-0.5" />
                  <p className="text-blue-100 text-xs leading-relaxed">
                    <strong className="text-church-yellow">Your registration request has been submitted automatically.</strong>{' '}
                    The GraceFlow System Owner has been notified and will generate your activation code shortly.
                    Once received, enter the code above to activate your Church Space.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP: Join church ───────────────────────────────────────────── */}
          {step === 'join' && (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="w-full max-w-lg"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => { setStep('choose'); setError(''); setJoinStatus('idle'); setFoundChurch(null); setJoinCode(''); }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-2xl font-display font-bold text-white">Join a Church</h2>
                  <p className="text-blue-200 text-xs mt-0.5">You'll join as a Member</p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Code input */}
                <div>
                  <label className="block text-xs font-semibold text-blue-200 mb-1.5 uppercase tracking-wider">
                    Church Code <span className="text-church-yellow">*</span>
                  </label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 pointer-events-none" />
                      <input
                        type="text"
                        value={joinCode}
                        onChange={e => {
                          setJoinCode(formatCodeInput(e.target.value));
                          setJoinStatus('idle');
                          setFoundChurch(null);
                          setError('');
                        }}
                        placeholder="e.g. GRC-X7K2"
                        maxLength={8}
                        className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-sm text-white font-mono tracking-[0.15em] placeholder:text-blue-300/60 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-church-yellow/50 focus:border-church-yellow/50 transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleFindChurch}
                      disabled={joinStatus === 'searching' || joinCode.replace('-', '').length < 7}
                      className="px-5 py-3 bg-white/15 hover:bg-white/25 disabled:bg-white/5 disabled:text-blue-400 text-white rounded-xl font-semibold text-sm transition-all flex items-center gap-2 whitespace-nowrap"
                    >
                      {joinStatus === 'searching'
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</>
                        : 'Find Church'}
                    </button>
                  </div>
                </div>

                {/* Search results */}
                <AnimatePresence>
                  {joinStatus === 'not_found' && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 bg-red-500/15 border border-red-400/30 rounded-xl px-4 py-3"
                    >
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                      <div>
                        <p className="text-red-300 text-sm font-semibold">No church found</p>
                        <p className="text-red-300/70 text-xs">Check the code and try again. Codes are case-sensitive and in the format ABC-1234.</p>
                      </div>
                    </motion.div>
                  )}

                  {joinStatus === 'found' && foundChurch && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-5"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-church-yellow rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-church-yellow/20">
                          <Church className="w-6 h-6 text-church-black" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Church Found</span>
                          </div>
                          <p className="text-white font-bold text-lg truncate">{foundChurch.name}</p>
                          {foundChurch.address && (
                            <p className="text-blue-200 text-xs mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {foundChurch.address}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-blue-200 text-xs mb-3">
                          You'll join as a <strong className="text-white">Member</strong>. The church admin can change your role later.
                        </p>

                        {error && (
                          <p className="text-red-300 text-xs mb-3 flex items-center gap-1.5">
                            <XCircle className="w-3 h-3" /> {error}
                          </p>
                        )}

                        <button
                          onClick={handleJoin}
                          disabled={submitting}
                          className="w-full py-3 bg-church-yellow text-church-black rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-yellow-300 transition-all shadow-lg shadow-church-yellow/20 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {submitting
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
                            : <><Users className="w-4 h-4" /> Join {foundChurch.name}</>}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error (non-found-state) */}
                {error && joinStatus !== 'found' && (
                  <div className="flex items-center gap-2 bg-red-500/15 border border-red-400/30 rounded-xl px-4 py-3">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                <p className="text-blue-300/60 text-xs text-center">
                  Don't have a code? Ask your church pastor or admin for the church code.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4">
        <p className="text-blue-400/50 text-[11px]">GraceFlow Church Management · Secure & Isolated Workspaces</p>
      </footer>
    </div>
  );
}
