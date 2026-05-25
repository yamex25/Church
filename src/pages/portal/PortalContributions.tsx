import { motion } from 'motion/react';
import { 
  CreditCard, 
  Calendar, 
  ArrowUpRight, 
  Download,
  Info,
  TrendingUp,
  ReceiptText,
  Church,
  X
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/src/lib/utils';
import { useState, useEffect } from 'react';
import { useAuth } from '@/src/components/AuthContext';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, limit } from 'firebase/firestore';
import { FinanceRecord } from '@/src/types';

export default function PortalContributions() {
  const { user } = useAuth();
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [members, setMembers] = useState<{id: string, name: string}[]>([]);
  const [memberNameInput, setMemberNameInput] = useState('');
  const [showMemberSuggestions, setShowMemberSuggestions] = useState(false);
  const [filteredMembers, setFilteredMembers] = useState<{id: string, name: string}[]>([]);
  const [selectedMember, setSelectedMember] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    if (!user) return;

    // Filter by user email or memberName to get user's contributions
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

  useEffect(() => {
    const qMembers = query(collection(db, 'members'), orderBy('name', 'asc'));
    const unsubscribeMembers = onSnapshot(qMembers, (snapshot) => {
      const memberDocs = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setMembers(memberDocs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
    });

    return () => unsubscribeMembers();
  }, []);

  const handleMemberNameChange = (value: string) => {
    setMemberNameInput(value);
    setSelectedMember(null);
    
    if (value.trim()) {
      // Filter members based on input
      const filtered = members.filter(member => 
        member.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredMembers(filtered);
      setShowMemberSuggestions(true);
      
      // Check if exact match exists
      const exactMatch = members.find(m => m.name.toLowerCase() === value.toLowerCase().trim());
      if (exactMatch) {
        setSelectedMember(exactMatch);
      }
    } else {
      setFilteredMembers([]);
      setShowMemberSuggestions(false);
      setSelectedMember(null);
    }
  };

  const selectMember = (member: {id: string, name: string}) => {
    setSelectedMember(member);
    setMemberNameInput(member.name);
    setShowMemberSuggestions(false);
    setFilteredMembers([]);
  };

  const totalGiving = records.reduce((sum, r) => sum + r.amount, 0);
  const lastGift = records.length > 0 ? records[0].amount : 0;
  const avgGift = records.length > 0 ? totalGiving / records.length : 0;

  const handleDownload = () => {
    alert("Generating your contribution statement for tax purposes. This may take a few moments...");
  };

  const handleRecordContribution = () => {
    setShowPaymentModal(true);
  };

  const [pin, setPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'processing' | 'completed' | 'failed'>('idle');

  // Validate Uganda phone number format
  const validatePhoneNumber = (phone: string) => {
    const ugandaRegex = /^256[0-9]{9}$/;
    return ugandaRegex.test(phone);
  };

  const handlePaymentSubmit = async () => {
    if (!paymentMethod || !phoneNumber || !amount) {
      alert("Please fill in all payment details.");
      return;
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      alert("Please enter a valid Uganda phone number (256XXXXXXXXX).");
      return;
    }

    // Record contribution to Firestore first
    try {
      setPaymentStatus('processing');
      
      const contributionData = {
        memberName: selectedMember?.name || user.displayName,
        memberEmail: user.email,
        type: 'Mobile Money',
        amount: Number(amount),
        category: 'Tithe',
        description: `Contribution via ${paymentMethod}`,
        paymentMethod: paymentMethod,
        phoneNumber: phoneNumber,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'finance'), contributionData);
      
      // Show PIN modal for mobile money confirmation
      setShowPinModal(true);
      
    } catch (error) {
      setPaymentStatus('failed');
      handleFirestoreError(error, OperationType.CREATE, 'finance');
      alert("Failed to initiate payment. Please try again.");
    }
  };

  const handlePinSubmit = async () => {
    if (!pin || pin.length !== 4) {
      alert("Please enter a valid 4-digit PIN.");
      return;
    }

    try {
      setPaymentStatus('processing');
      
      // Generate unique transaction reference
      const txRef = `CHURCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Call Flutterwave API
      const flutterwaveResponse = await fetch('https://api.flutterwave.com/v3/money/collect', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer FLWSECK_TEST-SANDBOXKEY', // Replace with your actual Flutterwave key
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tx_ref: txRef,
          amount: Number(amount),
          currency: 'UGX',
          email: user.email,
          phone_number: phoneNumber,
          payment_options: ['mobile_money_uganda']
        })
      });

      const flutterwaveData = await flutterwaveResponse.json();
      
      if (flutterwaveData.status === 'success') {
        // Update transaction to completed status
        const q = query(
          collection(db, 'finance'),
          where('memberName', '==', user.displayName),
          orderBy('date', 'desc'),
          limit(1)
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const latestDoc = snapshot.docs[0];
            updateDoc(doc(db, 'finance', latestDoc.id), {
              status: 'Completed',
              completedAt: serverTimestamp(),
              flutterwaveTxRef: txRef,
              paymentMethod: 'Flutterwave'
            });
          }
        });
        
        unsubscribe();
        
        setPaymentStatus('completed');
        setShowPinModal(false);
        setShowPaymentModal(false);
        setPin('');
        
        alert(`Payment of UGX ${Number(amount).toLocaleString()} completed successfully via Flutterwave! Transaction ID: ${txRef}`);
        
        // Reset form
        setPaymentMethod('');
        setPhoneNumber('');
        setAmount('');
        
        setTimeout(() => {
          setPaymentStatus('idle');
        }, 2000);
      } else {
        setPaymentStatus('failed');
        alert(`Payment failed: ${flutterwaveData.message || 'Unknown error'}`);
        
        setTimeout(() => {
          setPaymentStatus('idle');
        }, 3000);
      }
      
    } catch (error) {
      setPaymentStatus('failed');
      alert("Payment failed. Please try again.");
      
      setTimeout(() => {
        setPaymentStatus('idle');
      }, 3000);
    }
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

      {/* Give Button */}
      <button 
        onClick={handleRecordContribution}
        className="w-full bg-church-yellow text-church-black py-4 md:py-6 rounded-2xl md:rounded-3xl font-black text-xs uppercase tracking-[0.15em] md:tracking-[0.25em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-church-yellow/20 flex items-center justify-center gap-3 md:gap-4"
      >
        <CreditCard className="w-4 h-4 md:w-5 md:h-5" />
        Record Contribution
      </button>

      {/* List */}
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
        <p className="text-[11px] md:text-xs text-church-gray leading-relaxed font-bold">
          Note: Online contributions may take up to 24 hours to reflect in your history. Physical tithes given in church are updated weekly by the Treasurer.
        </p>
      </div>
    {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-church-black/80 backdrop-blur-md">
          <div className="bg-white rounded-[32px] md:rounded-[48px] p-6 md:p-10 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl md:text-2xl font-display font-black mb-6 md:mb-8">Mobile Money Payment</h3>
            
            <div className="space-y-4 md:space-y-6">
              {/* Balance Status */}
              {paymentStatus === 'validating' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl mb-4">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                    <span className="text-sm text-blue-600 font-medium">Checking account balance...</span>
                  </div>
                </div>
              )}

              
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Payment Method</label>
                <select 
                  className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue transition-all font-bold text-sm mt-2"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  disabled={paymentStatus !== 'idle'}
                >
                  <option value="">Select Payment Method</option>
                  <option value="MTN Mobile Money">MTN Mobile Money</option>
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="Uganda Waragi">Uganda Waragi</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Phone Number</label>
                <input 
                  type="tel"
                  placeholder="256XXXXXXXXX"
                  className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue transition-all font-bold text-sm mt-2"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={paymentStatus !== 'idle'}
                />
              </div>

              <div className="relative">
                <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Member Name</label>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder={selectedMember?.name || user.displayName || "Start typing member name..."}
                    className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue transition-all font-bold text-lg text-church-blue mt-2"
                    value={memberNameInput}
                    onChange={(e) => handleMemberNameChange(e.target.value)}
                    disabled={paymentStatus !== 'idle'}
                  />
                  {selectedMember && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMember(null);
                        setMemberNameInput('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-church-soft rounded-lg hover:bg-church-blue/10 transition-all"
                    >
                      <X className="w-4 h-4 text-church-gray" />
                    </button>
                  )}
                </div>
                {showMemberSuggestions && filteredMembers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-church-blue/20 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredMembers.map(member => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => selectMember(member)}
                        className="w-full text-left px-4 py-3 hover:bg-church-blue/5 transition-all border-b border-church-soft last:border-b-0"
                      >
                        <div className="font-bold text-sm text-church-black">{member.name}</div>
                        <div className="text-xs text-church-gray">Click to select this member</div>
                      </button>
                    ))}
                  </div>
                )}
                {showMemberSuggestions && filteredMembers.length === 0 && memberNameInput.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-church-blue/20 rounded-xl shadow-lg z-10 p-4">
                    <div className="text-center">
                      <div className="text-sm font-bold text-church-gray mb-2">No existing members found</div>
                      <div className="text-xs text-church-gray">This will be recorded as a new member name</div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Amount (UGX)</label>
                <input 
                  type="number"
                  placeholder="0"
                  className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue transition-all font-bold text-lg text-church-blue mt-2"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={paymentStatus !== 'idle'}
                />
              </div>
            </div>

            <div className="flex gap-3 md:gap-4 mt-6 md:mt-8">
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-church-soft text-church-black py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-church-blue/5 transition-all"
                disabled={paymentStatus !== 'idle'}
              >
                Cancel
              </button>
              <button 
                onClick={handlePaymentSubmit}
                className="flex-1 bg-church-yellow text-church-black py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-church-yellow/20 disabled:opacity-50"
                disabled={paymentStatus !== 'idle'}
              >
                {processing ? 'Processing...' : 'Pay Now'}
              </button>
            </div>

            <div className="mt-4 md:mt-6 p-3 md:p-4 bg-church-blue/5 rounded-xl md:rounded-2xl">
              <p className="text-xs text-church-gray leading-relaxed">
                <strong>Security Note:</strong> You will receive a prompt on your phone to confirm the payment. 
                Never share your PIN with anyone. Church staff will never ask for your mobile money PIN.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-church-black/80 backdrop-blur-md">
          <div className="bg-white rounded-[32px] md:rounded-[48px] p-6 md:p-10 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl md:text-2xl font-display font-black mb-6 md:mb-8">Enter Mobile Money PIN</h3>
            
            <div className="space-y-4 md:space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Transaction Details</label>
                <div className="p-4 bg-church-soft rounded-2xl border border-church-blue/10">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-church-gray">Amount:</span>
                      <span className="text-lg font-bold text-church-black">UGX {Number(amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-church-gray">Method:</span>
                      <span className="text-lg font-bold text-church-black">{paymentMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-church-gray">Phone:</span>
                      <span className="text-lg font-bold text-church-black">{phoneNumber}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Your PIN</label>
                <input 
                  type="password"
                  maxLength={4}
                  placeholder="****"
                  className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue transition-all font-bold text-lg text-center tracking-widest mt-2"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  disabled={paymentStatus !== 'idle'}
                />
              </div>
            </div>

            <div className="flex gap-3 md:gap-4 mt-6 md:mt-8">
              <button 
                onClick={() => {
                  setShowPinModal(false);
                  setShowPaymentModal(false);
                  setPin('');
                }}
                className="flex-1 bg-church-soft text-church-black py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-church-blue/5 transition-all"
                disabled={paymentStatus !== 'idle'}
              >
                Cancel
              </button>
              <button 
                onClick={handlePinSubmit}
                className="flex-1 bg-church-yellow text-church-black py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-church-yellow/20 disabled:opacity-50"
                disabled={paymentStatus !== 'idle'}
              >
                {paymentStatus === 'processing' ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>

            <div className="mt-4 md:mt-6 p-3 md:p-4 bg-church-blue/5 rounded-xl md:rounded-2xl">
              <p className="text-xs text-church-gray leading-relaxed">
                <strong>Security Note:</strong> Enter your mobile money PIN to complete this transaction. 
                This is a secure transaction - never share your PIN with anyone.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
