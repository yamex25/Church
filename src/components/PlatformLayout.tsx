import { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Crown, LogOut, ShieldAlert, LayoutDashboard, Key, LayoutGrid } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from './AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

export default function PlatformLayout() {
  const { user, isPlatformOwner, logout } = useAuth();
  const location = useLocation();

  // Live count of pending requests for the badge
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    if (!isPlatformOwner) return;
    return onSnapshot(
      query(collection(db, 'activationRequests'), where('status', '==', 'pending')),
      snap => setPendingCount(snap.size),
      () => setPendingCount(0),
    );
  }, [isPlatformOwner]);

  const NAV = [
    { path: '/platform',                   label: 'Dashboard',        icon: LayoutDashboard, badge: 0 },
    { path: '/platform/activation-codes',  label: 'Activation Codes', icon: Key,             badge: pendingCount },
    { path: '/platform/plans',             label: 'Plan Manager',     icon: LayoutGrid,      badge: 0 },
  ];

  if (!isPlatformOwner) {
    return (
      <div className="min-h-screen bg-church-soft flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm bg-white rounded-3xl p-10 shadow-2xl shadow-red-900/10 border border-red-100 text-center"
        >
          <div className="w-16 h-16 bg-red-50 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-display font-black text-church-black tracking-tight mb-2">Unauthorized</h2>
          <p className="text-sm text-church-gray font-medium mb-8">
            This area is restricted to Platform Owners only.
          </p>
          <button
            onClick={() => logout()}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black uppercase tracking-widest transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-church-soft font-sans text-church-black flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#1a1f2e] border-b border-white/10 shadow-xl">
        <div className="flex items-center justify-between h-16 px-5 md:px-10">
          {/* Branding */}
          <div className="flex items-center gap-3">
            <div className="bg-church-yellow/20 p-2.5 rounded-xl border border-church-yellow/30 flex-shrink-0">
              <Crown className="w-5 h-5 text-church-yellow" />
            </div>
            <div>
              <h1 className="text-base font-display font-black text-white leading-none">GraceFlow Platform</h1>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-church-yellow/70 mt-0.5 block">Owner Console</span>
            </div>
          </div>

          {/* Nav tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(n => {
              const active = location.pathname === n.path;
              return (
                <Link
                  key={n.path}
                  to={n.path}
                  className={cn(
                    'relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
                    active
                      ? 'bg-church-yellow/20 text-church-yellow border border-church-yellow/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/10',
                  )}
                >
                  <n.icon className="w-3.5 h-3.5" />
                  {n.label}
                  {n.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                      {n.badge > 9 ? '9+' : n.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User + sign out */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-white leading-none">{user?.displayName ?? 'Platform Owner'}</span>
              <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-church-yellow/20 text-church-yellow border border-church-yellow/30">
                <Crown className="w-2.5 h-2.5" /> Platform Owner
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-church-yellow/20 border border-church-yellow/40 flex items-center justify-center text-church-yellow font-black text-sm flex-shrink-0">
              {user?.displayName?.charAt(0)?.toUpperCase() ?? 'P'}
            </div>
            <button
              onClick={() => { if (window.confirm('Sign out?')) logout(); }}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-church-yellow/70 hover:text-church-yellow transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden flex border-t border-white/10">
          {NAV.map(n => {
            const active = location.pathname === n.path;
            return (
              <Link
                key={n.path}
                to={n.path}
                className={cn(
                  'relative flex-1 flex flex-col items-center py-2.5 text-[10px] font-bold uppercase tracking-wider gap-1 transition-colors',
                  active ? 'text-church-yellow bg-church-yellow/10' : 'text-gray-500 hover:text-gray-300',
                )}
              >
                <n.icon className="w-4 h-4" />
                {n.label}
                {n.badge > 0 && (
                  <span className="absolute top-1 right-1/4 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                    {n.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-10 py-6 md:py-10">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
