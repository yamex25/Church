import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Settings,
  Camera,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  LogOut,
  X,
  Key,
  Copy,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '../../components/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/src/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { generateSecret, verifyTOTP, getOTPAuthUri } from '@/src/lib/totp';

type SetupMode = null | 'setup' | 'disabling';

export default function PortalProfile() {
  const { user, logout, twoFactorEnabled, enableTwoFactor, disableTwoFactor } = useAuth();
  const [member, setMember] = useState({
    name: user?.displayName || 'Faith Member',
    email: user?.email || 'N/A',
    phone: '',
    address: '',
    memberSince: 'Member',
    gender: 'N/A',
    dob: 'N/A',
    categories: ['Member'],
  });

  // 2FA state
  const [setupMode, setSetupMode] = useState<SetupMode>(null);
  const [setupSecret, setSetupSecret] = useState('');
  const [tfaCode, setTfaCode] = useState('');
  const [tfaError, setTfaError] = useState('');
  const [tfaLoading, setTfaLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tfaSuccess, setTfaSuccess] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchMemberData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setMember({
            name: userData.displayName || user.displayName,
            email: userData.email || user.email,
            phone: userData.phone || '',
            address: userData.address || '',
            memberSince: userData.memberSince || 'Member',
            gender: userData.gender || 'N/A',
            dob: userData.dob || 'N/A',
            categories: userData.categories || ['Member'],
          });
        }
      } catch (error) {
        console.error('Error fetching member data:', error);
      }
    };
    fetchMemberData();
  }, [user]);

  // Focus code input when modal opens
  useEffect(() => {
    if (setupMode) {
      setTimeout(() => codeInputRef.current?.focus(), 300);
    }
  }, [setupMode]);

  const handleSignOut = () => {
    if (window.confirm('Confirm secure sign out?')) logout();
  };

  const openSetup = () => {
    setSetupSecret(generateSecret());
    setTfaCode('');
    setTfaError('');
    setTfaSuccess(false);
    setSetupMode('setup');
  };

  const openDisable = () => {
    setTfaCode('');
    setTfaError('');
    setSetupMode('disabling');
  };

  const closeModal = () => {
    setSetupMode(null);
    setTfaCode('');
    setTfaError('');
    setTfaSuccess(false);
  };

  const handleVerifySetup = async () => {
    if (tfaCode.length !== 6) return;
    setTfaLoading(true);
    setTfaError('');
    const valid = await verifyTOTP(setupSecret, tfaCode);
    if (valid) {
      await enableTwoFactor(setupSecret);
      setTfaSuccess(true);
      setTimeout(closeModal, 1800);
    } else {
      setTfaError('Invalid code. Check your authenticator app and try again.');
    }
    setTfaLoading(false);
  };

  const handleDisable = async () => {
    if (tfaCode.length !== 6) return;
    setTfaLoading(true);
    setTfaError('');
    const success = await disableTwoFactor(tfaCode);
    if (success) {
      setTfaSuccess(true);
      setTimeout(closeModal, 1400);
    } else {
      setTfaError('Invalid code. Please try again.');
    }
    setTfaLoading(false);
  };

  const handleCodeChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    setTfaCode(digits);
    setTfaError('');
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(setupSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedSecret = setupSecret.match(/.{1,4}/g)?.join(' ') || setupSecret;
  const otpauthUri = getOTPAuthUri(setupSecret, member.email);

  return (
    <div className="space-y-10 text-church-black">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-black tracking-tight text-church-black">Ministry Identity</h2>
          <p className="text-xs font-black text-church-gray uppercase tracking-widest mt-1">Personal Stewardship</p>
        </div>
        <button
          onClick={() => alert('Settings are managed by the church office. Contact them to update sensitive data.')}
          className="p-3 bg-white border-2 border-church-blue/10 rounded-2xl text-church-blue shadow-sm hover:bg-church-soft transition-all"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* Avatar Section */}
      <section className="bg-white p-12 rounded-2xl sm:rounded-[48px] border border-church-blue/5 shadow-2xl shadow-church-blue/5 flex flex-col items-center relative overflow-hidden">
        <div className="relative mb-8 pt-4">
          <div className="w-40 h-40 rounded-[32px] bg-church-soft flex items-center justify-center text-7xl font-display font-black text-church-blue border-4 border-white shadow-2xl shadow-church-blue/10 transform -rotate-3">
            {member.name.charAt(0)}
          </div>
          <button
            onClick={() => alert('Photo upload is coming soon.')}
            className="absolute -bottom-2 -right-2 bg-church-yellow text-church-black p-4 rounded-2xl border-4 border-white shadow-xl hover:scale-110 active:scale-95 transition-all"
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>
        <h3 className="text-3xl font-display font-black text-church-black">{member.name}</h3>
        <p className="text-church-gray text-[10px] font-black uppercase tracking-[0.25em] mt-2 mb-8 bg-church-soft px-4 py-1.5 rounded-full border border-church-blue/5">
          Faith Member since {member.memberSince}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {member.categories.map((cat) => (
            <span key={cat} className="px-6 py-2 bg-church-blue text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-church-blue/10">
              {cat}
            </span>
          ))}
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-church-yellow/10 rounded-full blur-2xl -mr-16 -mt-16" />
      </section>

      {/* Details List */}
      <section className="bg-white rounded-2xl sm:rounded-[40px] border border-church-blue/5 shadow-2xl shadow-church-blue/5 overflow-hidden divide-y divide-church-soft">
        {[
          { icon: Mail, label: 'Email Address', val: member.email },
          { icon: Phone, label: 'Contact Number', val: member.phone },
          { icon: MapPin, label: 'Resident Address', val: member.address },
          { icon: Calendar, label: 'Birth Anniversary', val: member.dob },
        ].map((item, i) => (
          <div
            key={i}
            onClick={() => alert(`Updating ${item.label} requires office verification.`)}
            className="p-8 flex items-center gap-6 group cursor-pointer hover:bg-church-soft transition-colors"
          >
            <div className="p-4 rounded-2xl bg-church-soft text-church-blue group-hover:bg-church-blue group-hover:text-white transition-all shadow-sm">
              <item.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-church-gray uppercase tracking-[0.2em] leading-none mb-2">{item.label}</p>
              <p className="text-lg font-bold text-church-black tracking-tight">{item.val}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-church-blue/20 group-hover:text-church-blue transition-all group-hover:translate-x-1" />
          </div>
        ))}
      </section>

      {/* Sanctity & Privacy */}
      <section className="space-y-4 pt-6">
        <h3 className="text-xs font-black text-church-gray uppercase tracking-[0.2em] px-4">Sanctity &amp; Privacy</h3>

        {/* Two-Factor Authentication Card */}
        <div className="p-8 bg-white rounded-[32px] border border-church-blue/5 shadow-xl shadow-church-blue/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className={cn('p-3 rounded-xl', twoFactorEnabled ? 'bg-green-50 text-green-600' : 'bg-church-soft text-church-blue')}>
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-church-black">Two-Factor Authentication</span>
                  {twoFactorEnabled && (
                    <span className="px-2.5 py-0.5 bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-green-100">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-church-gray font-medium mt-0.5">
                  {twoFactorEnabled
                    ? 'Authenticator app is protecting your account'
                    : 'Add an extra layer of security with an authenticator app'}
                </p>
              </div>
            </div>
            {twoFactorEnabled ? (
              <button
                onClick={openDisable}
                className="ml-4 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 rounded-xl border border-red-100 hover:bg-red-100 transition-all whitespace-nowrap"
              >
                Disable
              </button>
            ) : (
              <button
                onClick={openSetup}
                className="ml-4 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-church-blue bg-church-soft rounded-xl border border-church-blue/10 hover:bg-church-blue hover:text-white transition-all whitespace-nowrap"
              >
                Set Up
              </button>
            )}
          </div>
        </div>

        {/* Manage Verified Devices */}
        <div
          onClick={() => alert('Device management is coming soon.')}
          className="flex items-center justify-between p-8 bg-white rounded-[32px] border border-church-blue/5 shadow-xl shadow-church-blue/5 group hover:border-church-blue/20 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-5">
            <div className="p-3 bg-church-blue/5 rounded-xl text-church-blue">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <span className="text-base font-bold text-church-black">Manage Verified Devices</span>
              <p className="text-xs text-church-gray font-medium">Authorized login portals</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-church-blue/20 group-hover:text-church-blue transition-all group-hover:translate-x-1" />
        </div>
      </section>

      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-4 py-8 text-white font-black text-xs uppercase tracking-[0.25em] bg-red-600 rounded-[32px] hover:bg-red-700 transition-all shadow-2xl shadow-red-600/20 active:scale-95 mb-12"
      >
        <LogOut className="w-5 h-5" />
        Secure Sign Out
      </button>

      {/* ── 2FA Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {setupMode && (
          <motion.div
            key="tfa-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-church-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="w-full max-w-md bg-white rounded-2xl sm:rounded-[40px] overflow-hidden shadow-2xl shadow-church-blue/20"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-10 pt-10 pb-6 border-b border-church-soft">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2.5 rounded-xl', setupMode === 'setup' ? 'bg-church-blue/10 text-church-blue' : 'bg-red-50 text-red-600')}>
                    <Key className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-church-black">
                    {setupMode === 'setup' ? 'Set Up Authenticator' : 'Disable 2FA'}
                  </h3>
                </div>
                <button onClick={closeModal} className="p-2 rounded-xl hover:bg-church-soft text-church-gray transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-10 py-8 space-y-7">

                {/* Success state */}
                {tfaSuccess ? (
                  <div className="flex flex-col items-center gap-4 py-6">
                    <div className="p-4 bg-green-50 rounded-full">
                      <CheckCircle2 className="w-10 h-10 text-green-500" />
                    </div>
                    <p className="text-base font-black text-church-black">
                      {setupMode === 'setup' ? '2FA Enabled!' : '2FA Disabled'}
                    </p>
                    <p className="text-xs text-church-gray font-medium text-center">
                      {setupMode === 'setup'
                        ? 'Your account is now protected by your authenticator app.'
                        : 'Two-factor authentication has been removed.'}
                    </p>
                  </div>
                ) : setupMode === 'setup' ? (
                  <>
                    {/* Instructions */}
                    <ol className="space-y-2 text-sm text-church-gray font-medium list-decimal list-inside">
                      <li>Install <strong className="text-church-black">Google Authenticator</strong> or <strong className="text-church-black">Authy</strong> on your phone.</li>
                      <li>Scan the QR code below with the app.</li>
                      <li>Enter the 6-digit code the app shows to confirm.</li>
                    </ol>

                    {/* QR Code */}
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-5 bg-white rounded-3xl border-2 border-church-soft shadow-inner">
                        <QRCodeSVG value={otpauthUri} size={180} level="M" />
                      </div>

                      {/* Manual key */}
                      <div className="w-full">
                        <p className="text-[10px] font-black text-church-gray uppercase tracking-widest mb-2 text-center">
                          Or enter manually
                        </p>
                        <div className="flex items-center gap-2 bg-church-soft rounded-2xl p-3 border border-church-blue/10">
                          <p className={cn('flex-1 font-mono text-sm font-bold text-center tracking-widest select-all', showSecret ? 'text-church-black' : 'blur-sm select-none text-church-blue')}>
                            {formattedSecret}
                          </p>
                          <button onClick={() => setShowSecret(s => !s)} className="p-1.5 text-church-gray hover:text-church-blue transition-colors">
                            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button onClick={handleCopySecret} className="p-1.5 text-church-gray hover:text-church-blue transition-colors">
                            {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Code input */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-church-gray uppercase tracking-widest">
                        Verification Code
                      </label>
                      <input
                        ref={codeInputRef}
                        type="text"
                        inputMode="numeric"
                        placeholder="000000"
                        value={tfaCode}
                        onChange={(e) => handleCodeChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerifySetup()}
                        maxLength={6}
                        className="w-full text-center text-3xl font-black tracking-[0.4em] py-4 bg-church-soft border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue text-church-black transition-colors"
                      />
                      {tfaError && (
                        <div className="flex items-center gap-2 text-red-600 text-xs font-medium">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          {tfaError}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleVerifySetup}
                      disabled={tfaCode.length !== 6 || tfaLoading}
                      className={cn(
                        'w-full py-5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all',
                        tfaCode.length === 6 && !tfaLoading
                          ? 'bg-church-blue text-white hover:bg-church-blue/90 shadow-lg shadow-church-blue/20 active:scale-95'
                          : 'bg-church-soft text-church-gray cursor-not-allowed'
                      )}
                    >
                      {tfaLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Verifying...
                        </span>
                      ) : 'Verify & Enable 2FA'}
                    </button>
                  </>
                ) : (
                  /* Disable flow */
                  <>
                    <p className="text-sm text-church-gray font-medium">
                      Enter the current code from your authenticator app to remove two-factor authentication.
                    </p>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-church-gray uppercase tracking-widest">
                        Authenticator Code
                      </label>
                      <input
                        ref={codeInputRef}
                        type="text"
                        inputMode="numeric"
                        placeholder="000000"
                        value={tfaCode}
                        onChange={(e) => handleCodeChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDisable()}
                        maxLength={6}
                        className="w-full text-center text-3xl font-black tracking-[0.4em] py-4 bg-church-soft border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-red-400 text-church-black transition-colors"
                      />
                      {tfaError && (
                        <div className="flex items-center gap-2 text-red-600 text-xs font-medium">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          {tfaError}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={closeModal}
                        className="flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-widest bg-church-soft text-church-gray hover:bg-church-blue/5 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDisable}
                        disabled={tfaCode.length !== 6 || tfaLoading}
                        className={cn(
                          'flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all',
                          tfaCode.length === 6 && !tfaLoading
                            ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20 active:scale-95'
                            : 'bg-church-soft text-church-gray cursor-not-allowed'
                        )}
                      >
                        {tfaLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            Verifying...
                          </span>
                        ) : 'Disable 2FA'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
