import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  Users, 
  ClipboardCheck, 
  DollarSign, 
  Calendar, 
  MessageSquare, 
  Settings, 
  LogOut,
  ChevronRight,
  Church,
  ClipboardList,
  Target,
  UserCheck,
  Package,
  Activity,
  Briefcase
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from './AuthContext';
import { UserRole } from '@/src/types';

const sidebarItems = [
  { icon: BarChart3, label: 'Dashboard', path: '/admin', roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.TREASURER, UserRole.SECRETARY] },
  { icon: Users, label: 'Members', path: '/admin/members', roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.SECRETARY] },
  { icon: Activity, label: 'Attendance', path: '/admin/attendance', roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.SECRETARY] },
  { icon: DollarSign, label: 'Finance', path: '/admin/finance', roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.TREASURER] },
  { icon: Briefcase, label: 'HR & Payroll', path: '/admin/hr', roles: [UserRole.ADMIN, UserRole.PASTOR] },
  { icon: Calendar, label: 'Events', path: '/admin/events', roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.SECRETARY] },
  { icon: MessageSquare, label: 'Prayer Requests', path: '/admin/prayer-requests', roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.DPT_LEADER] },
  { icon: ClipboardList, label: 'Requisitions', path: '/admin/requisitions', roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.TREASURER, UserRole.DPT_LEADER] },
  { icon: Target, label: 'Project Pledges', path: '/admin/pledges', roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.TREASURER] },
  { icon: UserCheck, label: 'Visitor Care', path: '/admin/visitors', roles: [UserRole.ADMIN, UserRole.PASTOR, UserRole.SECRETARY] },
  { icon: Package, label: 'Assets & Inventory', path: '/admin/assets', roles: [UserRole.ADMIN, UserRole.TREASURER] },
  { icon: Settings, label: 'Communications', path: '/admin/communications', roles: [UserRole.ADMIN, UserRole.PASTOR] },
];

export default function AdminLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();

  // During vetting phase, everyone sees all items
  const filteredItems = sidebarItems;

  return (
    <div className="flex h-screen bg-white font-sans text-church-black overflow-hidden">
      {/* Sidebar - Fix height and background consistency */}
      <aside className="w-72 bg-church-blue flex flex-col h-full shadow-2xl z-20 overflow-hidden">
        <div className="p-8 pb-4 flex items-center gap-3">
          <div className="bg-church-yellow p-2 rounded-xl rotate-3 shadow-lg shadow-church-yellow/20">
            <Church className="text-church-black w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-display font-extra-bold text-white leading-none tracking-tight">
              GraceFlow
            </h1>
            <span className="text-[9px] font-sans font-bold uppercase tracking-[0.2em] text-church-yellow/80">Management</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-6 py-4 space-y-1 custom-scrollbar">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group",
                  isActive 
                    ? "bg-church-yellow text-church-black shadow-[0_8px_20px_-4px_rgba(253,224,71,0.3)] font-bold scale-[1.02]" 
                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-church-black" : "text-blue-300 group-hover:text-white")} />
                <span className="text-sm tracking-wide">{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="activeTab"
                    className="ml-auto"
                  >
                    <div className="w-1.5 h-6 bg-church-black rounded-full" />
                  </motion.div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 mt-auto">
          <div className="p-5 bg-white/10 rounded-3xl border border-white/10 backdrop-blur-md">
            <Link 
              to="/portal" 
              className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest bg-church-yellow text-church-black hover:scale-[1.05] py-3 rounded-xl w-full transition-all mb-4 shadow-lg shadow-church-yellow/20"
            >
              <Users className="w-3 h-3" />
              Member Portal
            </Link>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-church-yellow flex items-center justify-center text-church-black font-bold">
                {user?.displayName?.charAt(0) || 'A'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{user?.displayName || 'Admin'}</p>
                <p className="text-[10px] text-blue-300 capitalize">{user?.role || 'Administrator'}</p>
              </div>
            </div>
            <button 
              onClick={() => {
                if (window.confirm("Confirm sign out?")) logout();
              }}
              className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-red-500/20 text-blue-100 hover:text-white py-3 rounded-xl w-full transition-all"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-church-soft overflow-hidden">
        <header className="h-20 flex bg-white items-center justify-between px-10 border-b border-church-blue/5 shadow-sm">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {sidebarItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => alert("Settings panel module is coming soon.")}
              className="px-6 py-2.5 border-2 border-church-blue/10 rounded-full text-xs font-bold uppercase tracking-widest text-church-gray hover:bg-church-soft transition-all"
            >
              Settings
            </button>
            <button 
              onClick={() => alert("Preparing system export report...")}
              className="px-6 py-2.5 bg-church-blue text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-xl shadow-church-blue/20 hover:scale-105 active:scale-95 transition-all"
            >
              Export Global Data
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-10 bg-church-soft">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
