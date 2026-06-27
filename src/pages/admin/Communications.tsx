import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Send, 
  Smartphone, 
  Users, 
  History, 
  FileText,
  AlertCircle,
  CheckCircle2,
  Mail,
  Zap
} from 'lucide-react';
import { cn, formatDate } from '@/src/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { Broadcast, Member } from '@/src/types';

export default function Communications() {
  const { user, churchId } = useAuth();
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all'); 
  const [method, setMethod] = useState<'SMS' | 'Email'>('SMS');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [memberCounts, setMemberCounts] = useState<{ [key: string]: number }>({ all: 0 });
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    if (!churchId) return;

    // Fetch departments and then counts
    const unsubscribeDepts = onSnapshot(query(collection(db, 'churches', churchId, 'departments'), orderBy('name', 'asc')), (snapshotDepts) => {
      const depts = snapshotDepts.docs.map(d => ({ id: d.id, name: d.data().name }));
      setDepartments(depts);

      // Fetch member counts
      getDocs(collection(db, 'churches', churchId, 'members')).then(snapshotMembers => {
        const members = snapshotMembers.docs.map(d => d.data() as Member);
        const counts: { [key: string]: number } = { all: members.length };

        depts.forEach(dept => {
          counts[dept.name.toLowerCase()] = members.filter(m => m.categories?.includes(dept.name)).length;
        });
        setMemberCounts(counts);
      });
    });

    const q = query(collection(db, 'churches', churchId, 'broadcasts'), orderBy('sentAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Broadcast[];
      setHistory(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'broadcasts');
    });
    return () => {
      unsubscribe();
      unsubscribeDepts();
    };
  }, [churchId]);

  const handleSendBroadcast = async () => {
    if (!message.trim() || !user) return;
    
    setIsSending(true);
    setResult(null);

    try {
      // In a real app, this would trigger an SMS or Email API. 
      const broadcastCount = memberCounts[target] || 0;
      
      await addDoc(collection(db, 'churches', churchId!, 'broadcasts'), {
        churchId: churchId!,
        title: `${method} to ${target.charAt(0).toUpperCase() + target.slice(1)}`,
        message,
        sentBy: user.displayName,
        sentAt: serverTimestamp(),
        targetCount: broadcastCount,
        method: method
      });

      setResult({ 
        success: true, 
        msg: `${method} broadcast queued successfully for ${broadcastCount} recipients.` 
      });
      setMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'broadcasts');
      setResult({ success: false, msg: 'Failed to initiate broadcast.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-church-black">
      <div>
        <h2 className="text-4xl font-display font-black tracking-tight mb-2">Communications Center</h2>
        <p className="text-church-gray font-medium">Reach your congregation instantly via integrated broadcast channels.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-10 rounded-2xl sm:rounded-[48px] border border-church-blue/5 shadow-2xl shadow-church-blue/5">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-xl font-display font-black flex items-center gap-3">
                <Send className="w-6 h-6 text-church-blue" />
                Draft Message
              </h3>
              <div className="flex bg-church-soft p-1.5 rounded-2xl">
                <button 
                  onClick={() => setMethod('SMS')}
                  className={cn(
                    "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    method === 'SMS' ? "bg-white text-church-blue shadow-sm" : "text-church-gray"
                  )}
                >
                  SMS
                </button>
                <button 
                  onClick={() => setMethod('Email')}
                  className={cn(
                    "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    method === 'Email' ? "bg-white text-church-blue shadow-sm" : "text-church-gray"
                  )}
                >
                  Email
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Target Audience</label>
                <select 
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full bg-church-soft border-2 border-transparent rounded-2xl px-6 py-4 focus:border-church-blue/20 focus:bg-white transition-all text-sm font-bold appearance-none cursor-pointer"
                >
                  <option value="all">All Members ({memberCounts.all})</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.name.toLowerCase()}>
                      {dept.name} ({memberCounts[dept.name.toLowerCase()] || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end px-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray">Announcement Content</label>
                  {method === 'SMS' && (
                    <span className={cn("text-[9px] font-black uppercase tracking-wider", message.length > 160 ? "text-rose-500" : "text-church-gray")}>
                      {message.length} / 160 chars
                    </span>
                  )}
                </div>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  placeholder={method === 'SMS' ? "Important alert: Sunday service starts at 8AM..." : "Dear Saints, We are pleased to announce..."}
                  className="w-full bg-church-soft border-2 border-transparent rounded-[32px] px-8 py-6 focus:border-church-blue/20 focus:bg-white transition-all text-sm font-medium resize-none placeholder:text-church-gray/40"
                />
              </div>

              {result && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-5 rounded-3xl flex items-center gap-4 text-xs font-bold border shadow-sm",
                    result.success ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"
                  )}
                >
                  {result.success ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  {result.msg}
                </motion.div>
              )}

              <button 
                onClick={handleSendBroadcast}
                disabled={isSending || !message.trim()}
                className="w-full bg-church-blue text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-church-blue/20 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-4"
              >
                {isSending ? (
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  method === 'SMS' ? <Smartphone className="w-5 h-5" /> : <Mail className="w-5 h-5" />
                )}
                {isSending ? 'Transmitting...' : `Dispatch ${method}`}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl sm:rounded-[48px] border border-church-blue/5 shadow-2xl shadow-church-blue/5 overflow-hidden">
            <div className="px-10 py-6 border-b border-church-soft flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-church-gray">Recent Dispatch History</h3>
              <History className="w-5 h-5 text-church-gray opacity-30" />
            </div>
            <div className="divide-y divide-church-soft max-h-[400px] overflow-y-auto custom-scrollbar">
              {history.map((log) => (
                <div key={log.id} className="p-8 hover:bg-church-blue/[0.02] transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                        <span className="text-sm font-black text-church-black">{log.title}</span>
                        {(log as any).method && (
                            <span className="ml-3 text-[10px] font-black px-2 py-0.5 rounded bg-church-soft text-church-blue uppercase">{(log as any).method}</span>
                        )}
                    </div>
                    <span className="text-[10px] text-church-gray font-bold">{formatDate(log.sentAt)}</span>
                  </div>
                  <p className="text-sm text-church-gray font-medium line-clamp-2 italic">"{log.message}"</p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                      <CheckCircle2 className="w-3 h-3" />
                      Manifest: {log.targetCount} successful
                    </div>
                    <span className="text-[9px] font-bold text-church-gray italic">Sent by {log.sentBy}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-church-black rounded-2xl sm:rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden group">
             <div className="absolute -right-4 -top-4 w-24 h-24 bg-church-blue/20 rounded-full blur-2xl group-hover:bg-church-blue/40 transition-colors" />
             <div className="flex items-center gap-4 mb-8">
               <div className="p-3 bg-white/10 rounded-2xl">
                 <Zap className="w-6 h-6 text-church-blue" />
               </div>
               <h3 className="text-lg font-black tracking-tight">System Status</h3>
             </div>
             <div className="space-y-4">
                <div>
                   <p className="text-church-gray text-[10px] font-black uppercase tracking-widest mb-1">SMS API Credits</p>
                   <p className="text-3xl font-black">4,250</p>
                </div>
                <div>
                   <p className="text-church-gray text-[10px] font-black uppercase tracking-widest mb-1">Emails Sent (MTD)</p>
                   <p className="text-3xl font-black">12,840</p>
                </div>
             </div>
             <button className="w-full bg-church-blue text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest mt-8 hover:shadow-lg hover:shadow-church-blue/20 transition-all active:scale-95">
               Integrate New Channel
             </button>
          </div>

          <div className="bg-white p-8 rounded-2xl sm:rounded-[40px] border border-church-blue/5 shadow-xl shadow-church-blue/5">
            <h3 className="text-xs font-black uppercase tracking-widest text-church-black mb-6">Dispatch Protocols</h3>
            <ul className="space-y-4">
              {[
                "Character limit (160) for SMS efficiency.",
                "Mandatory identification for all broadcasts.",
                "Department-level isolation for privacy.",
                "Scheduled dispatches available on Pro plan."
              ].map((text, i) => (
                <li key={i} className="flex gap-3 text-xs font-bold text-church-gray leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-church-blue mt-1.5 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
