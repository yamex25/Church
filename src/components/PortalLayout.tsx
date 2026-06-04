import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Home,
  User,
  Heart,
  History,
  CalendarDays,
  LogOut,
  Bell,
  Church,
  FileText,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from './AuthContext';
import { useState, useRef, useEffect } from 'react';

function TwoFactorGate() {
  const { verifyTwoFactor, logout } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    const valid = await verifyTwoFactor(code);
    if (!valid) setError('Incorrect code. Check your authenticator app and try again.');
    setLoading(false);
  };

  const handleCodeChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    setError('');
  };

  return (
    <div className="min-h-screen bg-church-soft flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[48px] p-12 shadow-2xl shadow-church-blue/10 border border-church-blue/5 text-center"
      >
        <div className="w-20 h-20 bg-church-blue/10 rounded-[28px] mx-auto mb-8 flex items-center justify-center">
          <ShieldCheck className="w-10 h-10 text-church-blue" />
        </div>

        <h2 className="text-2xl font-display font-black text-church-black tracking-tight mb-2">
          Two-Factor Authentication
        </h2>
        <p className="text-sm text-church-gray font-medium mb-10 max-w-[280px] mx-auto">
          Enter the 6-digit code from your authenticator app to access the portal.
        </p>

        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          placeholder="000000"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          maxLength={6}
          className="w-full text-center text-4xl font-black tracking-[0.5em] py-5 bg-church-soft border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue text-church-black transition-colors mb-4"
        />

        {error && (
          <div className="flex items-center justify-center gap-2 text-red-600 text-xs font-medium mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={code.length !== 6 || loading}
          className={cn(
            'w-full py-5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all mb-6',
            code.length === 6 && !loading
              ? 'bg-church-blue text-white hover:bg-church-blue/90 shadow-lg shadow-church-blue/20 active:scale-95'
              : 'bg-church-soft text-church-gray cursor-not-allowed'
          )}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Verifying...
            </span>
          ) : 'Verify & Enter Portal'}
        </button>

        <button
          onClick={() => { if (window.confirm('Sign out from GraceFlow?')) logout(); }}
          className="text-[10px] font-black uppercase tracking-widest text-church-gray hover:text-red-600 transition-colors flex items-center justify-center gap-2 mx-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </motion.div>

      <p className="mt-10 text-[10px] font-black uppercase tracking-[0.2em] text-church-gray">
        GraceFlow Systems &bull; Secured Access
      </p>
    </div>
  );
}

const navItems = [
  { icon: Home, label: 'Portal', path: '/portal' },
  { icon: User, label: 'Profile', path: '/portal/profile' },
  { icon: History, label: 'Contributions', path: '/portal/contributions' },
  { icon: Heart, label: 'Prayer', path: '/portal/prayer-requests' },
  { icon: FileText, label: 'Requisitions', path: '/portal/requisitions' },
  { icon: CalendarDays, label: 'Events', path: '/portal/events' },
  { icon: Church, label: 'Admin Panel', path: '/admin' }, // Added for vetting
];

export default function PortalLayout() {
  const location = useLocation();
  const { logout, twoFactorEnabled, twoFactorVerified } = useAuth();

  if (twoFactorEnabled && !twoFactorVerified) {
    return <TwoFactorGate />;
  }

  const handleNotificationClick = () => {
    alert("You have no new notifications.");
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to sign out from the Member Portal?")) {
      logout();
    }
  };

  return (
    <div className="min-h-screen bg-church-soft font-sans text-church-black pb-20 md:pb-0">
      {/* Desktop Header */}
      <header className="hidden md:flex bg-church-blue border-b border-white/10 h-20 items-center justify-between px-10 sticky top-0 z-20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-church-yellow p-2 rounded-lg rotate-3">
            <Church className="text-church-black w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-display font-black text-white leading-tight">
              GraceFlow
            </h1>
            <span className="text-[8px] font-sans font-bold uppercase tracking-[0.2em] text-church-yellow/80">Member Portal</span>
          </div>
        </div>
        
        <nav className="flex items-center gap-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                  isActive 
                    ? "bg-church-yellow text-church-black shadow-lg shadow-church-yellow/20" 
                    : "text-blue-100 hover:bg-white/10"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <button 
            onClick={handleNotificationClick}
            className="p-2.5 text-blue-100 hover:bg-white/10 rounded-full transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-church-yellow rounded-full border-2 border-church-blue"></span>
          </button>
          <div className="h-8 w-[1px] bg-white/10 mx-2" />
          <button 
            onClick={handleLogout}
            className="text-[10px] font-black uppercase tracking-widest text-church-yellow hover:text-white transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Mobile Top Header */}
      <div className="md:hidden flex bg-church-blue border-b border-white/10 h-16 items-center justify-between px-6 sticky top-0 z-20 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="bg-church-yellow p-1.5 rounded flex items-center justify-center">
            <Church className="text-church-black w-5 h-5" />
          </div>
          <h1 className="text-lg font-display font-black text-white italic">GraceFlow</h1>
        </div>
        <button 
          onClick={handleNotificationClick}
          className="p-2 text-blue-100 relative"
        >
          <Bell className="w-6 h-6" />
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-church-yellow rounded-full border-2 border-church-blue"></span>
        </button>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto p-6 md:p-12">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-church-blue border-t border-white/10 h-20 flex items-center justify-around px-4 z-20 shadow-[0_-10px_30px_-5px_rgba(30,64,175,0.3)]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 w-full h-full transition-all",
                isActive ? "text-church-yellow scale-110" : "text-blue-200 opacity-60"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive ? "stroke-[3px]" : "stroke-[2px]")} />
              <span className="text-[9px] font-black uppercase tracking-[0.15em]">{item.label}</span>
              {isActive && (
                <motion.div 
                  layoutId="mobileActiveTab"
                  className="absolute bottom-3 w-1.5 h-1.5 bg-church-yellow rounded-full shadow-[0_0_10px_rgba(253,224,71,0.8)]"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
