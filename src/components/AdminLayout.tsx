import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3, Users, DollarSign, Calendar, MessageSquare,
  Settings, LogOut, Church, ClipboardList, Target, UserCheck,
  Package, Activity, Briefcase, Layers, MessageCircleQuestion,
  Menu, X, ShieldCheck, Receipt,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from './AuthContext';
import { UserRole } from '@/src/types';

// ─── Role badge config ────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.PLATFORM_OWNER]: 'Platform Owner',
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.ADMIN]: 'Admin',
  [UserRole.DEPARTMENT_HEAD]: 'Dept Head',
  [UserRole.MEMBER]: 'Member',
};

const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.PLATFORM_OWNER]: 'bg-church-yellow/30 text-church-yellow',
  [UserRole.SUPER_ADMIN]: 'bg-church-yellow text-church-black',
  [UserRole.ADMIN]: 'bg-blue-400/20 text-blue-100',
  [UserRole.DEPARTMENT_HEAD]: 'bg-emerald-400/20 text-emerald-200',
  [UserRole.MEMBER]: 'bg-white/10 text-blue-200',
};

// ─── All sidebar items mapped to module IDs ───────────────────────────────────
// module: null → always visible (no permission check)
// module: string → must be in hasModule()

const ALL_SIDEBAR_ITEMS = [
  { module: 'dashboard',      icon: BarChart3,             label: 'Dashboard',       path: '/admin' },
  { module: 'members',        icon: Users,                 label: 'Members',         path: '/admin/members' },
  { module: 'home_cell',      icon: Layers,                label: 'Home Cell',       path: '/admin/home-cell' },
  { module: 'attendance',     icon: Activity,              label: 'Attendance',      path: '/admin/attendance' },
  { module: 'finance',        icon: DollarSign,            label: 'Finance',         path: '/admin/finance' },
  { module: 'daily_expenses', icon: Receipt,               label: 'Daily Expenses',  path: '/admin/daily-expenses' },
  { module: 'hr',             icon: Briefcase,             label: 'HR & Payroll',    path: '/admin/hr' },
  { module: 'events',         icon: Calendar,              label: 'Events',          path: '/admin/events' },
  { module: 'prayer',         icon: MessageSquare,         label: 'Prayer Requests', path: '/admin/prayer-requests' },
  { module: 'requisitions',   icon: ClipboardList,         label: 'Requisitions',    path: '/admin/requisitions' },
  { module: 'communications', icon: Settings,              label: 'Communications',  path: '/admin/communications' },
  { module: 'pledges',        icon: Target,                label: 'Project Pledges', path: '/admin/pledges' },
  { module: 'visitors',       icon: UserCheck,             label: 'Visitor Care',    path: '/admin/visitors' },
  { module: 'assets',         icon: Package,               label: 'Assets',          path: '/admin/assets' },
  { module: 'ask',            icon: MessageCircleQuestion, label: 'Ask a Question',  path: '/admin/ask' },
  // Member Accounts — requires members:manage_accounts action
  { module: 'members',        icon: ShieldCheck,           label: 'Member Accounts', path: '/admin/member-accounts', actionRequired: 'members:manage_accounts' },
  // User Management — requires users module
  { module: 'users',          icon: Users,                 label: 'User Management', path: '/admin/users' },
  // Audit Trail — requires audit module
  { module: 'audit',          icon: ShieldCheck,           label: 'Audit Trail',     path: '/admin/audit' },
  // Settings — super admin only
  { module: null,             icon: Settings,              label: 'Settings',        path: '/admin/settings', superAdminOnly: true },
] as const;

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, church, logout, isSuperAdmin, hasModule, hasAction, isPlatformOwner } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Dynamically filter sidebar based on permissions
  const visibleItems = ALL_SIDEBAR_ITEMS.filter(item => {
    if ((item as any).superAdminOnly) return isSuperAdmin;
    const actionReq = (item as any).actionRequired as string | undefined;
    if (actionReq) return isSuperAdmin || hasAction(actionReq);
    if (!item.module) return true;
    return isSuperAdmin || hasModule(item.module);
  });

  const currentLabel = visibleItems.find(i => i.path === location.pathname)?.label ?? 'Dashboard';
  const role = user?.role ?? UserRole.ADMIN;

  return (
    <div className="flex h-screen bg-church-soft font-sans text-church-black overflow-hidden">

      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 lg:w-72 bg-church-blue flex flex-col shadow-2xl transition-transform duration-300 ease-in-out',
        'md:relative md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="bg-church-yellow p-2 rounded-xl rotate-3 shadow-lg shadow-church-yellow/20 flex-shrink-0">
            <Church className="text-church-black w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-display font-extrabold text-white leading-none tracking-tight truncate">
              {church?.name ?? 'GraceFlow'}
            </h1>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-church-yellow/80">Management</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-blue-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 custom-scrollbar">
          {visibleItems.map(item => {
            const isActive = location.pathname === item.path;
            const isSep = (item as any).superAdminOnly;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group',
                  isSep && 'mt-2 border-t border-white/10 pt-3',
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
            {/* Platform Console link — Platform Owner only */}
            {isPlatformOwner && (
              <button
                onClick={() => navigate('/platform')}
                className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest bg-church-yellow text-church-black py-2 rounded-xl w-full transition-all mb-2 hover:bg-yellow-300 shadow-md"
              >
                <ShieldCheck className="w-3 h-3" />
                Platform Console
              </button>
            )}
            {/* User info */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-church-yellow flex items-center justify-center text-church-black font-bold text-sm flex-shrink-0">
                {user?.displayName?.charAt(0) ?? 'A'}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-bold text-white truncate">{user?.displayName ?? 'Admin'}</p>
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider mt-0.5', ROLE_COLORS[role])}>
                  <ShieldCheck className="w-2.5 h-2.5" />
                  {ROLE_LABELS[role]}
                </span>
              </div>
            </div>

            {/* Sign out */}
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

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 md:h-16 lg:h-20 flex bg-white items-center gap-3 px-3 sm:px-5 md:px-8 border-b border-church-blue/5 shadow-sm flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-xl hover:bg-church-soft transition-colors flex-shrink-0"
          >
            <Menu className="w-5 h-5 text-church-black" />
          </button>
          <h1 className="font-display text-base sm:text-lg md:text-xl lg:text-2xl font-bold tracking-tight truncate flex-1">
            {currentLabel}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => alert('Preparing export...')}
              className="px-3 sm:px-5 py-2 bg-church-blue text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-lg shadow-church-blue/20 hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
            >
              <span className="hidden sm:inline">Export Data</span>
              <span className="sm:hidden text-[10px]">Export</span>
            </button>
          </div>
        </header>

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
