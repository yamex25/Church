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

  // Load contribution configuration/settings
  const [contribSettings, setContribSettings] = useState<any>(null);
  useEffect(() => {
    const settingsDoc = doc(db, 'configs', 'contributions');
    const unsubscribeSettings = onSnapshot(settingsDoc, (snap) => {
      if (snap.exists()) setContribSettings(snap.data());
    }, (err) => {
      // Non-fatal; just log
      console.warn('Failed to load contribution settings', err);
    });

    return () => unsubscribeSettings();
  }, []);

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
    <div className="min-h-screen flex items-start justify-center bg-church-soft py-8 px-4">
      <div className="w-full px-6 bg-white shadow-2xl overflow-hidden py-8 rounded-lg border border-church-blue/5">
        <header className="bg-church-blue px-8 py-8 flex items-center justify-between z-10 rounded-t-lg shadow-md">
          <div className="flex items-center gap-4">
            <div className="bg-white p-3 rounded-lg border border-church-blue/10">
              <Info className="w-7 h-7 text-church-blue" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-black text-white">How to Contribute</h1>
              <p className="text-sm text-white/80 mt-1">Clear, secure ways to support the ministry — choose the option that suits you.</p>
            </div>
          </div>
        </header>

        <main className="px-8 py-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <section className="md:col-span-2 space-y-4">
            <div className="p-4 bg-white rounded-2xl border border-church-blue/10 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-6 bg-church-blue rounded" />
                <h2 className="text-xl font-bold text-church-blue">Mobile Money</h2>
              </div>
              <p className="text-sm text-church-gray mt-2">Quick and convenient — use your mobile money wallet to send contributions to the church account.</p>
              <ul className="mt-3 text-sm text-church-gray list-disc list-inside">
                <li>Church Mobile Number: <strong className="text-church-blue">{contribSettings?.mobileNumber || '256 700 000 000'}</strong></li>
                <li>Merchant / Paybill Code: <strong className="text-church-blue">{contribSettings?.merchantCode || 'CHURCH123'}</strong></li>
                <li>When prompted, include your full name and purpose (e.g., Tithe, Offering, Project)</li>
              </ul>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-church-blue/10 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-6 bg-church-yellow rounded" />
                <h2 className="text-xl font-bold text-church-blue">Bank Transfer</h2>
              </div>
              <p className="text-sm text-church-gray mt-2">For larger gifts or scheduled transfers, use the church bank account. Please add your name in the payment reference.</p>
              <ul className="mt-3 text-sm text-church-gray list-disc list-inside">
                <li>Bank: <strong className="text-church-blue">{contribSettings?.bankName || 'Example Bank'}</strong></li>
                <li>Account Name: <strong className="text-church-blue">{contribSettings?.bankAccountName || 'Church Name'}</strong></li>
                <li>Account Number: <strong className="text-church-blue">{contribSettings?.bankAccountNumber || '000123456789'}</strong></li>
              </ul>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-church-blue/10 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-6 bg-church-yellow rounded" />
                <h2 className="text-xl font-bold text-church-blue">In-Person Giving</h2>
              </div>
              <p className="text-sm text-church-gray mt-2">You can always give during services. Hand donations to an usher or a labelled collection point. Envelopes are available for recorded giving.</p>
            </div>
          </section>

          <aside className="md:col-span-1 space-y-4">
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-church-blue/10">
              <div className="flex items-start gap-3">
                <div className="w-2 h-8 bg-church-blue rounded" />
                <div>
                  <h3 className="text-lg font-bold text-church-blue">Need Help Recording?</h3>
                  <p className="text-sm text-church-gray mt-2">Contact the finance team to have your contribution added to your giving history.</p>
                </div>
              </div>
              <p className="text-sm font-bold mt-3">Phone: <span className="text-church-blue">{contribSettings?.helpPhone || '256 700 000 000'}</span></p>
              <p className="text-sm font-bold">Email: <span className="text-church-blue">{contribSettings?.helpEmail || 'finance@church.org'}</span></p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-church-blue/10">
              <h3 className="text-sm font-bold text-church-blue">Security</h3>
              <p className="text-xs text-church-gray mt-2">Never share PINs or sensitive account details. Church staff will never request your mobile money PIN.</p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-church-blue/10">
              <h3 className="text-sm font-bold text-church-blue">After You Give</h3>
              <p className="text-xs text-church-gray mt-2">If you want the contribution recorded to your profile, forward proof (screenshot/transaction ref) to the finance team.</p>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
