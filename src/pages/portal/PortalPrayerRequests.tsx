import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Plus, 
  CheckCircle2, 
  Clock, 
  MessageCircle,
  HelpCircle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/src/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { PrayerRequest } from '@/src/types';

export default function PortalPrayerRequests() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [newRequest, setNewRequest] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [visibility, setVisibility] = useState<'Public' | 'Pastors' | 'Department'>('Public');
  const [targetDepartment, setTargetDepartment] = useState('Spiritual Ministry');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'prayerRequests'),
      where('memberName', '==', user.displayName),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Format date for UI
        date: doc.data().createdAt ? (doc.data().createdAt as Timestamp).toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Pending...'
      }));
      setRequests(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'prayerRequests');
    });

    return () => unsubscribe();
  }, [user]);
  
  const handleSubmit = async () => {
    console.log('Submit button clicked');
    
    if (!newRequest.trim()) {
      alert("Please enter your prayer request.");
      return;
    }

    if (!user) {
      alert("You must be logged in to submit a prayer request.");
      return;
    }

    console.log('Submitting prayer request for:', user.displayName);
    
    try {
      const requestData = {
        memberName: user.displayName || 'Anonymous',
        requestText: newRequest.trim(),
        status: 'Pending',
        isPrivate: isPrivate,
        visibility: visibility,
        targetDepartment: visibility === 'Department' ? targetDepartment : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      console.log('Request data:', requestData);
      
      const docRef = await addDoc(collection(db, 'prayerRequests'), requestData);
      console.log('Prayer request submitted with ID:', docRef.id);
      
      // Reset form
      setNewRequest('');
      setIsPrivate(false);
      setVisibility('Public');
      setShowForm(false);
      
      alert("Your spiritual intention has been shared with the selected intercessory layer.");
    } catch (error) {
      console.error('Error submitting prayer request:', error);
      alert("There was an error submitting your prayer request. Please try again.");
    }
  };

  const markAsAnswered = async (id: string) => {
    try {
      const docRef = doc(db, 'prayerRequests', id);
      await updateDoc(docRef, {
        status: 'Answered',
        updatedAt: serverTimestamp()
      });
      alert("Hallelujah! Testimony recorded.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'prayerRequests');
    }
  };

  return (
    <div className="space-y-8 text-church-black">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-black tracking-tight text-church-black">Spiritual Intentions</h2>
          <p className="text-xs font-black text-church-gray uppercase tracking-widest mt-1">Intercession & Faith</p>
        </div>
        {!showForm && (
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center gap-3 bg-church-blue text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-church-blue/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Share Intention
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-10 rounded-[48px] border-2 border-church-yellow shadow-2xl relative overflow-hidden"
          >
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="relative z-10">
              <h3 className="font-display text-2xl font-black mb-6">How can we stand with you?</h3>
              <textarea 
                rows={4}
                value={newRequest}
                onChange={(e) => setNewRequest(e.target.value)}
                placeholder="Describe your prayer need..."
                className="w-full bg-church-soft border-2 border-transparent rounded-3xl p-6 focus:outline-none focus:border-church-blue focus:bg-white text-base placeholder:text-church-gray transition-all mb-6 font-medium shadow-inner"
                required
              />
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Who should see this?</label>
                  <select 
                    className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue transition-all font-bold text-sm mt-1"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                  >
                    <option value="Public">Entire Community (Wall)</option>
                    <option value="Pastors">Pastors Office Only</option>
                    <option value="Department">Specific Department</option>
                  </select>
                </div>
                {visibility === 'Department' && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Select Department</label>
                    <select 
                      className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue transition-all font-bold text-sm mt-1"
                      value={targetDepartment}
                      onChange={(e) => setTargetDepartment(e.target.value)}
                    >
                      <option value="Spiritual Ministry">Spiritual Ministry</option>
                      <option value="Music & Worship">Music & Worship</option>
                      <option value="Youth Impact">Youth Ministry</option>
                      <option value="Welfare">Welfare Department</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 mb-10">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="peer sr-only" 
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                    />
                    <div className="w-6 h-6 border-2 border-church-blue/20 rounded-lg group-hover:border-church-blue peer-checked:bg-church-blue peer-checked:border-church-blue transition-all"></div>
                    <CheckCircle2 className="w-4 h-4 text-white absolute top-1 left-1 opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-xs text-church-black font-black uppercase tracking-widest">Mark as Confidential</span>
                </label>
              </div>
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-church-soft text-church-black py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-church-blue/5 transition-all shadow-sm"
                >
                  Withdraw
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-church-yellow text-church-black py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-church-yellow/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Submit to Wall
                </button>
              </div>
              {/* Debug button - remove later */}
              <button 
                type="button"
                onClick={() => {
                  console.log('User:', user);
                  console.log('DB available:', !!db);
                  console.log('New request:', newRequest);
                  alert(`Debug: User ${user?.displayName ? 'exists' : 'null'}, DB ${db ? 'exists' : 'null'}, Request length: ${newRequest.length}`);
                }}
                className="w-full mt-4 p-2 bg-red-100 text-red-600 rounded text-xs"
              >
                Debug Info
              </button>
            </form>
            <div className="absolute top-0 right-0 w-64 h-64 bg-church-yellow/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black text-church-gray uppercase tracking-[0.2em]">Intercession Record</h3>
          <span className="text-[10px] font-bold text-church-blue bg-church-blue/5 px-3 py-1 rounded-full uppercase tracking-widest italic">{requests.length} Intentions Recorded</span>
        </div>
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-white p-8 rounded-[40px] border border-church-blue/5 shadow-xl shadow-church-blue/5 relative overflow-hidden group hover:border-church-blue/20 transition-all cursor-default">
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                    req.status === 'Pending' ? "bg-white text-church-gray border-church-blue/10" : "bg-church-yellow text-church-black border-church-yellow-dark"
                  )}>
                    {req.status}
                  </div>
                  {req.status === 'Pending' && (
                    <button 
                      onClick={() => markAsAnswered(req.id)}
                      className="p-3 bg-church-soft text-church-gray rounded-2xl hover:bg-church-yellow hover:text-church-black transition-all flex items-center gap-2 group/btn"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover/btn:opacity-100 transition-opacity">Mark Answered</span>
                    </button>
                  )}
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-church-gray/40 uppercase tracking-widest">{req.date}</span>
                    <span className="text-[9px] font-black text-church-blue/60 uppercase tracking-widest mt-1">Target: {req.visibility}</span>
                  </div>
                </div>
                <p className="text-lg text-church-black leading-relaxed font-medium italic pl-6 border-l-4 border-church-yellow group-hover:border-church-blue transition-colors">
                  "{req.requestText}"
                </p>
                {req.status === 'Answered' && (
                  <div className="mt-8 flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest">
                    <CheckCircle2 className="w-4 h-4" />
                    Glory to God • Answered in Faith
                  </div>
                )}
              </div>
              {req.status === 'Answered' && (
                <div className="absolute -right-8 -bottom-8 p-4 text-church-yellow opacity-10 group-hover:opacity-20 transition-opacity">
                  <Heart className="w-32 h-32 fill-current" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="bg-church-blue text-white p-10 rounded-[48px] text-center shadow-2xl shadow-church-blue/20 relative overflow-hidden">
        <div className="relative z-10">
          <HelpCircle className="w-12 h-12 text-church-yellow mx-auto mb-6" />
          <p className="text-xs font-bold leading-relaxed px-6 max-w-sm mx-auto">
            Our Intercessory Team is committed to standing with you. All requests are handled with absolute pastoral dignity and care.
          </p>
        </div>
        <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -ml-16 -mt-16"></div>
      </div>
    </div>
  );
}
