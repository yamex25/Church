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
    <div className="space-y-10 text-church-black">
      <div className="text-center">
        <h2 className="text-4xl font-display font-black tracking-tight text-church-black mb-4">Contribution Ledger</h2>
        <p className="text-sm font-bold text-church-gray uppercase tracking-widest">Faithful Stewardship</p>
      </div>

      {/* Main Message Card */}
      <div className="bg-gradient-to-br from-church-blue to-church-blue/90 p-12 rounded-[48px] text-white shadow-2xl shadow-church-blue/30 relative overflow-hidden">
        <div className="relative z-10 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-church-yellow/20 p-6 rounded-full">
              <Church className="w-16 h-16 text-church-yellow" />
            </div>
          </div>
          
          <h3 className="text-3xl font-display font-black mb-6 tracking-tight">
            Under Development
          </h3>
          
          <p className="text-lg leading-relaxed mb-8 text-white/90 max-w-2xl mx-auto">
            We are currently working on enhancing our online contribution system to provide you with a seamless digital giving experience.
          </p>
          
          <div className="bg-white/10 backdrop-blur-sm p-8 rounded-[32px] border border-white/20 mb-8">
            <h4 className="text-xl font-bold mb-4 text-church-yellow">How to Make Your Contributions</h4>
            <p className="text-white/90 leading-relaxed mb-6">
              For now, please make your contributions through our Church Accounts Office. Our dedicated team is ready to assist you with:
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 text-left">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <h5 className="font-bold text-church-yellow mb-2">Tithes & Offerings</h5>
                <p className="text-sm text-white/80">Weekly tithes and special offerings</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <h5 className="font-bold text-church-yellow mb-2">Building Fund</h5>
                <p className="text-sm text-white/80">Church development and expansion projects</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <h5 className="font-bold text-church-yellow mb-2">Mission Support</h5>
                <p className="text-sm text-white/80">Outreach and missionary work</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <h5 className="font-bold text-church-yellow mb-2">Special Projects</h5>
                <p className="text-sm text-white/80">Church programs and initiatives</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-6">
            <div className="bg-church-yellow text-church-black px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest shadow-xl shadow-church-yellow/20">
              Church Office Open
            </div>
            <div className="bg-white/10 px-8 py-4 rounded-full font-bold text-sm uppercase tracking-widest border border-white/20">
              Mon - Fri: 8AM - 5PM
            </div>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute -right-20 -bottom-20 opacity-10">
          <Church className="w-96 h-96" />
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white p-10 rounded-[48px] border-2 border-church-yellow shadow-xl shadow-church-blue/10">
        <div className="text-center">
          <h4 className="text-2xl font-display font-black mb-6 text-church-black">Need Assistance?</h4>
          <p className="text-church-gray mb-8 leading-relaxed">
            Our accounts team is here to help you with your contributions and answer any questions you may have.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-church-soft p-6 rounded-2xl">
              <div className="bg-church-blue w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h5 className="font-bold text-church-black mb-2">Office Hours</h5>
              <p className="text-sm text-church-gray">Monday - Friday<br />8:00 AM - 5:00 PM</p>
            </div>
            
            <div className="bg-church-soft p-6 rounded-2xl">
              <div className="bg-church-blue w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <h5 className="font-bold text-church-black mb-2">Payment Methods</h5>
              <p className="text-sm text-church-gray">Cash, Mobile Money<br />Bank Transfer, Cheques</p>
            </div>
            
            <div className="bg-church-soft p-6 rounded-2xl">
              <div className="bg-church-blue w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Info className="w-6 h-6 text-white" />
              </div>
              <h5 className="font-bold text-church-black mb-2">Get Help</h5>
              <p className="text-sm text-church-gray">Visit the church office<br />Call our accounts team</p>
            </div>
          </div>
        </div>
      </div>

      {/* Thank You Message */}
      <div className="bg-gradient-to-r from-church-yellow to-church-yellow/80 p-8 rounded-[32px] text-church-black shadow-xl shadow-church-yellow/20">
        <div className="text-center">
          <h4 className="text-2xl font-display font-black mb-4">Thank You for Your Faithful Giving</h4>
          <p className="text-sm leading-relaxed font-bold">
            Your contributions help us advance God's kingdom and serve our community. We appreciate your partnership in ministry.
          </p>
        </div>
      </div>
    {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-church-black/80 backdrop-blur-md">
          <div className="bg-white rounded-[48px] p-10 w-full max-w-md shadow-2xl relative">
            <h3 className="text-2xl font-display font-black mb-8">Mobile Money Payment</h3>
            
            <div className="space-y-6">
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

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-church-soft text-church-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-church-blue/5 transition-all"
                disabled={paymentStatus !== 'idle'}
              >
                Cancel
              </button>
              <button 
                onClick={handlePaymentSubmit}
                className="flex-1 bg-church-yellow text-church-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-church-yellow/20 disabled:opacity-50"
                disabled={paymentStatus !== 'idle'}
              >
                {processing ? 'Processing...' : 'Pay Now'}
              </button>
            </div>

            <div className="mt-6 p-4 bg-church-blue/5 rounded-2xl">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-church-black/80 backdrop-blur-md">
          <div className="bg-white rounded-[48px] p-10 w-full max-w-md shadow-2xl relative">
            <h3 className="text-2xl font-display font-black mb-8">Enter Mobile Money PIN</h3>
            
            <div className="space-y-6">
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

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => {
                  setShowPinModal(false);
                  setShowPaymentModal(false);
                  setPin('');
                }}
                className="flex-1 bg-church-soft text-church-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-church-blue/5 transition-all"
                disabled={paymentStatus !== 'idle'}
              >
                Cancel
              </button>
              <button 
                onClick={handlePinSubmit}
                className="flex-1 bg-church-yellow text-church-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-church-yellow/20 disabled:opacity-50"
                disabled={paymentStatus !== 'idle'}
              >
                {paymentStatus === 'processing' ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>

            <div className="mt-6 p-4 bg-church-blue/5 rounded-2xl">
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
