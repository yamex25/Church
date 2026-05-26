import { 
  Download,
  Info,
  TrendingUp,
  ReceiptText,
  Church,
  MapPin,
  Clock,
  Heart,
  Smartphone,
  QrCode,
  Users,
  HandCoins
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

    const q = query(
      collection(db, 'finance'),
      where('memberName', '==', user.displayName),
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

  return (
    <div className="space-y-6 md:space-y-10 text-church-black">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-3xl font-display font-black tracking-tight text-church-black">Contribution Ledger</h2>
          <p className="text-[10px] md:text-xs font-bold text-church-gray uppercase tracking-widest mt-1">Faithful Stewardship</p>
        </div>
        <button 
          onClick={handleDownload}
          className="p-2.5 md:p-3 bg-white border-2 border-church-blue/10 rounded-xl md:rounded-2xl text-church-blue shadow-sm hover:bg-church-soft transition-all"
        >
          <Download className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>

      {/* Summary Stat */}
      <div className="bg-church-blue p-6 md:p-10 rounded-[32px] md:rounded-[48px] text-white shadow-2xl shadow-church-blue/20 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 md:gap-3 mb-2">
             <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-church-yellow" />
             <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Annual Giving (2026)</span>
          </div>
          <h3 className="text-3xl md:text-5xl font-display font-black mb-6 md:mb-10 tracking-tight">{formatCurrency(totalGiving)}</h3>
          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest">
             <div className="bg-white/10 px-3 md:px-5 py-2 md:py-2.5 rounded-full border border-white/5">
               Last: {formatCurrency(lastGift)}
             </div>
             <div className="bg-white/10 px-3 md:px-5 py-2 md:py-2.5 rounded-full border border-white/5">
               Avg: {formatCurrency(avgGift)}
             </div>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 opacity-5 hidden md:block">
           <Church className="w-64 h-64" />
        </div>
      </div>

      {/* How to Contribute Section */}
      <div className="bg-gradient-to-br from-church-blue to-church-blue/90 p-6 md:p-10 rounded-[32px] md:rounded-[48px] text-white shadow-2xl shadow-church-blue/30 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <div className="bg-church-yellow/20 p-3 md:p-4 rounded-xl md:rounded-2xl">
              <Heart className="w-5 h-5 md:w-7 md:h-7 text-church-yellow" />
            </div>
            <div>
              <h3 className="text-lg md:text-2xl font-display font-black tracking-tight">How to Contribute</h3>
              <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white/50">Your Giving Makes a Difference</p>
            </div>
          </div>
          
          <p className="text-sm md:text-base leading-relaxed mb-6 md:mb-8 text-white/80">
            We appreciate your faithful generosity. You can make your contributions through any of the following convenient methods.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div className="bg-white/10 backdrop-blur-sm p-4 md:p-5 rounded-2xl md:rounded-3xl border border-white/10 hover:bg-white/15 transition-all">
              <div className="flex items-center gap-3 mb-2 md:mb-3">
                <Smartphone className="w-4 h-4 md:w-5 md:h-5 text-church-yellow" />
                <h5 className="font-bold text-sm md:text-base text-church-yellow">Mobile Money</h5>
              </div>
              <p className="text-xs md:text-sm text-white/70 leading-relaxed">Send your contribution directly to the church phone number via Mobile Money (MTN or Airtel).</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 md:p-5 rounded-2xl md:rounded-3xl border border-white/10 hover:bg-white/15 transition-all">
              <div className="flex items-center gap-3 mb-2 md:mb-3">
                <QrCode className="w-4 h-4 md:w-5 md:h-5 text-church-yellow" />
                <h5 className="font-bold text-sm md:text-base text-church-yellow">Merchant Code</h5>
              </div>
              <p className="text-xs md:text-sm text-white/70 leading-relaxed">Use the church merchant code to make payments directly from your mobile money account.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 md:p-5 rounded-2xl md:rounded-3xl border border-white/10 hover:bg-white/15 transition-all">
              <div className="flex items-center gap-3 mb-2 md:mb-3">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-church-yellow" />
                <h5 className="font-bold text-sm md:text-base text-church-yellow">Church Admin</h5>
              </div>
              <p className="text-xs md:text-sm text-white/70 leading-relaxed">Visit the Church Accounts Office and contribute through our admin team in person.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 md:p-5 rounded-2xl md:rounded-3xl border border-white/10 hover:bg-white/15 transition-all">
              <div className="flex items-center gap-3 mb-2 md:mb-3">
                <HandCoins className="w-4 h-4 md:w-5 md:h-5 text-church-yellow" />
                <h5 className="font-bold text-sm md:text-base text-church-yellow">During Church Service</h5>
              </div>
              <p className="text-xs md:text-sm text-white/70 leading-relaxed">Give your tithes, offerings, and special contributions during Sunday worship services.</p>
            </div>
          </div>
        </div>
        
        <div className="absolute -right-16 -bottom-16 opacity-10 hidden md:block">
          <Church className="w-72 h-72" />
        </div>
      </div>

      {/* Contact & Office Info */}
      <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[48px] border-2 border-church-yellow/30 shadow-xl shadow-church-blue/5">
        <div className="text-center mb-6 md:mb-8">
          <h4 className="text-lg md:text-2xl font-display font-black text-church-black mb-2">Visit the Church Accounts Office</h4>
          <p className="text-xs md:text-sm text-church-gray leading-relaxed">Our dedicated team is ready to assist you with all your contributions.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-church-soft p-5 md:p-6 rounded-2xl md:rounded-3xl text-center">
            <div className="bg-church-blue w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
              <Smartphone className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h5 className="font-bold text-sm md:text-base text-church-black mb-1">Church Phone</h5>
            <p className="text-xs md:text-sm text-church-gray">Mobile Money<br />MTN & Airtel Supported</p>
          </div>
          
          <div className="bg-church-soft p-5 md:p-6 rounded-2xl md:rounded-3xl text-center">
            <div className="bg-church-blue w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
              <Clock className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h5 className="font-bold text-sm md:text-base text-church-black mb-1">Office Hours</h5>
            <p className="text-xs md:text-sm text-church-gray">Monday – Friday<br />8:00 AM – 5:00 PM</p>
          </div>
          
          <div className="bg-church-soft p-5 md:p-6 rounded-2xl md:rounded-3xl text-center">
            <div className="bg-church-blue w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
              <MapPin className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h5 className="font-bold text-sm md:text-base text-church-black mb-1">Location</h5>
            <p className="text-xs md:text-sm text-church-gray">Church Accounts Office<br />Main Building</p>
          </div>
        </div>

        <div className="mt-6 md:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
          <div className="bg-church-yellow text-church-black px-6 md:px-8 py-3 md:py-4 rounded-full font-black text-[10px] md:text-xs uppercase tracking-widest shadow-lg shadow-church-yellow/20">
            Church Office Open
          </div>
          <div className="bg-church-soft px-6 md:px-8 py-3 md:py-4 rounded-full font-bold text-[10px] md:text-xs uppercase tracking-widest text-church-gray border border-church-blue/10">
            Mon – Fri: 8AM – 5PM
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <section className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between px-1 md:px-2">
          <h3 className="text-[10px] md:text-xs font-black text-church-gray uppercase tracking-[0.2em]">Transaction History</h3>
          <span className="text-[9px] md:text-[10px] font-bold text-church-blue bg-church-blue/5 px-2 md:px-3 py-1 rounded-full uppercase tracking-widest">Verified Records</span>
        </div>
        <div className="space-y-3 md:space-y-4">
          {records.map((record) => (
            <div key={record.id} className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-church-blue/5 shadow-xl shadow-church-blue/5 flex items-center justify-between group hover:border-church-blue/20 transition-all cursor-default">
              <div className="flex items-center gap-3 md:gap-5">
                <div className="bg-church-soft p-3 md:p-4 rounded-xl md:rounded-2xl text-church-blue group-hover:bg-church-blue group-hover:text-white transition-all shadow-sm">
                  <ReceiptText className="w-4 h-4 md:w-5 md:h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm md:text-lg text-church-black">{record.type}</p>
                  <p className="text-[9px] md:text-[10px] text-church-gray font-bold uppercase tracking-[0.1em]">{formatDate(record.date)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-base md:text-xl font-black text-church-black tracking-tight">{formatCurrency(record.amount)}</p>
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
      <div className="bg-white p-5 md:p-8 rounded-[24px] md:rounded-[32px] border-l-8 border-church-yellow shadow-xl shadow-church-blue/5 flex gap-3 md:gap-5 items-start">
        <div className="bg-church-yellow/20 p-2 rounded-xl text-church-black">
          <Info className="w-4 h-4 md:w-5 md:h-5" />
        </div>
        <p className="text-[10px] md:text-xs text-church-gray leading-relaxed font-bold">
          Note: Physical tithes given in church are updated weekly by the Treasurer. If you have any questions about your contribution records, please visit the Church Accounts Office.
        </p>
      </div>
    </div>
  );
}
