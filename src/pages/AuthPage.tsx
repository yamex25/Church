import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Church, Eye, EyeOff, User, Mail, Lock, AtSign, Loader2,
  AlertCircle, CheckCircle2, XCircle, ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/src/components/AuthContext';
import { cn } from '@/src/lib/utils';
import { Navigate, useLocation } from 'react-router-dom';
import { db } from '@/src/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMode = 'signin' | 'register';
type SignInMethod = 'google' | 'email' | 'username';
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

// ─── Google SVG icon ───��─────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// ─── Input field ────────────���────────────────────────────���───────────────────

function InputField({
  icon: Icon,
  label,
  error,
  rightIcon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ElementType;
  label: string;
  error?: string;
  rightIcon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-church-gray mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray/60 pointer-events-none" />
        <input
          className={cn(
            'w-full bg-church-soft border rounded-xl pl-10 pr-10 py-3 text-sm text-church-black focus:outline-none focus:ring-2 focus:border-transparent transition-all',
            error
              ? 'border-red-300 focus:ring-red-200'
              : 'border-church-blue/10 focus:ring-church-blue/20',
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{rightIcon}</div>
        )}
      </div>
      {error && <p className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuthPage() {
  const {
    user, isPlatformOwner, isAdmin, needsChurchSetup,
    loading, signInWithGoogle, signInWithEmail, signInWithUsername,
    signUpWithEmail, sendPasswordReset,
  } = useAuth();
  const location = useLocation();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [method, setMethod] = useState<SignInMethod>('google');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Sign-in form
  const [signInForm, setSignInForm] = useState({ identifier: '', password: '' });

  // Register form
  const [regForm, setRegForm] = useState({
    displayName: '', username: '', email: '', password: '', confirmPassword: '',
  });
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Live username availability check ──────────────────────────────────────
  useEffect(() => {
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    const uname = regForm.username.trim().toLowerCase();
    if (!uname || uname.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    usernameTimer.current = setTimeout(async () => {
      const snap = await getDoc(doc(db, 'usernames', uname));
      setUsernameStatus(snap.exists() ? 'taken' : 'available');
    }, 600);
    return () => { if (usernameTimer.current) clearTimeout(usernameTimer.current); };
  }, [regForm.username]);

  // ── Redirect if already authenticated ────────────��────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-church-soft flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="bg-church-blue p-6 rounded-[32px] shadow-2xl shadow-church-blue/20"
        >
          <Church className="text-white w-12 h-12" />
        </motion.div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-church-blue animate-pulse">
          GraceFlow is Preparing…
        </p>
      </div>
    );
  }

  if (user) {
    const from = (location.state as any)?.from?.pathname as string | undefined;

    // Platform Owner → console (no church context needed)
    if (isPlatformOwner) return <Navigate to="/platform" replace />;

    // User already belongs to a church — go directly to their dashboard.
    // `user.churchId` is the Firestore value set during church creation/joining;
    // it is the definitive source of church membership.
    if (user.churchId) {
      if (isAdmin) {
        // Admin: restore an admin path if that's where they were going
        const dest = from?.startsWith('/admin') ? from : '/admin';
        return <Navigate to={dest} replace />;
      }
      // Member / Dept Head: restore a portal path
      const dest = from?.startsWith('/portal') ? from : '/portal';
      return <Navigate to={dest} replace />;
    }

    // No church association → church setup required
    return <Navigate to="/setup-church" replace />;
  }

  // ── Handlers ──────────────────���─────────────────────────────────��──────────

  const handleGoogleSignIn = async () => {
    setError(''); setBusy(true);
    try { await signInWithGoogle(); }
    catch (e: any) {
      if (e.code !== 'auth/popup-closed-by-user') setError(friendlyError(e.code));
    } finally { setBusy(false); }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (method === 'email') {
        await signInWithEmail(signInForm.identifier.trim(), signInForm.password);
      } else {
        await signInWithUsername(signInForm.identifier.trim(), signInForm.password);
      }
    } catch (e: any) {
      setError(friendlyError(e.code ?? e.message));
    } finally { setBusy(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!regForm.displayName.trim())               errs.displayName = 'Full name is required.';
    if (regForm.username.trim().length < 3)         errs.username = 'Username must be at least 3 characters.';
    if (usernameStatus === 'taken')                 errs.username = 'Username is already taken.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regForm.email)) errs.email = 'Enter a valid email address.';
    if (regForm.password.length < 8)               errs.password = 'Password must be at least 8 characters.';
    if (regForm.password !== regForm.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    setRegErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true); setError('');
    try {
      await signUpWithEmail(regForm.displayName, regForm.username, regForm.email, regForm.password);
    } catch (e: any) {
      if (e.code === 'username/taken') setRegErrors({ username: 'Username is already taken.' });
      else setError(friendlyError(e.code ?? e.message));
    } finally { setBusy(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await sendPasswordReset(forgotEmail.trim());
      setResetSent(true);
    } catch (e: any) {
      setError(friendlyError(e.code));
    } finally { setBusy(false); }
  };

  const friendlyError = (code?: string): string => {
    const map: Record<string, string> = {
      'auth/user-not-found':       'No account found with this email or username.',
      'auth/wrong-password':       'Incorrect password. Please try again.',
      'auth/invalid-credential':   'Incorrect email/username or password.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password':        'Password must be at least 8 characters.',
      'auth/too-many-requests':    'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return map[code ?? ''] ?? 'Something went wrong. Please try again.';
  };

  const usernameIcon = () => {
    if (usernameStatus === 'checking')  return <Loader2 className="w-3.5 h-3.5 text-church-blue animate-spin" />;
    if (usernameStatus === 'available') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    if (usernameStatus === 'taken')     return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    return null;
  };

  // ── Render ───────────────��───────────────────────────────���─────────────────
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-church-soft via-white to-church-blue/5">

      {/* Left panel — decorative (hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-gradient-to-br from-church-blue to-[#1240a6] p-12">
        <div className="flex items-center gap-3">
          <div className="bg-church-yellow p-2.5 rounded-xl rotate-3 shadow-lg">
            <Church className="w-6 h-6 text-church-black" />
          </div>
          <span className="text-white font-display font-black text-xl">GraceFlow</span>
        </div>
        <div>
          <h2 className="text-4xl font-display font-black text-white leading-tight mb-4">
            Digitizing<br />the Sanctuary
          </h2>
          <p className="text-blue-200 text-sm leading-relaxed">
            A complete church management platform built for modern ministries.
            Manage members, finance, HR, events and more — all in one place.
          </p>
        </div>
        <p className="text-blue-300/60 text-xs">© GraceFlow Systems · Version 2.0</p>
      </div>

      {/* Right panel — auth forms */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="bg-church-blue p-2.5 rounded-xl shadow-lg">
              <Church className="w-5 h-5 text-white" />
            </div>
            <span className="text-church-black font-display font-black text-xl">GraceFlow</span>
          </div>

          {/* Forgot password modal */}
          <AnimatePresence>
            {showForgot && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              >
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.9 }}
                  className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl"
                >
                  {resetSent ? (
                    <div className="text-center">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                      <h3 className="font-bold text-church-black text-lg mb-2">Reset Email Sent</h3>
                      <p className="text-church-gray text-sm mb-6">
                        Check <strong>{forgotEmail}</strong> for a password reset link.
                      </p>
                      <button onClick={() => { setShowForgot(false); setResetSent(false); setForgotEmail(''); }}
                        className="w-full bg-church-blue text-white py-3 rounded-xl font-bold text-sm hover:bg-church-blue/90 transition">
                        Done
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <h3 className="font-display font-black text-xl text-church-black">Reset Password</h3>
                      <p className="text-church-gray text-sm">Enter your email and we'll send a reset link.</p>
                      <InputField
                        icon={Mail} label="Email" type="email" required
                        value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                        placeholder="your@email.com"
                      />
                      {error && <p className="text-red-500 text-xs">{error}</p>}
                      <div className="flex gap-3">
                        <button type="submit" disabled={busy}
                          className="flex-1 bg-church-blue text-white py-3 rounded-xl font-bold text-sm hover:bg-church-blue/90 transition flex items-center justify-center gap-2">
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
                        </button>
                        <button type="button" onClick={() => { setShowForgot(false); setError(''); }}
                          className="px-4 py-3 bg-church-soft text-church-gray rounded-xl font-bold text-sm hover:bg-gray-100 transition">
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mode tabs */}
          <div className="flex bg-church-soft rounded-2xl p-1 mb-8 gap-1">
            <button
              onClick={() => { setMode('signin'); setError(''); }}
              className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold transition-all', mode === 'signin' ? 'bg-white text-church-blue shadow-sm' : 'text-church-gray hover:text-church-black')}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold transition-all', mode === 'register' ? 'bg-white text-church-blue shadow-sm' : 'text-church-gray hover:text-church-black')}
            >
              Create Account
            </button>
          </div>

          <AnimatePresence mode="wait">

            {/* ── SIGN IN ──────────────────────────��─────────────────────────── */}
            {mode === 'signin' && (
              <motion.div key="signin" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                <div>
                  <h1 className="text-2xl font-display font-black text-church-black">Welcome back</h1>
                  <p className="text-church-gray text-sm mt-0.5">Sign in to your GraceFlow account</p>
                </div>

                {/* Google */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 py-3 rounded-2xl font-bold text-sm text-church-black hover:border-church-blue/30 hover:bg-church-soft transition-all disabled:opacity-50 shadow-sm"
                >
                  {busy && method !== 'email' && method !== 'username'
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <GoogleIcon />}
                  Continue with Google
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-church-gray font-medium">or sign in with</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Method tabs */}
                <div className="flex bg-church-soft rounded-xl p-1 gap-1">
                  {(['email', 'username'] as const).map(m => (
                    <button key={m} onClick={() => { setMethod(m); setError(''); setSignInForm({ identifier: '', password: '' }); }}
                      className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all capitalize', method === m ? 'bg-white text-church-blue shadow-sm' : 'text-church-gray hover:text-church-black')}>
                      {m === 'email' ? 'Email' : 'Username'}
                    </button>
                  ))}
                </div>

                {/* Sign-in form */}
                <form onSubmit={handleSignIn} className="space-y-3">
                  <InputField
                    icon={method === 'email' ? Mail : AtSign}
                    label={method === 'email' ? 'Email Address' : 'Username'}
                    type={method === 'email' ? 'email' : 'text'}
                    required
                    value={signInForm.identifier}
                    onChange={e => setSignInForm(f => ({ ...f, identifier: e.target.value }))}
                    placeholder={method === 'email' ? 'you@example.com' : 'your_username'}
                    autoComplete={method === 'email' ? 'email' : 'username'}
                  />
                  <InputField
                    icon={Lock} label="Password" type={showPass ? 'text' : 'password'} required
                    value={signInForm.password}
                    onChange={e => setSignInForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    rightIcon={
                      <button type="button" onClick={() => setShowPass(v => !v)} className="text-church-gray hover:text-church-black">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />

                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
                    </div>
                  )}

                  <button type="submit" disabled={busy}
                    className="w-full bg-church-blue text-white py-3 rounded-2xl font-bold text-sm hover:bg-church-blue/90 transition flex items-center justify-center gap-2 disabled:opacity-60">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Sign In</>}
                  </button>

                  <button type="button" onClick={() => { setShowForgot(true); setError(''); setResetSent(false); }}
                    className="w-full text-xs text-church-blue hover:underline text-center">
                    Forgot your password?
                  </button>
                </form>
              </motion.div>
            )}

            {/* ��─ REGISTER ─��───────────────────────────────────────────────── */}
            {mode === 'register' && (
              <motion.div key="register" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                <div>
                  <h1 className="text-2xl font-display font-black text-church-black">Create Account</h1>
                  <p className="text-church-gray text-sm mt-0.5">Join GraceFlow with email and password</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-3">
                  <InputField
                    icon={User} label="Full Name" type="text" required
                    value={regForm.displayName}
                    onChange={e => setRegForm(f => ({ ...f, displayName: e.target.value }))}
                    placeholder="John Doe"
                    error={regErrors.displayName}
                  />

                  {/* Username with live check */}
                  <div>
                    <label className="block text-xs font-bold text-church-gray mb-1.5 uppercase tracking-wider">Username</label>
                    <div className="relative">
                      <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-church-gray/60 pointer-events-none" />
                      <input
                        type="text" required
                        value={regForm.username}
                        onChange={e => { setRegForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })); setRegErrors(e => ({ ...e, username: '' })); }}
                        placeholder="john_doe"
                        className={cn('w-full bg-church-soft border rounded-xl pl-10 pr-10 py-3 text-sm text-church-black focus:outline-none focus:ring-2 focus:border-transparent transition-all',
                          regErrors.username || usernameStatus === 'taken' ? 'border-red-300 focus:ring-red-200' : 'border-church-blue/10 focus:ring-church-blue/20')}
                      />
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{usernameIcon()}</div>
                    </div>
                    {regErrors.username && <p className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{regErrors.username}</p>}
                    {usernameStatus === 'available' && !regErrors.username && <p className="text-emerald-500 text-[11px] mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Username is available</p>}
                    {usernameStatus === 'taken' && <p className="text-red-500 text-[11px] mt-1 flex items-center gap-1"><XCircle className="w-3 h-3" />Username is already taken</p>}
                  </div>

                  <InputField
                    icon={Mail} label="Email Address" type="email" required
                    value={regForm.email}
                    onChange={e => { setRegForm(f => ({ ...f, email: e.target.value })); setRegErrors(e => ({ ...e, email: '' })); }}
                    placeholder="you@example.com"
                    error={regErrors.email}
                  />
                  <InputField
                    icon={Lock} label="Password" type={showPass ? 'text' : 'password'} required
                    value={regForm.password}
                    onChange={e => { setRegForm(f => ({ ...f, password: e.target.value })); setRegErrors(e => ({ ...e, password: '' })); }}
                    placeholder="At least 8 characters"
                    error={regErrors.password}
                    rightIcon={
                      <button type="button" onClick={() => setShowPass(v => !v)} className="text-church-gray hover:text-church-black">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                  <InputField
                    icon={Lock} label="Confirm Password" type={showConfirmPass ? 'text' : 'password'} required
                    value={regForm.confirmPassword}
                    onChange={e => { setRegForm(f => ({ ...f, confirmPassword: e.target.value })); setRegErrors(e => ({ ...e, confirmPassword: '' })); }}
                    placeholder="Repeat password"
                    error={regErrors.confirmPassword}
                    rightIcon={
                      <button type="button" onClick={() => setShowConfirmPass(v => !v)} className="text-church-gray hover:text-church-black">
                        {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />

                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
                    </div>
                  )}

                  <div className="bg-yellow-50 border border-yellow-400 rounded-xl px-3 py-2.5 text-xs text-church-yellow">
                    After registering, you'll need to create or join a Church Space using an Activation Code.
                  </div>

                  <button type="submit" disabled={busy || usernameStatus === 'taken' || usernameStatus === 'checking'}
                    className="w-full bg-church-blue text-white py-3 rounded-2xl font-bold text-sm hover:bg-church-blue/90 transition flex items-center justify-center gap-2 disabled:opacity-60">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Create Account</>}
                  </button>
                </form>

                <p className="text-xs text-center text-church-gray">
                  Or{' '}
                  <button onClick={handleGoogleSignIn} disabled={busy} className="text-church-blue font-bold hover:underline">
                    continue with Google
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-8 text-center text-[10px] font-bold uppercase tracking-widest text-church-gray/60">
            GraceFlow Systems · Secure SaaS Platform
          </p>
        </motion.div>
      </div>
    </div>
  );
}
