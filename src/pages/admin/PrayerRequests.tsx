import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  Search,
  Filter,
  Heart,
  CheckCircle2,
  Clock,
  MoreVertical,
  Bell,
  Smartphone,
  Download,
  Star
} from 'lucide-react';
import { cn, formatDate, downloadExcel } from '@/src/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';

export default function PrayerRequests() {
  const { churchId } = useAuth();
  const [viewMode, setViewMode] = useState<'prayer' | 'testimony'>('prayer');
  const [filter, setFilter] = useState('All');
  const [requests, setRequests] = useState<any[]>([]);
  const [testimonies, setTestimonies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!churchId) return;

    const q = query(collection(db, 'churches', churchId, 'prayerRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'prayerRequests');
    });

    return () => unsubscribe();
  }, [churchId]);

  useEffect(() => {
    if (!churchId) return;

    const q = query(collection(db, 'churches', churchId, 'testimonies'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTestimonies(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'testimonies');
    });

    return () => unsubscribe();
  }, [churchId]);

  const handleMarkAnswered = async (id: string) => {
    try {
      const docRef = doc(db, 'churches', churchId!, 'prayerRequests', id);
      await updateDoc(docRef, {
        status: 'Answered',
        updatedAt: serverTimestamp()
      });
      alert("Spiritual record updated: Answered prayer.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'prayerRequests');
    }
  };

  const handleExport = () => {
    const data = viewMode === 'prayer' ? requests : testimonies;
    const filename = viewMode === 'prayer' 
      ? `graceflow_prayer_requests_${new Date().toISOString().split('T')[0]}.xlsx`
      : `graceflow_testimonies_${new Date().toISOString().split('T')[0]}.xlsx`;
    downloadExcel(data, filename);
  };

  const filteredRequests = requests.filter(req => {
    const matchesFilter = filter === 'All' || req.status === filter;
    const matchesSearch = req.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         req.requestText?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filteredTestimonies = testimonies.filter(test => {
    const matchesSearch = test.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         test.testimonyText?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const activeNeeds = requests.filter(r => r.status === 'Pending').length;
  const answeredCount = requests.filter(r => r.status === 'Answered').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{viewMode === 'prayer' ? 'Prayer Requests' : 'Testimonies'}</h2>
          <p className="text-slate-500 text-sm">{viewMode === 'prayer' ? 'Review, respond, and track member prayer needs.' : 'View and manage member testimonies.'}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setViewMode(viewMode === 'prayer' ? 'testimony' : 'prayer')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors text-xs uppercase tracking-widest border",
              viewMode === 'prayer' 
                ? "bg-church-blue text-white border-church-blue" 
                : "bg-church-soft text-church-gray border-church-blue/10 hover:bg-church-blue/5"
            )}
          >
            {viewMode === 'prayer' ? (
              <>
                <Star className="w-4 h-4" />
                View Testimonies
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4" />
                View Prayer Requests
              </>
            )}
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-church-soft text-church-gray px-4 py-2 rounded-xl font-semibold hover:bg-church-blue/5 transition-colors text-xs uppercase tracking-widest border border-church-blue/10"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button className="flex items-center gap-2 bg-rose-50 text-rose-700 px-4 py-2 rounded-xl font-semibold hover:bg-rose-100 transition-colors">
            <Bell className="w-4 h-4" />
            Notify Staff
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Stats */}
        <div className="md:w-64 space-y-6">
          {viewMode === 'prayer' ? (
            <>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider">Overview</h3>
                  <Heart className="w-4 h-4 text-rose-500" />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Active Needs</span>
                    <span className="font-bold text-lg">{activeNeeds}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-600">
                    <span className="text-sm">Answered</span>
                    <span className="font-bold text-lg">{answeredCount}</span>
                  </div>
                </div>
              </div>

              <div className="bg-rose-600 p-6 rounded-2xl text-white shadow-lg">
                 <div className="flex items-center gap-2 mb-3">
                   <Smartphone className="w-5 h-5" />
                   <h3 className="font-bold">SMS Alerts</h3>
                 </div>
                 <p className="text-xs text-rose-100 leading-relaxed mb-4">
                   New prayer requests are automatically sent to the Pastoral care team.
                 </p>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Active</span>
                 </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider">Overview</h3>
                <Star className="w-4 h-4 text-church-yellow" />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Total Testimonies</span>
                  <span className="font-bold text-lg">{testimonies.length}</span>
                </div>
                <div className="flex justify-between items-center text-church-yellow">
                  <span className="text-sm">Public</span>
                  <span className="font-bold text-lg">{testimonies.filter(t => t.visibility === 'Public').length}</span>
                </div>
                <div className="flex justify-between items-center text-blue-600">
                  <span className="text-sm">Department</span>
                  <span className="font-bold text-lg">{testimonies.filter(t => t.visibility === 'Department').length}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Request/Testimony List */}
        <div className="flex-1 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder={viewMode === 'prayer' ? "Search requests..." : "Search testimonies..."} 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {viewMode === 'prayer' && (
              <div className="flex gap-2">
                {['All', 'Pending', 'Answered'].map((f) => (
                  <button 
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      filter === f ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {viewMode === 'prayer' ? (
              filteredRequests.map((request) => (
                <motion.div 
                  key={request.id}
                  layout
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 font-bold">
                         {request.memberName ? request.memberName.charAt(0) : 'A'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{request.memberName || 'Anonymous'}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {request.isPrivate ? 'PRIVATE RECORD' : `${request.visibility}${request.targetDepartment ? ` - ${request.targetDepartment}` : ''}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        request.status === 'Pending' ? "bg-yellow-100 text-church-yellow" : "bg-emerald-100 text-emerald-700"
                      )}>
                        {request.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="pl-13">
                    <p className="text-slate-700 leading-relaxed italic border-l-4 border-slate-100 pl-4 mb-4">
                      "{request.requestText}"
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {request.status === 'Pending' ? (
                          <button 
                            onClick={() => handleMarkAnswered(request.id)}
                            className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Mark Answered
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                             <CheckCircle2 className="w-4 h-4" />
                             Answered
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {request.createdAt ? formatDate((request.createdAt as any).toDate?.() || request.createdAt) : 'Recent'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              filteredTestimonies.map((testimony) => (
                <motion.div 
                  key={testimony.id}
                  layout
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center text-church-yellow font-bold">
                         {testimony.memberName ? testimony.memberName.charAt(0) : 'A'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{testimony.memberName || 'Anonymous'}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {testimony.memberEmail}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        testimony.visibility === 'Public' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {testimony.visibility}
                      </span>
                    </div>
                  </div>
                  
                  <div className="pl-13">
                    <div className="flex items-center gap-2 mb-2 text-[10px] text-slate-500">
                      <span className="font-bold uppercase tracking-wider">Date of Occurrence:</span>
                      <span>{testimony.dateOfOccurrence ? new Date(testimony.dateOfOccurrence).toLocaleDateString() : 'Not specified'}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed italic border-l-4 border-yellow-400 pl-4 mb-4">
                      "{testimony.testimonyText}"
                    </p>
                    {testimony.targetDepartment && (
                      <div className="flex items-center gap-2 mb-2 text-[10px] text-slate-500">
                        <span className="font-bold uppercase tracking-wider">Target Department:</span>
                        <span>{testimony.targetDepartment}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {testimony.createdAt ? formatDate((testimony.createdAt as any).toDate?.() || testimony.createdAt) : 'Recent'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
