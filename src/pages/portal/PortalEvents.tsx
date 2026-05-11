import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  CalendarDays, 
  MapPin, 
  Clock, 
  ChevronRight,
  Info
} from 'lucide-react';
import { formatDate } from '@/src/lib/utils';
import { db } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ChurchEvent } from '@/src/types';

export default function PortalEvents() {
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChurchEvent[]);
      setLoading(false);
    }, (err) => {
      console.error("Portal events listener error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-10 text-church-black">
      <div>
        <h2 className="text-3xl font-display font-black tracking-tight text-church-black">Community Calendar</h2>
        <p className="text-xs font-black text-church-gray uppercase tracking-widest mt-1">Faith in Action</p>
      </div>

      <div className="space-y-6">
        {events.length === 0 && !loading && (
          <div className="text-center py-20 bg-white rounded-[48px] border border-church-blue/5">
             <CalendarDays className="w-16 h-16 text-church-blue/20 mx-auto mb-4" />
             <p className="text-church-gray font-bold">No upcoming events scheduled at this time.</p>
          </div>
        )}
        {events.map((event) => (
          <motion.div 
            key={event.id}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="bg-white rounded-[48px] border border-church-blue/5 shadow-xl shadow-church-blue/5 overflow-hidden flex flex-col md:flex-row group"
          >
            <div className="md:w-40 bg-church-blue text-white p-10 flex flex-col items-center justify-center text-center relative overflow-hidden">
               <span className="text-[10px] font-black text-church-yellow uppercase tracking-[0.2em] leading-none mb-2 z-10">
                 {new Date(event.date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
               </span>
               <span className="text-5xl font-display font-black leading-none z-10">
                 {event.date.split('-')[2]}
               </span>
               <div className="absolute top-0 left-0 w-full h-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            <div className="p-10 flex-1">
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-wrap items-center gap-6 text-[10px] font-black text-church-gray uppercase tracking-widest">
                  <span className="flex items-center gap-2 bg-church-soft px-3 py-1 rounded-full"><Clock className="w-4 h-4 text-church-blue" /> {event.time || 'TBA'}</span>
                  <span className="flex items-center gap-2 bg-church-soft px-3 py-1 rounded-full"><MapPin className="w-4 h-4 text-church-blue" /> {event.location}</span>
                </div>
              </div>
              <h3 className="text-2xl font-display font-bold text-church-black mb-4">{event.title}</h3>
              <p className="text-sm text-church-gray leading-relaxed mb-8 font-medium italic">"{event.description}"</p>
              <button 
                onClick={() => alert(`Registration for "${event.title}" is currently open at the church lobby.`)}
                className="flex items-center gap-2 text-[10px] font-black text-church-blue uppercase tracking-[0.2em] hover:translate-x-2 transition-all"
              >
                Intention to Attend <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white p-10 rounded-[48px] border-l-8 border-church-blue shadow-2xl shadow-church-blue/5 flex gap-8 items-start">
        <div className="bg-church-blue/10 p-4 rounded-3xl text-church-blue">
          <Info className="w-8 h-8" />
        </div>
        <div className="space-y-3">
          <p className="text-xl font-display font-bold text-church-blue">Spiritual Reminders</p>
          <p className="text-sm text-church-gray leading-relaxed font-medium">
            Stay aligned with the Spirit. You can enable personalized SMS notifications in your profile settings to receive intercessory alerts 1 hour before every service.
          </p>
        </div>
      </div>
    </div>
  );
}
