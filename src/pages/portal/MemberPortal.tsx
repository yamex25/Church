import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  CreditCard, 
  Heart, 
  Calendar, 
  ChevronRight,
  TrendingUp,
  MapPin,
  Clock,
  Church
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, formatCurrency } from '@/src/lib/utils';
import { useAuth } from '@/src/components/AuthContext';
import { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

export default function MemberPortal() {
  const { user } = useAuth();
  const [totalGiving, setTotalGiving] = useState(0);
  
  // Get member details
  const memberName = user?.displayName || 'Member';
  const memberId = user?.uid.slice(0, 8).toUpperCase() || 'GRACE-001';

  useEffect(() => {
    if (!user) return;

    // Fetch user's contribution total
    const q = query(
      collection(db, 'finance'),
      where('memberName', '==', user.displayName),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        };
      });
      const total = docs.reduce((sum, doc: any) => sum + (Number(doc.amount) || 0), 0);
      setTotalGiving(total);
    }, (error) => {
      console.error("Error fetching contributions:", error);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="space-y-8">
      {/* Welcome Card */}
      <section className="bg-church-blue text-white p-10 rounded-2xl sm:rounded-[48px] shadow-2xl shadow-church-blue/20 overflow-hidden relative">
        <div className="relative z-10">
          <p className="text-white/60 text-xs font-bold mb-1 uppercase tracking-[0.2em] font-sans">Member Profile</p>
          <h2 className="text-4xl font-display font-black mb-10 tracking-tight italic">Shalom, {memberName.split(' ')[0]}</h2>
          
          <div className="flex items-center gap-5 sm:gap-10">
            <div>
              <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-1 font-sans">Fellowship</p>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-church-yellow shadow-[0_0_8px_rgba(253,224,71,0.6)]" />
                <span className="text-sm font-bold tracking-wide">Active</span>
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-1 font-sans">Ministry ID</p>
              <span className="text-sm font-bold font-mono tracking-[0.1em]">{memberId}</span>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute top-10 right-10 opacity-10">
          <Church className="w-32 h-32 text-white" />
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Pass / QR */}
        <section className="bg-white p-10 rounded-2xl sm:rounded-[48px] border border-church-blue/5 shadow-xl shadow-church-blue/5 text-center flex flex-col items-center group">
          <div className="bg-church-soft p-10 rounded-3xl inline-block mb-8 border border-church-blue/5 shadow-inner transition-transform group-hover:scale-105">
            <QRCodeSVG value={memberId} size={180} level="H" includeMargin={false} bgColor="#F8FAFC" fgColor="#1E40AF" />
          </div>
          <h3 className="font-display text-2xl font-bold text-church-black mb-3">Community Entry Pass</h3>
          <p className="text-sm text-church-gray mb-8 leading-relaxed max-w-[280px]">Scan this code for attendance during services and ministry activities.</p>
          <button 
            onClick={() => alert("Digital Wallet integration is coming soon. Please take a screenshot for offline use.")}
            className="text-church-blue text-[10px] font-black uppercase tracking-[0.25em] hover:text-church-yellow transition-all border-b-2 border-church-blue/10 pb-1"
          >
            Save Pass to Library
          </button>
        </section>

        <div className="flex flex-col gap-8">
          {/* Next Service (Static for now, could be dynamic from 'events') */}
          <section className="bg-white p-10 rounded-2xl sm:rounded-[48px] border border-church-blue/5 shadow-xl shadow-church-blue/5">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-display text-2xl font-bold text-church-black">Upcoming</h3>
              <Link to="/portal/events" className="text-[10px] font-bold text-church-blue hover:text-church-yellow flex items-center gap-1 uppercase tracking-widest transition-all">
                Registry <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex gap-6 items-center">
              <div className="bg-church-yellow text-church-black p-5 rounded-2xl flex flex-col items-center justify-center min-w-[80px] shadow-lg shadow-church-yellow/20">
                 <span className="text-[10px] font-black opacity-60">SUN</span>
                 <span className="text-3xl font-black">10</span>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-xl text-church-black leading-tight">Sunday Worship Service</h4>
                <div className="flex flex-col gap-1 text-xs text-church-gray font-bold uppercase tracking-widest">
                  <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-church-blue" /> 09:00 AM</span>
                  <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-church-blue" /> Main Santuary</span>
                </div>
              </div>
            </div>
          </section>


          {/* Giving Summary */}
          <section className="bg-church-blue p-10 rounded-2xl sm:rounded-[48px] shadow-2xl shadow-church-blue/20 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50 mb-2">Fellowship Contributions</p>
              <h3 className="text-4xl font-display font-black text-church-yellow">{formatCurrency(totalGiving)}</h3>
            </div>
            <Link to="/portal/contributions" className="relative z-10 mt-10">
              <button className="w-full bg-church-yellow text-church-black px-6 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.03] active:scale-95 transition-all shadow-xl shadow-church-yellow/20">
                <CreditCard className="w-5 h-5" />
                Give to Ministry
              </button>
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
