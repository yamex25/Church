import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Network, Phone, Mail, Users, Crown,
  Layers, UserCircle, AlertCircle, MapPin,
  ChevronRight, Star,
} from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { Member } from '@/src/types';
import { cn, calculateAge } from '@/src/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadState = 'loading' | 'no_member' | 'no_cell' | 'ready';

// ─── Sub-components ───────────────────────────────────────────────────────────

function LeaderCard({
  title,
  leader,
  color,
}: {
  title: string;
  leader: Member | null;
  color: 'blue' | 'yellow';
}) {
  if (!leader) {
    return (
      <div className={cn(
        'rounded-2xl border p-5 flex items-center gap-3',
        color === 'blue'
          ? 'bg-church-blue/5 border-church-blue/10'
          : 'bg-church-yellow/5 border-church-yellow/20',
      )}>
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
          color === 'blue' ? 'bg-church-blue/10' : 'bg-church-yellow/10',
        )}>
          <Crown className={cn('w-5 h-5', color === 'blue' ? 'text-church-blue/40' : 'text-church-yellow/40')} />
        </div>
        <div>
          <p className="text-xs font-bold text-church-gray uppercase tracking-wider">{title}</p>
          <p className="text-church-gray text-sm">Not assigned</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5',
        color === 'blue'
          ? 'bg-church-blue/5 border-church-blue/15'
          : 'bg-church-yellow/5 border-church-yellow/25',
      )}
    >
      <p className={cn(
        'text-[10px] font-black uppercase tracking-[0.2em] mb-3',
        color === 'blue' ? 'text-church-blue' : 'text-church-yellow',
      )}>
        {title}
      </p>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg flex-shrink-0',
          color === 'blue' ? 'bg-church-blue' : 'bg-church-yellow text-church-black',
        )}>
          {leader.photoUrl
            ? <img src={leader.photoUrl} alt={leader.name} className="w-12 h-12 rounded-full object-cover" />
            : leader.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-church-black text-sm truncate">{leader.name}</p>
            <Crown className={cn('w-3.5 h-3.5 flex-shrink-0', color === 'blue' ? 'text-church-blue' : 'text-church-yellow')} />
          </div>
          {leader.residence?.division && (
            <p className="text-church-gray text-xs flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {leader.residence.division}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {leader.phone && (
          <a
            href={`tel:${leader.phone}`}
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
              color === 'blue'
                ? 'bg-church-blue text-white hover:bg-church-blue/90'
                : 'bg-church-yellow text-church-black hover:bg-yellow-300',
            )}
          >
            <Phone className="w-4 h-4 flex-shrink-0" />
            {leader.phone}
          </a>
        )}
        {leader.email && (
          <a
            href={`mailto:${leader.email}`}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-church-gray hover:text-church-blue transition-colors"
          >
            <Mail className="w-3.5 h-3.5 flex-shrink-0" />
            {leader.email}
          </a>
        )}
      </div>
    </motion.div>
  );
}

