/**
 * Permission-aware Dashboard.
 *
 * Every widget, stat card, Firestore listener, quick action, and activity feed
 * is gated by the user's module permissions. If a user has no access to a
 * module, NEITHER the UI element NOR its underlying data subscription is set
 * up — preventing information leakage at both the display and network layer.
 *
 * Security model:
 *   Layer 1 — Firestore rules    : enforce isSignedIn() + church isolation
 *   Layer 2 — Module permissions : each widget checks hasModule() before
 *                                   subscribing to or displaying any data
 *   Layer 3 — Route guards       : ModuleGuard in App.tsx blocks direct URL access
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, TrendingUp, Heart, Calendar, ShieldCheck,
  DollarSign, Package, FileText, UserCheck, Activity,
  BarChart3, Building2, ClipboardList, MessageSquare,
  ArrowUpRight, Lock, ChevronRight,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '@/src/lib/utils';
import { db } from '@/src/lib/firebase';
import {
  collection, query, orderBy, limit, onSnapshot, where,
} from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-UG');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, loading, to,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  loading?: boolean;
  to?: string;
}) {
  const inner = (
    <div className="bg-white rounded-2xl border border-church-blue/8 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-all h-full">
      <div className="w-12 h-12 rounded-xl bg-church-blue/8 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-church-blue" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-church-gray mb-0.5">{label}</p>
        {loading
          ? <div className="h-6 w-20 bg-church-soft rounded animate-pulse mt-1" />
          : <p className="text-xl font-black text-church-black leading-none">{value}</p>}
        <p className="text-xs text-church-gray mt-0.5">{sub}</p>
      </div>
      {to && <ArrowUpRight className="w-4 h-4 text-church-gray/40 ml-auto flex-shrink-0" />}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function QuickLink({
  to, icon: Icon, label, badge, color,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: string;
  color: 'blue' | 'yellow';
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex flex-col items-center justify-center gap-2 p-5 rounded-2xl font-bold text-sm transition-all hover:scale-[1.03] shadow-sm',
        color === 'blue'
          ? 'bg-church-blue text-white hover:bg-church-blue/90'
          : 'bg-church-yellow text-church-black hover:bg-yellow-300',
      )}
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color === 'blue' ? 'bg-white/20' : 'bg-black/10')}>
        <Icon className="w-5 h-5" />
      </div>
      <span>{label}</span>
      {badge && (
        <span className={cn('text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full', color === 'blue' ? 'bg-white/20' : 'bg-black/10')}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function AccessDeniedWidget({ label }: { label: string }) {
  return (
    <div className="bg-church-soft border border-dashed border-church-blue/15 rounded-2xl p-5 flex items-center gap-3 opacity-50">
      <Lock className="w-4 h-4 text-church-gray flex-shrink-0" />
      <p className="text-xs text-church-gray italic">{label} — access restricted</p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { churchId, hasModule, isSuperAdmin, user } = useAuth();

  // ── Permission shortcuts ───────────────────────────────────────────────────
  const can = useMemo(() => ({
    members:        isSuperAdmin || hasModule('members'),
    finance:        isSuperAdmin || hasModule('finance'),
    hr:             isSuperAdmin || hasModule('hr'),
    assets:         isSuperAdmin || hasModule('assets'),
    visitors:       isSuperAdmin || hasModule('visitors'),
    prayer:         isSuperAdmin || hasModule('prayer'),
    requisitions:   isSuperAdmin || hasModule('requisitions'),
    events:         isSuperAdmin || hasModule('events'),
    attendance:     isSuperAdmin || hasModule('attendance'),
    communications: isSuperAdmin || hasModule('communications'),
    pledges:        isSuperAdmin || hasModule('pledges'),
  }), [isSuperAdmin, hasModule]);

  // ── State — only populated when user has the relevant permission ───────────
  const [memberCount,    setMemberCount]    = useState(0);
  const [activeMembers,  setActiveMembers]  = useState(0);
  const [convertsCount,  setConvertsCount]  = useState(0);
  const [totalFinance,   setTotalFinance]   = useState(0);
  const [employeeCount,  setEmployeeCount]  = useState(0);
  const [assetValue,     setAssetValue]     = useState(0);
  const [prayerCount,    setPrayerCount]    = useState(0);
  const [pendingReqs,    setPendingReqs]    = useState(0);
  const [recentPrayers,  setRecentPrayers]  = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);

  // ── Gated Firestore subscriptions ─────────────────────────────────────────
  // Each listener is ONLY set up if the user has the corresponding permission.
  // This prevents data from being fetched for restricted modules even if the
  // UI elements are somehow bypassed.
  useEffect(() => {
    if (!churchId) return;
    const subs: (() => void)[] = [];

    // Members — requires 'members' module
    if (can.members) {
      subs.push(onSnapshot(
        collection(db, 'churches', churchId, 'members'),
        snap => {
          setMemberCount(snap.size);
          setActiveMembers(snap.docs.filter(d => d.data().membershipStatus === 'Active').length);
        },
        err => console.error('Dashboard:members', err),
      ));
    }

    // Visitors / converts — requires 'visitors' module
    if (can.visitors) {
      const year = new Date().getFullYear();
      subs.push(onSnapshot(
        collection(db, 'churches', churchId, 'visitors'),
        snap => {
          setConvertsCount(snap.docs.filter(d => {
            const data = d.data();
            if (data.status !== 'Member') return false;
            const dateStr = data.visitationDate
              || (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toISOString() : data.createdAt);
            return !dateStr || new Date(dateStr).getFullYear() === year;
          }).length);
        },
        err => console.error('Dashboard:visitors', err),
      ));
    }

    // Finance — requires 'finance' module
    if (can.finance) {
      subs.push(onSnapshot(
        collection(db, 'churches', churchId, 'finance'),
        snap => setTotalFinance(snap.docs.reduce((s, d) => s + (Number(d.data().amount) || 0), 0)),
        err => console.error('Dashboard:finance', err),
      ));
    }

    // HR / Employees — requires 'hr' module
    if (can.hr) {
      subs.push(onSnapshot(
        collection(db, 'churches', churchId, 'employees'),
        snap => setEmployeeCount(snap.docs.filter(d => d.data().status === 'Active').length),
        err => console.error('Dashboard:employees', err),
      ));
    }

    // Assets — requires 'assets' module
    if (can.assets) {
      subs.push(onSnapshot(
        collection(db, 'churches', churchId, 'assets'),
        snap => setAssetValue(snap.docs.reduce((s, d) => s + (Number(d.data().value) || 0), 0)),
        err => console.error('Dashboard:assets', err),
      ));
    }

    // Prayer requests — requires 'prayer' module
    if (can.prayer) {
      subs.push(onSnapshot(
        collection(db, 'churches', churchId, 'prayerRequests'),
        snap => {
          setPrayerCount(snap.docs.filter(d => d.data().status === 'Pending').length);
          setRecentPrayers(
            [...snap.docs]
              .sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0))
              .slice(0, 4)
              .map(d => ({
                id: d.id,
                name: d.data().memberName || 'Anonymous',
                text: d.data().requestText?.substring(0, 60) ?? '',
                initials: (d.data().memberName || 'A')
                  .split(' ').map((n: string) => n[0]).join('').substring(0, 2),
              })),
          );
        },
        err => console.error('Dashboard:prayers', err),
      ));
    }

    // Requisitions — requires 'requisitions' module
    if (can.requisitions) {
      subs.push(onSnapshot(
        collection(db, 'churches', churchId, 'requisitions'),
        snap => setPendingReqs(snap.docs.filter(d => d.data().status === 'Pending').length),
        err => console.error('Dashboard:requisitions', err),
      ));
    }

    // Events — requires 'events' module
    if (can.events) {
      const today = new Date().toISOString().split('T')[0];
      subs.push(onSnapshot(
        query(
          collection(db, 'churches', churchId, 'events'),
          where('date', '>=', today),
          orderBy('date', 'asc'),
          limit(3),
        ),
        snap => setUpcomingEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => console.error('Dashboard:events', err),
      ));
    }

    setLoading(false);
    return () => subs.forEach(u => u());
  // Re-run whenever permissions change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [churchId, JSON.stringify(can)]);

  // ── Stat cards — each gated individually ──────────────────────────────────
  const statCards = useMemo(() => {
    const cards = [];

    if (can.members) cards.push({
      icon: Users,      label: 'Total Members',
      value: fmt(memberCount), sub: `${fmt(activeMembers)} active`,
      to: '/admin/members',
    });
    if (can.finance) cards.push({
      icon: DollarSign, label: 'Church Finance',
      value: formatCurrency(totalFinance), sub: 'Total collections',
      to: '/admin/finance',
    });
    if (can.hr) cards.push({
      icon: Activity,   label: 'Staff',
      value: fmt(employeeCount), sub: 'Active employees',
      to: '/admin/hr',
    });
    if (can.assets) cards.push({
      icon: Package,    label: 'Asset Value',
      value: formatCurrency(assetValue), sub: 'Total property',
      to: '/admin/assets',
    });
    if (can.visitors) cards.push({
      icon: UserCheck,  label: 'New Converts',
      value: fmt(convertsCount), sub: `Joined ${new Date().getFullYear()}`,
      to: '/admin/visitors',
    });
    if (can.prayer) cards.push({
      icon: Heart,      label: 'Prayer Requests',
      value: fmt(prayerCount), sub: 'Awaiting prayer',
      to: '/admin/prayer-requests',
    });
    if (can.requisitions) cards.push({
      icon: ClipboardList, label: 'Requisitions',
      value: fmt(pendingReqs), sub: 'Pending approval',
      to: '/admin/requisitions',
    });
    return cards;
  }, [can, memberCount, activeMembers, totalFinance, employeeCount,
      assetValue, convertsCount, prayerCount, pendingReqs]);

  // ── Quick actions — each gated individually ────────────────────────────────
  const quickLinks = useMemo(() => {
    const links: { to: string; icon: React.ElementType; label: string; badge?: string; color: 'blue' | 'yellow' }[] = [];
    if (can.requisitions) links.push({ to: '/admin/requisitions', icon: ClipboardList, label: 'Requisitions', badge: `${pendingReqs} pending`,  color: 'blue' });
    if (can.prayer)       links.push({ to: '/admin/prayer-requests', icon: Heart,       label: 'Prayers',       badge: `${prayerCount} pending`, color: 'yellow' });
    if (can.members)      links.push({ to: '/admin/members',         icon: Users,        label: 'Members',       badge: `${memberCount} total`,   color: 'blue' });
    if (can.finance)      links.push({ to: '/admin/finance',         icon: DollarSign,   label: 'Finance',                                         color: 'yellow' });
    if (can.events)       links.push({ to: '/admin/events',          icon: Calendar,     label: 'Events',                                          color: 'blue' });
    if (can.attendance)   links.push({ to: '/admin/attendance',      icon: BarChart3,    label: 'Attendance',                                      color: 'yellow' });
    if (can.hr)           links.push({ to: '/admin/hr',              icon: Activity,     label: 'HR & Payroll',                                    color: 'blue' });
    if (can.visitors)     links.push({ to: '/admin/visitors',        icon: UserCheck,    label: 'Visitors',                                        color: 'yellow' });
    if (can.assets)       links.push({ to: '/admin/assets',          icon: Package,      label: 'Assets',                                          color: 'blue' });
    if (can.communications) links.push({ to: '/admin/communications', icon: MessageSquare, label: 'Broadcast',                                     color: 'yellow' });
    return links;
  }, [can, pendingReqs, prayerCount, memberCount]);

  const hasNoAccess = statCards.length === 0 && quickLinks.length === 0;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">

      {/* Welcome bar */}
      <div className="bg-white rounded-2xl border border-church-blue/8 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-black text-church-black tracking-tight">
            Welcome back, {user?.displayName?.split(' ')[0] ?? 'Admin'}
          </h1>
          <p className="text-church-gray text-sm mt-0.5">
            {hasNoAccess
              ? 'Your account has no modules assigned yet. Contact your Super Admin.'
              : `Your personalized dashboard — ${statCards.length} module${statCards.length !== 1 ? 's' : ''} visible.`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {can.finance && (
            <Link to="/admin/finance" className="px-4 py-2 bg-white border border-church-blue/20 text-church-blue rounded-xl text-xs font-bold hover:bg-church-soft transition-all flex items-center gap-1.5">
              Finance Details <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
          {can.attendance && (
            <Link to="/admin/attendance" className="px-4 py-2 bg-church-blue text-white rounded-xl text-xs font-bold hover:bg-church-blue/90 transition-all">
              Record Attendance
            </Link>
          )}
        </div>
      </div>

      {/* No access at all */}
      {hasNoAccess && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-church-soft rounded-3xl flex items-center justify-center mb-5">
            <Lock className="w-9 h-9 text-church-gray/40" />
          </div>
          <h2 className="text-xl font-bold text-church-black mb-2">No modules assigned</h2>
          <p className="text-church-gray text-sm max-w-sm">
            Your account hasn't been granted access to any modules yet.
            Contact your <strong>Super Admin</strong> to assign permissions.
          </p>
        </div>
      )}

      {/* Stat cards — only permitted modules */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {statCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <StatCard {...card} loading={loading} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left column */}
        <div className="lg:col-span-8 space-y-6">

          {/* Quick actions — only permitted */}
          {quickLinks.length > 0 && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-church-gray mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {quickLinks.map(link => (
                  <QuickLink key={link.to} {...link} />
                ))}
              </div>
            </div>
          )}

          {/* Recent Prayer Activity — requires 'prayer' module */}
          {can.prayer && (
            <div className="bg-white rounded-2xl border border-church-blue/8 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-church-black">Recent Prayer Requests</h3>
                  <p className="text-church-gray text-xs mt-0.5">{prayerCount} awaiting prayer</p>
                </div>
                <Link to="/admin/prayer-requests" className="text-xs font-bold text-church-blue flex items-center gap-1 hover:underline">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {recentPrayers.length === 0 ? (
                <p className="text-church-gray text-sm text-center py-6">No prayer requests yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentPrayers.map(p => (
                    <div key={p.id} className="flex items-start gap-3 p-3 bg-church-soft rounded-xl">
                      <div className="w-9 h-9 rounded-full bg-church-blue flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {p.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-church-black">{p.name}</p>
                        <p className="text-xs text-church-gray truncate">{p.text}…</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 space-y-4">

          {/* Upcoming Events — requires 'events' module */}
          {can.events && (
            <div className="bg-church-black text-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Upcoming Events</h3>
                <Link to="/admin/events" className="text-xs text-church-yellow font-bold hover:underline">View all</Link>
              </div>
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-white/40 italic">No scheduled events.</p>
              ) : (
                <div className="space-y-4">
                  {upcomingEvents.map(ev => (
                    <div
                      key={ev.id}
                      className="flex gap-4 cursor-pointer group"
                      onClick={() => navigate('/admin/events')}
                    >
                      <div className="bg-white/10 rounded-xl px-3 py-2 text-center flex-shrink-0 min-w-[52px]">
                        <p className="text-[9px] font-bold text-white/50 uppercase">
                          {new Date(ev.date).toLocaleString('en-UG', { month: 'short' })}
                        </p>
                        <p className="text-lg font-black">{new Date(ev.date).getDate()}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold group-hover:text-church-yellow transition-colors truncate">{ev.title}</p>
                        <p className="text-[10px] text-white/40 mt-0.5">{ev.time} · {ev.location}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* System Status — always visible */}
          <div className="bg-church-soft border border-church-blue/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-church-blue" />
              <span className="text-xs font-black uppercase tracking-wider text-church-gray">System Status</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-xs text-church-gray">All services operational</p>
            </div>
            <div className="mt-3 h-1 bg-church-blue/10 rounded-full overflow-hidden">
              <div className="h-full bg-church-blue w-full rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
