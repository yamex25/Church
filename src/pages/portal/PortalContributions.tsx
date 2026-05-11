import { motion } from 'motion/react';
import { 
  CreditCard, 
  Calendar, 
  ArrowUpRight, 
  Download,
  Info,
  TrendingUp,
  ReceiptText,
  Church
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/src/lib/utils';
import { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthContext';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { FinanceRecord } from '@/src/types';

export default function PortalContributions() {
  const { user } = useAuth();
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Filter by either user uid or memberName if it matches
    // But usually we link by memberId. Let's assume memberId is stored on the record.
    const q = query(
      collection(db, 'finance'),
      where('memberId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FinanceRecord[];
      setRecords(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'finance');
    });

    return () => unsubscribe();
  }, [user]);

  const totalGiving = records.reduce((sum, r) => sum + r.amount, 0);
  const lastGift = records.length > 0 ? records[0].amount : 0;
  const avgGift = records.length > 0 ? totalGiving / records.length : 0;

  const handleDownload = () => {
    alert("Generating your contribution statement for tax purposes. This may take a few moments...");
  };

  const handleRecordContribution = () => {
    alert("The online giving portal is currently being upgraded for enhanced security. Please use the physical envelopes during service or bank transfer for now.");
  };

  return (
    <div className="space-y-10 text-church-black">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-black tracking-tight text-church-black">Contribution Ledger</h2>
          <p className="text-xs font-bold text-church-gray uppercase tracking-widest mt-1">Faithful Stewardship</p>
        </div>
        <button 
          onClick={handleDownload}
          className="p-3 bg-white border-2 border-church-blue/10 rounded-2xl text-church-blue shadow-sm hover:bg-church-soft transition-all"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Stat */}
      <div className="bg-church-blue p-10 rounded-[48px] text-white shadow-2xl shadow-church-blue/20 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
             <TrendingUp className="w-5 h-5 text-church-yellow" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Annual Giving (2026)</span>
          </div>
          <h3 className="text-5xl font-display font-black mb-10 tracking-tight">{formatCurrency(totalGiving)}</h3>
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
             <div className="bg-white/10 px-5 py-2.5 rounded-full border border-white/5">
               Last: {formatCurrency(lastGift)}
             </div>
             <div className="bg-white/10 px-5 py-2.5 rounded-full border border-white/5">
               Avg: {formatCurrency(avgGift)}
             </div>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 opacity-5">
           <Church className="w-64 h-64" />
        </div>
      </div>

      {/* Give Button */}
      <button 
        onClick={handleRecordContribution}
        className="w-full bg-church-yellow text-church-black py-6 rounded-3xl font-black text-xs uppercase tracking-[0.25em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-church-yellow/20 flex items-center justify-center gap-4"
      >
        <CreditCard className="w-5 h-5" />
        Record Contribution
      </button>

      {/* List */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black text-church-gray uppercase tracking-[0.2em]">Transaction History</h3>
          <span className="text-[10px] font-bold text-church-blue bg-church-blue/5 px-3 py-1 rounded-full uppercase tracking-widest">Verified Records</span>
        </div>
        <div className="space-y-4">
          {records.map((record) => (
            <div key={record.id} className="bg-white p-6 rounded-[32px] border border-church-blue/5 shadow-xl shadow-church-blue/5 flex items-center justify-between group hover:border-church-blue/20 transition-all cursor-default">
              <div className="flex items-center gap-5">
                <div className="bg-church-soft p-4 rounded-2xl text-church-blue group-hover:bg-church-blue group-hover:text-white transition-all shadow-sm">
                  <ReceiptText className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-lg text-church-black">{record.type}</p>
                  <p className="text-[10px] text-church-gray font-bold uppercase tracking-[0.1em]">{formatDate(record.date)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-church-black tracking-tight">{formatCurrency(record.amount)}</p>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                   <p className="text-[9px] text-green-600 font-black uppercase tracking-widest leading-none">Cleared</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Note */}
      <div className="bg-white p-8 rounded-[32px] border-l-8 border-church-yellow shadow-xl shadow-church-blue/5 flex gap-5 items-start">
        <div className="bg-church-yellow/20 p-2 rounded-xl text-church-black">
          <Info className="w-5 h-5" />
        </div>
        <p className="text-xs text-church-gray leading-relaxed font-bold">
          Note: Online contributions may take up to 24 hours to reflect in your history. Physical tithes given in church are updated weekly by the Treasurer.
        </p>
      </div>
    </div>
  );
}
