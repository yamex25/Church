import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Plus, 
  Search, 
  Calendar, 
  Users, 
  Baby, 
  Star, 
  TrendingUp,
  X,
  ClipboardCheck,
  Download
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { GeneralAttendance } from '@/src/types';
import { cn, formatDate, downloadExcel } from '@/src/lib/utils';

export default function AttendanceTracker() {
  const { user } = useAuth();
  const [history, setHistory] = useState<GeneralAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GeneralAttendance | null>(null);
  const [services, setServices] = useState<{id: string, name: string}[]>([]);
  
  const initialFormState = {
    serviceDate: new Date().toISOString().split('T')[0],
    serviceName: '',
    adultCount: 0,
    childrenCount: 0,
    firstTimers: 0,
    summary: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    const qS = query(collection(db, 'services'), orderBy('name', 'asc'));
    const unsubscribeS = onSnapshot(qS, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setServices(docs);
      if (docs.length > 0 && !formData.serviceName) {
        setFormData(prev => ({ ...prev, serviceName: docs[0].name }));
      }
    });

    const q = query(collection(db, 'attendance'), orderBy('serviceDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GeneralAttendance[];
      setHistory(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });
    return () => {
      unsubscribe();
      unsubscribeS();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      if (editingRecord) {
        const docRef = doc(db, 'attendance', editingRecord.id!);
        await updateDoc(docRef, {
          ...formData,
          updatedAt: serverTimestamp()
        });
        alert("Attendance record updated successfully.");
      } else {
        await addDoc(collection(db, 'attendance'), {
          ...formData,
          recordedBy: user.displayName || user.email || 'Staff',
          createdAt: serverTimestamp()
        });
        alert("Attendance recorded for spiritual analysis.");
      }
      setShowForm(false);
      setEditingRecord(null);
      setFormData(initialFormState);
    } catch (error) {
      console.error("Attendance Error:", error);
      handleFirestoreError(error, editingRecord ? OperationType.UPDATE : OperationType.CREATE, 'attendance');
    }
  };

  const handleEdit = (record: GeneralAttendance) => {
    setEditingRecord(record);
    setFormData({
      serviceDate: record.serviceDate,
      serviceName: record.serviceName,
      adultCount: record.adultCount,
      childrenCount: record.childrenCount,
      firstTimers: record.firstTimers,
      summary: record.summary || ''
    });
    setShowForm(true);
  };

  const handleExport = () => {
    downloadExcel(history, `graceflow_attendance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-display font-black tracking-tight text-church-black">Attendance & Growth</h2>
          <p className="text-church-gray font-medium">Measuring the spiritual pulse and numerical growth of the sanctuary.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 border-2 border-church-blue/10 text-church-gray px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-church-soft transition-all"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center gap-3 bg-church-blue text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-church-blue/20"
          >
            <Plus className="w-4 h-4" />
            Log Service
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
         <div className="bg-white p-8 rounded-[32px] border border-church-blue/5 shadow-xl shadow-church-blue/5">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-6 h-6 text-church-blue" />
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <h3 className="text-3xl font-black mb-1">
              {history.length > 0 ? history[0].adultCount + history[0].childrenCount : 0}
            </h3>
            <p className="text-xs text-church-gray font-bold uppercase tracking-wider">Latest Service Attendance</p>
         </div>
         <div className="bg-white p-8 rounded-[32px] border border-church-blue/5 shadow-xl shadow-church-blue/5">
            <div className="flex items-center justify-between mb-4">
              <Star className="w-6 h-6 text-church-yellow" />
              <span className="text-[10px] font-black uppercase tracking-widest text-church-gray">Growth Indicator</span>
            </div>
            <h3 className="text-3xl font-black mb-1">
              {history.reduce((acc, curr) => acc + curr.firstTimers, 0)}
            </h3>
            <p className="text-xs text-church-gray font-bold uppercase tracking-wider">Total First Timers (All Time)</p>
         </div>
         <div className="bg-slate-900 p-8 rounded-[32px] text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <ClipboardCheck className="w-6 h-6 text-blue-400 mb-4" />
              <h3 className="text-3xl font-black mb-1">{history.length}</h3>
              <p className="text-blue-300 text-[10px] font-black uppercase tracking-widest">Services Recorded</p>
            </div>
         </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-church-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-[40px] p-10 w-full max-w-xl shadow-2xl relative overflow-y-auto max-h-[90vh]">
              <button onClick={() => {
                setEditingRecord(null);
                setFormData(initialFormState);
                setShowForm(false);
              }} className="absolute top-8 right-8 p-3 bg-church-soft rounded-2xl text-church-gray">
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-2xl font-black mb-6">{editingRecord ? 'Update Service Record' : 'Log Service Attendance'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Service Date</label>
                    <input required type="date" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.serviceDate} onChange={e => setFormData({...formData, serviceDate: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Service Type</label>
                    <select required className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.serviceName} onChange={e => setFormData({...formData, serviceName: e.target.value})}>
                      {services.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                      {services.length === 0 && <option value="">No services defined</option>}
                    </select>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Adults</label>
                    <input required type="number" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.adultCount || ''} onChange={e => setFormData({...formData, adultCount: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Children</label>
                    <input required type="number" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.childrenCount || ''} onChange={e => setFormData({...formData, childrenCount: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">First Timers</label>
                    <input required type="number" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.firstTimers || ''} onChange={e => setFormData({...formData, firstTimers: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Service Summary / Testimonies</label>
                   <textarea rows={3} className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.summary} onChange={e => setFormData({...formData, summary: e.target.value})} placeholder="Spiritual highlights of the service..." />
                </div>
                <button type="submit" className="w-full py-4 bg-church-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-church-blue/20 hover:scale-105 transition-all">
                  {editingRecord ? 'Update Record' : 'Save Record'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[40px] border border-church-blue/5 shadow-2xl overflow-hidden">
        <table className="w-full text-left font-sans">
          <thead>
            <tr className="bg-church-blue text-white text-[10px] font-black uppercase tracking-widest border-b border-white/10">
              <th className="px-8 py-6">Date</th>
              <th className="px-8 py-6">Service</th>
              <th className="px-8 py-6 text-center">Adults</th>
              <th className="px-8 py-6 text-center">Children</th>
              <th className="px-8 py-6 text-center">Total</th>
              <th className="px-8 py-6 text-center">First Timers</th>
              <th className="px-8 py-6">Recorded By</th>
              <th className="px-8 py-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-church-soft">
            {history.map((record) => (
              <tr key={record.id} className="hover:bg-church-soft/30 transition-colors group">
                <td className="px-8 py-6 font-bold text-sm text-church-black">{formatDate(record.serviceDate)}</td>
                <td className="px-8 py-6">
                  <span className="text-[10px] font-black uppercase tracking-widest text-church-blue bg-church-blue/5 px-4 py-2 rounded-xl border border-church-blue/10">
                    {record.serviceName}
                  </span>
                </td>
                <td className="px-8 py-6 text-center font-bold text-slate-600">{record.adultCount}</td>
                <td className="px-8 py-6 text-center font-bold text-slate-600">{record.childrenCount}</td>
                <td className="px-8 py-6 text-center">
                   <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xs mx-auto">
                     {record.adultCount + record.childrenCount}
                   </div>
                </td>
                <td className="px-8 py-6 text-center">
                  <span className="text-[10px] font-black text-church-yellow-dark bg-church-yellow/20 px-3 py-1.5 rounded-lg">
                    +{record.firstTimers} New
                  </span>
                </td>
                <td className="px-8 py-6 text-xs font-medium text-church-gray italic">{record.recordedBy}</td>
                <td className="px-8 py-6 text-right">
                   <button 
                     onClick={() => handleEdit(record)}
                     className="p-2.5 bg-church-soft text-church-gray rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-church-blue hover:text-white"
                   >
                     <ClipboardCheck className="w-4 h-4" />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && (
          <div className="p-20 text-center">
             <div className="bg-church-soft w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Activity className="text-church-gray w-8 h-8 opacity-40" />
             </div>
             <p className="text-church-gray font-bold uppercase tracking-widest text-xs">No attendance records found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
