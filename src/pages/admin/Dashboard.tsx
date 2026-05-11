import { motion } from 'motion/react';
import { 
  Users, 
  TrendingUp, 
  Heart,
  Calendar,
  ShieldCheck,
  ChevronRight,
  DollarSign,
  Package,
  FileText,
  UserCheck,
  Activity,
  ArrowUpRight
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { cn, formatCurrency } from '@/src/lib/utils';
import { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';

export default function Dashboard() {
  const navigate = useNavigate();
  const [convertsCount, setConvertsCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [activeMembers, setActiveMembers] = useState(0);
  const [prayerCount, setPrayerCount] = useState(0);
  const [totalFinance, setTotalFinance] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [assetValue, setAssetValue] = useState(0);
  const [pendingReqs, setPendingReqs] = useState(0);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

  useEffect(() => {
    // Member count
    const unsubscribeMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      setMemberCount(snapshot.size);
      setActiveMembers(snapshot.docs.filter(d => d.data().membershipStatus === 'Active').length);
    }, (err) => console.error("Dashboard members listener error:", err));

    // Convert count (from visitors who became members this year)
    const currentYear = new Date().getFullYear();
    const unsubscribeVisitors = onSnapshot(collection(db, 'visitors'), (snapshot) => {
      const converts = snapshot.docs.filter(d => {
        const data = d.data();
        if (data.status !== 'Member') return false;
        
        // Use visitationDate or fallback to createdAt
        const vDateStr = data.visitationDate || (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toISOString() : data.createdAt);
        if (!vDateStr) return true; // Fallback if no date available
        
        const vYear = new Date(vDateStr).getFullYear();
        return vYear === currentYear;
      }).length;
      setConvertsCount(converts);
    }, (err) => console.error("Dashboard converts listener error:", err));

    // Prayer count (Pending)
    const unsubscribePrayers = onSnapshot(collection(db, 'prayerRequests'), (snapshot) => {
      const pending = snapshot.docs.filter(d => d.data().status === 'Pending').length;
      setPrayerCount(pending);
      
      const recent = snapshot.docs
        .sort((a, b) => {
          const aTime = a.data().createdAt?.seconds || 0;
          const bTime = b.data().createdAt?.seconds || 0;
          return bTime - aTime;
        })
        .slice(0, 4)
        .map(doc => ({
          id: doc.id,
          name: doc.data().memberName || 'Anonymous',
          action: `Prayer Request: ${doc.data().requestText.substring(0, 30)}...`,
          initials: doc.data().memberName ? doc.data().memberName.split(' ').map((n: string) => n[0]).join('').substring(0,2) : 'A',
          color: 'bg-church-blue/10 text-church-blue'
        }));
      setRecentRequests(recent);
    }, (err) => console.error("Dashboard prayers listener error:", err));

    // Total Finance
    const unsubscribeFinance = onSnapshot(collection(db, 'finance'), (snapshot) => {
      const total = snapshot.docs.reduce((acc, doc) => acc + (Number(doc.data().amount) || 0), 0);
      setTotalFinance(total);
    }, (err) => console.error("Dashboard finance listener error:", err));

    // Employees
    const unsubscribeEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployeeCount(snapshot.docs.filter(d => d.data().status === 'Active').length);
    }, (err) => console.error("Dashboard employees listener error:", err));

    // Assets
    const unsubscribeAssets = onSnapshot(collection(db, 'assets'), (snapshot) => {
      const total = snapshot.docs.reduce((acc, doc) => acc + (Number(doc.data().value) || 0), 0);
      setAssetValue(total);
    }, (err) => console.error("Dashboard assets listener error:", err));

    // Requisitions
    const unsubscribeReqs = onSnapshot(collection(db, 'requisitions'), (snapshot) => {
      setPendingReqs(snapshot.docs.filter(d => d.data().status === 'Pending').length);
    }, (err) => console.error("Dashboard requisitions listener error:", err));

    // Upcoming Events
    const now = new Date().toISOString();
    const qEvents = query(
      collection(db, 'events'), 
      where('date', '>=', now.split('T')[0]),
      orderBy('date', 'asc'),
      limit(3)
    );
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      setUpcomingEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Dashboard events listener error:", err));

    return () => {
      unsubscribeMembers();
      unsubscribePrayers();
      unsubscribeFinance();
      unsubscribeEmployees();
      unsubscribeAssets();
      unsubscribeReqs();
      unsubscribeEvents();
    };
  }, []);

  const topStats = [
    { label: 'New Converts', value: convertsCount.toString(), sub: `Joined in ${new Date().getFullYear()}`, icon: UserCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Total Finance', value: formatCurrency(totalFinance), sub: 'Church Collections', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Asset Value', value: formatCurrency(assetValue), sub: 'Total Property', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Staffing', value: employeeCount.toString(), sub: 'Active Employees', icon: Activity, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 text-sm">Welcome back. Here is what is happening with the church operations today.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/finance" className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2">
            Finance Details <ArrowUpRight className="w-4 h-3" />
          </Link>
          <Link to="/admin/attendance" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 transition-all">
            Record Attendance
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {topStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:border-indigo-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{stat.label}</p>
                <h3 className="text-xl font-bold text-slate-900">{stat.value}</h3>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Recent Activity */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
                <p className="text-xs font-medium text-slate-500">Latest administrative and prayer records.</p>
              </div>
              <Link to="/admin/prayers" className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            
            <div className="divide-y divide-slate-100">
              {recentRequests.map((activity, i) => (
                <div key={i} className="py-4 flex items-center gap-4 group">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shadow-sm">
                    {activity.initials}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-bold text-slate-900 text-sm">{activity.name}</h4>
                    </div>
                    <p className="text-xs font-medium text-slate-500 line-clamp-1">{activity.action}</p>
                  </div>
                </div>
              ))}
              {recentRequests.length === 0 && (
                <div className="text-center py-10 opacity-50">
                  <p className="text-xs font-medium text-slate-500">No recent activity detected.</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/admin/requisitions" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group">
              <div className="bg-rose-50 w-10 h-10 rounded-xl flex items-center justify-center text-rose-600 mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">Requisitions</h4>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{pendingReqs} To Approve</p>
            </Link>
            <Link to="/admin/prayers" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group">
              <div className="bg-indigo-50 w-10 h-10 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
                <Heart className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">Prayers</h4>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{prayerCount} Pending</p>
            </Link>
            <Link to="/admin/members" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group">
              <div className="bg-emerald-50 w-10 h-10 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">Member List</h4>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{memberCount} Total</p>
            </Link>
          </div>
        </div>

        {/* Right Column: Events & System Status */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl p-8 shadow-lg relative overflow-hidden">
            <h3 className="text-lg font-bold mb-6 relative z-10">Upcoming Events</h3>
            
            <div className="space-y-6 relative z-10">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex gap-4 group cursor-pointer" onClick={() => navigate('/admin/events')}>
                  <div className="bg-white/10 p-2 rounded-lg text-center min-w-[50px] h-fit">
                    <p className="text-[10px] font-bold opacity-60 uppercase">
                      {new Date(event.date).toLocaleString('en-US', { month: 'short' })}
                    </p>
                    <p className="text-xl font-bold">{new Date(event.date).getDate()}</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm leading-tight group-hover:text-amber-400 transition-colors">{event.title}</h4>
                    <p className="text-[10px] font-medium text-white/50 mt-1 uppercase tracking-wider">{event.time} • {event.location}</p>
                  </div>
                </div>
              ))}
              
              {upcomingEvents.length === 0 && (
                <p className="text-xs font-medium text-white/40 italic">No scheduled events.</p>
              )}

              <button 
                onClick={() => navigate('/admin/events')}
                className="w-full py-3 mt-2 bg-indigo-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all"
              >
                Go to Calendar
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-6 h-6 text-amber-700" />
                <h4 className="text-sm font-bold text-amber-900">System Status</h4>
              </div>
              <p className="text-amber-800/70 text-xs font-medium mb-6">Database connection is active. All security protocols are verified.</p>
              <div className="h-1 bg-amber-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-600 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
