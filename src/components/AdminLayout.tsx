import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  Users,
  DollarSign,
  Calendar,
  MessageSquare,
  Settings,
  LogOut,
  Church,
  ClipboardList,
  Target,
  UserCheck,
  Package,
  Activity,
  Briefcase,
  Layers,
  MessageCircleQuestion,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from './AuthContext';
import { UserRole } from '@/src/types';

const sidebarItems = [
  { icon: BarChart3,            label: 'Dashboard',       path: '/admin',                roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.TREASURER, UserRole.SECRETARY] },
  { icon: Users,                label: 'Members',         path: '/admin/members',        roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.SECRETARY] },
  { icon: Layers,               label: 'Home Cell',       path: '/admin/home-cell',      roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.SECRETARY] },
  { icon: Activity,             label: 'Attendance',      path: '/admin/attendance',     roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.SECRETARY] },
  { icon: DollarSign,           label: 'Finance',         path: '/admin/finance',        roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.TREASURER] },
  { icon: Briefcase,            label: 'HR & Payroll',    path: '/admin/hr',             roles: [UserRole.ADMIN, UserRole.PASTOR] },
  { icon: Calendar,             label: 'Events',          path: '/admin/events',         roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.SECRETARY] },
  { icon: MessageSquare,        label: 'Prayer Requests', path: '/admin/prayer-requests',roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.DPT_LEADER] },
  { icon: ClipboardList,        label: 'Requisitions',    path: '/admin/requisitions',   roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.TREASURER, UserRole.DPT_LEADER] },
  { icon: Target,               label: 'Project Pledges', path: '/admin/pledges',        roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.TREASURER] },
  { icon: UserCheck,            label: 'Visitor Care',    path: '/admin/visitors',       roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.SECRETARY] },
  { icon: Package,              label: 'Assets',          path: '/admin/assets',         roles: [UserRole.ADMIN, UserRole.TREASURER] },
  { icon: Settings,             label: 'Communications',  path: '/admin/communications', roles: [UserRole.ADMIN, UserRole.PASTOR] },
  { icon: Settings,             label: 'Configurations',  path: '/admin/configurations', roles: [UserRole.ADMIN] },
  { icon: MessageCircleQuestion,label: 'Ask a Question',  path: '/admin/ask',            roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.TREASURER] },
];

export default function AdminLayout() {
  const location  = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-close sidebar on route change (mobile navigation)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const currentLabel = sidebarItems.find(i => i.path === location.pathname)?.label ?? 'Dashboard';

  return (
    <div className="flex h-screen bg-church-soft font-sans text-church-black overflow-hidden">

      {/* ── Mobile overlay backdrop ───────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      {/*  Mobile: fixed overlay that slides in from left              */}
      {/*  Desktop (md+): always visible in the flex row               */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 lg:w-72 bg-church-blue flex flex-col shadow-2xl transition-transform duration-300 ease-in-out',
          'md:relative md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Logo + close button */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="bg-church-yellow p-2 rounded-xl rotate-3 shadow-lg shadow-church-yellow/20 flex-shrink-0">
            <Church className="text-church-black w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-display font-extrabold text-white leading-none tracking-tight">GraceFlow</h1>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-church-yellow/80">Management</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-blue-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 custom-scrollbar">
          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group',
                  isActive
                    ? 'bg-church-yellow text-church-black font-bold shadow-[0_4px_14px_-2px_rgba(253,224,71,0.4)]'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white',
                )}
              >
                <item.icon className={cn('w-4 h-4 flex-shrink-0 transition-colors', isActive ? 'text-church-black' : 'text-blue-300 group-hover:text-white')} />
                <span className="text-sm truncate">{item.label}</span>
                {isActive && (
                  <motion.div layoutId="activeTab" className="ml-auto flex-shrink-0">
                    <div className="w-1 h-5 bg-church-black rounded-full" />
                  </motion.div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        <div className="p-3 mt-auto">
          <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
            <Link
              to="/portal"
              className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest bg-church-yellow text-church-black py-2.5 rounded-xl w-full transition-all mb-3 shadow-md hover:scale-[1.02] active:scale-95"
            >
              <Users className="w-3 h-3" />
              Member Portal
            </Link>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-church-yellow flex items-center justify-center text-church-black font-bold text-sm flex-shrink-0">
                {user?.displayName?.charAt(0) || 'A'}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-bold text-white truncate">{user?.displayName || 'Admin'}</p>
                <p className="text-[10px] text-blue-300 capitalize truncate">{user?.role || 'Administrator'}</p>
              </div>
            </div>
            <button
              onClick={() => { if (window.confirm('Confirm sign out?')) logout(); }}
              className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-red-500/20 text-blue-100 hover:text-white py-2.5 rounded-xl w-full transition-all"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header */}
        <header className="h-14 md:h-16 lg:h-20 flex bg-white items-center gap-3 px-3 sm:px-5 md:px-8 border-b border-church-blue/5 shadow-sm flex-shrink-0">

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-xl hover:bg-church-soft transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-church-black" />
          </button>

          {/* Page title */}
          <h1 className="font-display text-base sm:text-lg md:text-xl lg:text-2xl font-bold tracking-tight truncate flex-1">
            {currentLabel}
          </h1>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => alert('Settings panel coming soon.')}
              className="hidden lg:block px-5 py-2 border-2 border-church-blue/10 rounded-full text-xs font-bold uppercase tracking-widest text-church-gray hover:bg-church-soft transition-all"
            >
              Settings
            </button>
            <button
              onClick={() => alert('Preparing export...')}
              className="px-3 sm:px-5 py-2 bg-church-blue text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-lg shadow-church-blue/20 hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
            >
              <span className="hidden sm:inline">Export Data</span>
              <span className="sm:hidden text-[10px]">Export</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-church-soft p-3 sm:p-5 md:p-7 lg:p-10">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