function MemberRow({ member, isMe }: { member: Member; isMe: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl transition-all',
        isMe
          ? 'bg-church-blue/8 border border-church-blue/15'
          : 'hover:bg-church-soft',
      )}
    >
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0',
        isMe
          ? 'bg-church-blue text-white'
          : member.sex === 'Female'
            ? 'bg-pink-100 text-pink-700'
            : 'bg-blue-100 text-blue-700',
      )}>
        {member.photoUrl
          ? <img src={member.photoUrl} alt={member.name} className="w-9 h-9 rounded-full object-cover" />
          : member.name.charAt(0)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={cn('text-sm font-semibold truncate', isMe ? 'text-church-blue' : 'text-church-black')}>
            {member.name}
            {isMe && <span className="text-[10px] font-bold text-church-blue ml-1">(You)</span>}
          </p>
          {member.isLeader && (
            <span className={cn(
              'text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0',
              member.leaderType === 'Cell'
                ? 'bg-church-blue/10 text-church-blue'
                : 'bg-yellow-100 text-church-yellow',
            )}>
              {member.leaderType === 'Cell' ? '★ Cell Leader' : '★ Zone Leader'}
            </span>
          )}
        </div>
        <p className="text-xs text-church-gray truncate">{member.phone}</p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-[10px] text-church-gray">{member.membershipStatus}</p>
        {member.dateOfBirth && (
          <p className="text-[10px] text-church-gray">{calculateAge(member.dateOfBirth)} yrs</p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PortalCell() {
  const { user, churchId } = useAuth();

  const [state, setState] = useState<LoadState>('loading');
  const [ownMember, setOwnMember] = useState<Member | null>(null);
  const [cellMembers, setCellMembers] = useState<Member[]>([]);
  const [cellLeader, setCellLeader] = useState<Member | null>(null);
  const [zoneLeader, setZoneLeader] = useState<Member | null>(null);

  useEffect(() => {
    if (!user?.email || !churchId) return;

    let cancelled = false;

    const load = async () => {
      try {
        // ── 1. Find my member record by email ──────────────────────────────
        const meSnap = await getDocs(query(
          collection(db, 'churches', churchId, 'members'),
          where('email', '==', user.email),
        ));

        if (cancelled) return;
        if (meSnap.empty) { setState('no_member'); return; }

        const me = { id: meSnap.docs[0].id, ...meSnap.docs[0].data() } as Member;
        setOwnMember(me);

        if (!me.cell) { setState('no_cell'); return; }

        // ── 2. Get all members in my cell ──────────────────────────────────
        const cellSnap = await getDocs(query(
          collection(db, 'churches', churchId, 'members'),
          where('cell', '==', me.cell),
        ));

        if (cancelled) return;
        const members = cellSnap.docs.map(d => ({ id: d.id, ...d.data() } as Member));
        setCellMembers(members);

        // ── 3. Cell leader — member in my cell with leaderType 'Cell' ──────
        const cl = members.find(m => m.isLeader && m.leaderType === 'Cell') ?? null;
        setCellLeader(cl);

        // ── 4. Zone leader — member with same zone and leaderType 'Zone' ──
        if (me.zone) {
          const zlSnap = await getDocs(query(
            collection(db, 'churches', churchId, 'members'),
            where('zone', '==', me.zone),
            where('isLeader', '==', true),
            where('leaderType', '==', 'Zone'),
          ));
          if (!cancelled && !zlSnap.empty) {
            setZoneLeader({ id: zlSnap.docs[0].id, ...zlSnap.docs[0].data() } as Member);
          }
        }

        if (!cancelled) setState('ready');
      } catch (err) {
        console.error('PortalCell load error:', err);
        if (!cancelled) setState('no_member');
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user?.email, churchId]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-church-blue border-t-transparent" />
      </div>
    );
  }

  // ── Member record not found ────────────────────────────────────────────────
  if (state === 'no_member') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-church-yellow" />
        </div>
        <h2 className="text-xl font-bold text-church-black mb-2">Profile Not Linked</h2>
        <p className="text-church-gray text-sm max-w-xs">
          Your GraceFlow account (<strong>{user?.email}</strong>) is not yet linked to a member record.
          Contact your admin to add you to the members list with this email address.
        </p>
      </div>
    );
  }

  // ── Member not assigned to a cell ─────────────────────────────────────────
  if (state === 'no_cell') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 bg-church-blue/10 rounded-2xl flex items-center justify-center mb-4">
          <Network className="w-8 h-8 text-church-blue/40" />
        </div>
        <h2 className="text-xl font-bold text-church-black mb-2">Not Assigned to a Cell</h2>
        <p className="text-church-gray text-sm max-w-xs">
          You ({ownMember?.name}) haven't been assigned to a Home Cell yet.
          Your church admin will assign you once a cell is available.
        </p>
      </div>
    );
  }

  // ── Ready ──────────────────────────────────────────────────────────────────
  const sortedMembers = [...cellMembers].sort((a, b) => {
    if (a.email === user?.email) return -1;   // put self first
    if (b.email === user?.email) return 1;
    if (a.isLeader && !b.isLeader) return -1; // leaders next
    if (!a.isLeader && b.isLeader) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* ── Hero: Zone & Cell names ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-church-blue to-church-blue/80 rounded-3xl p-6 text-white shadow-xl shadow-church-blue/20"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-church-yellow text-[10px] font-black uppercase tracking-[0.25em] mb-1">Your Home Cell</p>
            <h2 className="text-2xl font-display font-black leading-tight">
              {ownMember?.cellName ?? 'My Cell'}
            </h2>
          </div>
          <div className="w-12 h-12 bg-church-yellow/20 rounded-2xl flex items-center justify-center">
            <Network className="w-6 h-6 text-church-yellow" />
          </div>
        </div>

        {/* Zone badge */}
        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5 w-fit">
          <Layers className="w-4 h-4 text-church-yellow flex-shrink-0" />
          <div>
            <p className="text-[9px] text-church-yellow/70 font-bold uppercase tracking-widest">Zone</p>
            <p className="text-white font-bold text-sm leading-none">{ownMember?.zoneName ?? '—'}</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3 mt-4">
          <div className="bg-white/10 rounded-xl px-4 py-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-church-yellow" />
            <span className="text-white font-bold text-sm">{cellMembers.length}</span>
            <span className="text-blue-200 text-xs">Members</span>
          </div>
          {cellLeader && (
            <div className="bg-white/10 rounded-xl px-4 py-2 flex items-center gap-2">
              <Star className="w-4 h-4 text-church-yellow" />
              <span className="text-white text-xs font-semibold truncate max-w-[120px]">
                {cellLeader.name}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Leader contacts ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-church-gray mb-3">
          Leadership Contacts
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LeaderCard title="Cell Leader" leader={cellLeader} color="blue" />
          <LeaderCard title="Zone Leader" leader={zoneLeader} color="yellow" />
        </div>
      </div>

      {/* ── Cell members ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-church-gray">
            Cell Members
          </h3>
          <span className="text-[10px] font-bold bg-church-blue/10 text-church-blue px-2.5 py-1 rounded-full">
            {cellMembers.length} {cellMembers.length === 1 ? 'member' : 'members'}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-church-blue/8 shadow-sm divide-y divide-church-soft">
          {sortedMembers.length === 0 ? (
            <p className="text-church-gray text-sm text-center py-8">No members found in this cell.</p>
          ) : (
            sortedMembers.map(m => (
              <MemberRow
                key={m.id}
                member={m}
                isMe={m.email === user?.email}
              />
            ))
          )}
        </div>
      </div>

    </div>
  );
}
