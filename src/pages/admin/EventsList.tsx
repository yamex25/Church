import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  MapPin,
  Clock,
  Plus,
  Search,
  Users,
  MoreVertical,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { cn, formatDate } from '@/src/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { ChurchEvent } from '@/src/types';
import { useAuth } from '@/src/components/AuthContext';

export default function EventsList() {
  const { churchId } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<{id: string, name: string}[]>([]);

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM',
    location: '',
    type: 'General Service'
  });

  useEffect(() => {
    if (!churchId) return;

    const qS = query(collection(db, 'churches', churchId, 'services'), orderBy('name', 'asc'));
    const unsubscribeS = onSnapshot(qS, (snapshot) => {
      setServices(snapshot.docs.map(d => ({ id: d.id, name: d.data().name })));
    });

    const q = query(collection(db, 'churches', churchId, 'events'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ChurchEvent[]);
      setLoading(false);
    }, (err) => {
      console.error("Events listener error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [churchId]);

  const cancelEvent = async (eventId: string) => {
    const ok = window.confirm('Are you sure you want to cancel this event? This will mark it as cancelled for attendees.');
    if (!ok) return;
    try {
      await updateDoc(doc(db, 'churches', churchId!, 'events', eventId), {
        status: 'cancelled',
        cancelledAt: serverTimestamp()
      });
      alert('Event cancelled');
    } catch (err: any) {
      console.error('Failed to cancel event', err);
      alert('Failed to cancel event: ' + (err.message || err));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const timeout = setTimeout(() => {
      if (submitting) {
        setSubmitting(false);
        setError("Request timed out. Please check your connection and try again.");
      }
    }, 10000);

    try {
      await addDoc(collection(db, 'churches', churchId!, 'events'), {
        ...newEvent,
        churchId: churchId!,
        attendees: 0,
        createdAt: serverTimestamp()
      });
      clearTimeout(timeout);
      setShowAddForm(false);
      setNewEvent({ title: '', description: '', date: new Date().toISOString().split('T')[0], time: '10:00 AM', location: '', type: 'General Event' });
      alert("Event published successfully!");
    } catch (err: any) {
      console.error("Error creating event:", err);
      const msg = err.message || String(err);
      setError(msg.includes('permission-denied') ? "Permission Denied: You don't have rights to publish events." : "Error: " + msg);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'events');
      } catch (e) {}
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 bg-church-blue text-white p-6 rounded-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Church Events</h2>
          <p className="text-church-yellow text-sm">Schedule and manage services, programs, and outreach activities.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-church-yellow text-church-blue px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition-colors shadow-sm self-start md:self-center"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[32px] p-8 w-full max-w-lg shadow-2xl relative text-slate-900"
            >
              <button onClick={() => setShowAddForm(false)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-xl font-bold mb-6">Create New Event</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-xl">
                    {error}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Event Title</label>
                  <input required placeholder="e.g. Youth Revival" className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Date</label>
                     <input type="date" className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                   </div>
                   <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Type</label>
                     <select className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900" value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}>
                       <option value="General Event">General Event</option>
                       {services.map(s => (
                         <option key={s.id} value={s.name}>{s.name}</option>
                       ))}
                     </select>
                   </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Location</label>
                  <input required placeholder="Main Sanctuary/Hall..." className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Short Description</label>
                  <textarea rows={3} className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} />
                </div>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {submitting ? 'Publishing...' : 'Publish Event'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Upcoming</p>
           <p className="text-2xl font-bold text-slate-900">{events.filter(e => new Date(e.date) >= new Date()).length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Events</p>
           <p className="text-2xl font-bold text-slate-900">{events.length}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 shadow-sm divide-y divide-blue-100">
           <div className="pb-1 text-[10px] font-bold text-blue-400 uppercase tracking-widest">Next Event</div>
           <div className="pt-1 text-xs font-bold text-blue-900 truncate">
             {events.find(e => new Date(e.date) >= new Date())?.title || 'No upcoming'}
           </div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm">
           <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Participation</p>
           <p className="text-2xl font-bold text-emerald-900">Active</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search events by title or location..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
           {['All', 'Service', 'Program', 'Meeting'].map(tab => (
             <button key={tab} className={cn(
               "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
               tab === 'All' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
             )}>
                {tab}
             </button>
           ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* Upcoming Events */}
        <div>
          <h3 className="text-lg font-bold text-church-blue mb-3">Upcoming Events</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {events.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())).filter(e => e.status !== 'cancelled' && new Date(e.date) >= new Date(new Date().toISOString().split('T')[0])).map((event) => (
              <motion.div 
                key={event.id}
                whileHover={{ y: -4 }}
                className="bg-white rounded-2xl border border-church-blue/10 shadow-sm overflow-hidden group"
              >
                <div className="h-32 bg-church-blue/5 flex items-center justify-center relative">
                  <ImageIcon className="text-church-blue/40 w-8 h-8" />
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-church-blue shadow-sm border border-white/50">
                    {event.type}
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 group-hover:text-church-blue transition-colors">{event.title}</h3>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(event.date)}</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {event.time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5" />
                      {event.location}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-church-blue bg-church-blue/10 px-2 py-1 rounded-md">
                        <Users className="w-3.5 h-3.5" />
                        {event.attendees} Attending
                      </div>
                      <button onClick={() => cancelEvent(event.id)} className="text-xs font-semibold text-church-blue bg-church-yellow/90 px-3 py-1 rounded-md shadow-sm hover:opacity-90">Cancel</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Past Events */}
        <div>
          <h3 className="text-lg font-bold text-church-blue mb-3">Past Events</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {events.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())).filter(e => e.status !== 'cancelled' && new Date(e.date) < new Date(new Date().toISOString().split('T')[0])).map((event) => (
              <motion.div key={event.id} whileHover={{ y: -4 }} className="bg-white rounded-2xl border border-church-blue/10 shadow-sm overflow-hidden group">
                <div className="h-32 bg-church-blue/5 flex items-center justify-center relative">
                  <ImageIcon className="text-church-blue/40 w-8 h-8" />
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-church-blue shadow-sm border border-white/50">
                    {event.type}
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{event.title}</h3>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(event.date)}</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {event.time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5" />
                      {event.location}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-church-blue bg-church-blue/10 px-2 py-1 rounded-md">
                       <Users className="w-3.5 h-3.5" />
                       {event.attendees} Attended
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Cancelled Events */}
        <div>
          <h3 className="text-lg font-bold text-church-blue mb-3">Cancelled Events</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {events.filter(e => e.status === 'cancelled').map((event) => (
              <motion.div key={event.id} whileHover={{ y: -4 }} className="bg-white rounded-2xl border border-church-blue/10 shadow-sm overflow-hidden group opacity-80">
                <div className="h-32 bg-church-yellow/10 flex items-center justify-center relative">
                  <ImageIcon className="text-church-yellow/60 w-8 h-8" />
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-church-blue shadow-sm border border-white/50">
                    {event.type}
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{event.title}</h3>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(event.date)}</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {event.time}</span>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-church-yellow">Cancelled</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
