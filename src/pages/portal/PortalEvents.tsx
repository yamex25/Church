import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, MapPin, Clock, Info } from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, getDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { ChurchEvent } from '@/src/types';

export default function PortalEvents(): JSX.Element {
  const { user } = useAuth();
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvpMap, setRsvpMap] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as ChurchEvent[]);
      setLoading(false);
    }, (err) => {
      console.error('events listen error', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || events.length === 0) return;
    let mounted = true;
    (async () => {
      const map: Record<string, boolean> = {};
      await Promise.all(events.map(async (ev) => {
        if (!ev.id) return;
        try {
          const att = await getDoc(doc(db, 'events', ev.id, 'attendees', user.uid));
          map[ev.id] = att.exists();
        } catch (_) {
          map[ev.id] = false;
        }
      }));
      if (mounted) setRsvpMap(map);
    })();
    return () => { mounted = false; };
  }, [user, events]);

  const toggleRsvp = async (ev: ChurchEvent) => {
    if (!user || !ev.id) return alert('Please sign in to RSVP');
    const evId = ev.id;
    try {
      const attRef = doc(db, 'events', evId, 'attendees', user.uid);
      const evRef = doc(db, 'events', evId);
      const going = !!rsvpMap[evId];
      if (!going) {
        await setDoc(attRef, { uid: user.uid, displayName: user.displayName || user.email, createdAt: serverTimestamp() });
        await updateDoc(evRef, { attendees: increment(1) });
        setRsvpMap(prev => ({ ...prev, [evId]: true }));
        setEvents(prev => prev.map(p => p.id === evId ? { ...p, attendees: (p.attendees || 0) + 1 } : p));
      } else {
        await deleteDoc(attRef);
        await updateDoc(evRef, { attendees: increment(-1) });
        setRsvpMap(prev => ({ ...prev, [evId]: false }));
        setEvents(prev => prev.map(p => p.id === evId ? { ...p, attendees: Math.max(0, (p.attendees || 1) - 1) } : p));
      }
    } catch (err) {
      console.error('rsvp err', err);
      alert('Could not update RSVP.');
    }
  };

  const matchesFilter = (e: ChurchEvent) => {
    if (!e) return false;
    if (filterDate && e.date !== filterDate) return false;
    if (filterType !== 'All' && (e.type || 'General Event') !== filterType) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      if (!((e.title || '').toLowerCase().includes(q) || (e.location || '').toLowerCase().includes(q) || (e.type || '').toLowerCase().includes(q))) return false;
    }
    return true;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming = events.filter(e => e.status !== 'cancelled' && new Date(e.date) >= new Date(todayStr) && matchesFilter(e));
  const past = events.filter(e => e.status !== 'cancelled' && new Date(e.date) < new Date(todayStr) && matchesFilter(e));
  const cancelled = events.filter(e => e.status === 'cancelled' && matchesFilter(e));

  const displayList = activeTab === 'upcoming' ? upcoming : activeTab === 'past' ? past : cancelled;

  const clearFilters = () => { setSearchText(''); setFilterDate(''); setFilterType('All'); };

  const renderCard = (ev: ChurchEvent) => {
    const evId = ev.id || '';
    const going = !!rsvpMap[evId];
    const isCancelled = ev.status === 'cancelled';
    const isPast = !isCancelled && new Date(ev.date) < new Date(todayStr);
    const isUpcoming = !isCancelled && !isPast;

    const handleRegisterClick = () => {
      const url = (ev as any).registrationUrl;
      if (url) {
        window.open(url, '_blank', 'noopener');
        return;
      }
      // fallback: toggle RSVP if no external form provided
      if (isUpcoming) {
        if (!user) return alert('Please sign in to register.');
        toggleRsvp(ev);
      }
    };

    return (
      <motion.div key={evId} whileHover={{ scale: 1.01 }} className="bg-church-blue text-white rounded-lg shadow-md overflow-hidden flex md:flex-row flex-col">
        <div className="md:w-36 bg-church-blue/90 p-6 flex flex-col items-center justify-center text-center">
          <div className="text-xs font-bold text-church-yellow uppercase">{new Date(ev.date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</div>
          <div className="text-3xl font-bold">{ev.date.split('-')[2]}</div>
        </div>
        <div className="p-4 flex-1 bg-white text-church-blue">
          <div className="flex justify-between items-start mb-2">
            <div className="text-sm font-bold text-church-blue">{ev.title}</div>
            <div className="text-xs font-semibold text-church-blue">
              {isPast ? `${ev.attendees || 0} attended` : `${ev.attendees || 0} registered`}
            </div>
          </div>
          <div className="text-sm text-church-blue/80 mb-3">{ev.description}</div>
          <div className="flex items-center gap-3">
            {isUpcoming && (
              <button onClick={handleRegisterClick} className="px-3 py-1 rounded-full bg-church-yellow text-church-blue font-bold">Register to Attend</button>
            )}
            {isPast && (
              <div className="text-sm italic text-church-blue/70">Event concluded</div>
            )}
            {isCancelled && (
              <div className="px-3 py-1 rounded-full bg-church-yellow text-church-blue font-bold">Cancelled</div>
            )}
            <div className="ml-auto text-xs text-church-blue flex items-center gap-2"><Clock className="w-4 h-4" />{ev.time || 'TBA'}</div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-8 text-church-blue bg-white p-6 min-h-screen">
      <div>
        <h2 className="text-3xl font-bold text-church-blue">Community Calendar</h2>
        <p className="text-sm text-church-yellow font-extrabold">Faith in Action</p>
      </div>

      <div className="bg-white rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search by name or location" className="px-4 py-2 rounded-lg border border-church-blue/20 w-full md:w-64" />
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="px-4 py-2 rounded-lg border border-church-blue/20" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-4 py-2 rounded-lg border border-church-blue/20">
            <option>All</option>
            {[...new Set(events.map(e => e.type || 'General Event'))].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <button onClick={clearFilters} className="px-3 py-2 rounded-lg bg-church-yellow text-church-blue font-bold">Clear</button>
        </div>
      </div>

      <div className="bg-white p-3 rounded-md">
        <div className="flex gap-2 items-center">
          <button onClick={() => setActiveTab('upcoming')} className={"px-3 py-2 rounded-md font-bold " + (activeTab === 'upcoming' ? 'bg-church-blue text-white' : 'bg-white border border-church-blue text-church-blue')}>Upcoming ({upcoming.length})</button>
          <button onClick={() => setActiveTab('past')} className={"px-3 py-2 rounded-md font-bold " + (activeTab === 'past' ? 'bg-church-blue text-white' : 'bg-white border border-church-blue text-church-blue')}>Past ({past.length})</button>
          <button onClick={() => setActiveTab('cancelled')} className={"px-3 py-2 rounded-md font-bold " + (activeTab === 'cancelled' ? 'bg-church-blue text-white' : 'bg-white border border-church-blue text-church-blue')}>Cancelled ({cancelled.length})</button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid gap-4">
          {displayList.length === 0 && !loading ? (
            <div className="text-center py-10">
              <CalendarDays className="w-12 h-12 text-church-blue/30 mx-auto mb-4" />
              <div className="text-church-yellow font-extrabold">No events to show</div>
            </div>
          ) : displayList.map(renderCard)}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border-l-8 border-church-blue shadow-sm flex gap-4 items-start">
        <div className="bg-church-blue/10 p-3 rounded-2xl text-church-blue">
          <Info className="w-6 h-6" />
        </div>
        <div>
          <p className="text-lg font-bold text-church-blue">Spiritual Reminders</p>
          <p className="text-sm text-church-blue/80">Enable SMS notifications in your profile to receive alerts before services.</p>
        </div>
      </div>
    </div>
  );
}
