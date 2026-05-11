import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  Calendar, 
  MessageSquare, 
  ChevronRight,
  CheckCircle2,
  X,
  UserCheck,
  Zap,
  Download,
  TrendingUp,
  BarChart3,
  Target
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Visitor } from '@/src/types';
import { cn, formatDate, downloadExcel } from '@/src/lib/utils';

export default function VisitorManagement() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingVisitor, setEditingVisitor] = useState<Visitor | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-indexed

  const initialVisitorState = {
    name: '',
    phone: '',
    email: '',
    sex: 'Male' as 'Male' | 'Female',
    maritalStatus: 'Single' as 'Single' | 'Married' | 'Widowed' | 'Divorced',
    dateOfBirth: '',
    tribe: '',
    residence: { village: '', parish: '', division: '' },
    visitationDate: new Date().toISOString().split('T')[0],
    invitedBy: '',
    currentChurch: '',
    isBornAgain: false,
    prayerNeeds: '',
    status: 'New' as 'New' | 'Followed Up' | 'Member'
  };

  const [newVisitor, setNewVisitor] = useState(initialVisitorState);

  // Performance Stats Calculation
  const stats = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Global conversion (lifetime)
    const lifetimeConverted = visitors.filter(v => v.status === 'Member').length;

    // Filtered by selected year and month
    const filteredByPeriod = visitors.filter(v => {
      const vDate = new Date(v.visitationDate || v.createdAt);
      const yMatches = vDate.getFullYear() === selectedYear;
      const mMatches = selectedMonth === 0 || (vDate.getMonth() + 1) === selectedMonth;
      return yMatches && mMatches;
    });

    const yearlyTotal = visitors.filter(v => new Date(v.visitationDate || v.createdAt).getFullYear() === selectedYear).length;
    
    // Performance metrics
    const weekly = visitors.filter(v => new Date(v.visitationDate || v.createdAt) >= oneWeekAgo).length;
    const monthly = filteredByPeriod.length;
    
    const convertedInPeriod = filteredByPeriod.filter(v => v.status === 'Member').length;
    const conversionRate = filteredByPeriod.length > 0 ? Math.round((convertedInPeriod / filteredByPeriod.length) * 100) : 0;

    return { 
      weekly, 
      monthly, 
      yearly: yearlyTotal, 
      total: visitors.length, 
      converted: convertedInPeriod, 
      conversionRate,
      lifetimeConverted
    };
  }, [visitors, selectedYear, selectedMonth]);

  useEffect(() => {
    const q = query(collection(db, 'visitors'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Visitor[];
      setVisitors(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'visitors');
    });
    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Duplicate check
    if (!editingVisitor && visitors.some(v => v.phone === newVisitor.phone)) {
      alert("A visitor with this phone number is already registered.");
      return;
    }

    try {
      if (editingVisitor) {
        const docRef = doc(db, 'visitors', editingVisitor.id!);
        await updateDoc(docRef, {
          ...newVisitor,
          updatedAt: serverTimestamp()
        });
        alert("Visitor record updated successfully.");
      } else {
        await addDoc(collection(db, 'visitors'), {
          ...newVisitor,
          createdAt: serverTimestamp()
        });
        alert("Visitor record created for follow-up.");
      }
      setShowAddForm(false);
      setEditingVisitor(null);
      setNewVisitor(initialVisitorState);
    } catch (error) {
      console.error("Visitor Saving Error:", error);
      handleFirestoreError(error, editingVisitor ? OperationType.UPDATE : OperationType.CREATE, 'visitors');
    }
  };

  const handleEdit = (visitor: Visitor) => {
    setEditingVisitor(visitor);
    setNewVisitor({
      name: visitor.name,
      phone: visitor.phone,
      email: visitor.email || '',
      sex: visitor.sex,
      maritalStatus: visitor.maritalStatus,
      dateOfBirth: visitor.dateOfBirth,
      tribe: visitor.tribe,
      residence: visitor.residence,
      visitationDate: visitor.visitationDate,
      invitedBy: visitor.invitedBy || '',
      currentChurch: visitor.currentChurch || '',
      isBornAgain: visitor.isBornAgain,
      prayerNeeds: visitor.prayerNeeds || '',
      status: visitor.status
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this visitor record?")) return;
    try {
      await deleteDoc(doc(db, 'visitors', id));
      alert("Visitor record deleted.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'visitors');
    }
  };

  const convertToMember = async (visitor: Visitor) => {
    if (!visitor.id) return;
    try {
      // 1. Create member record
      const memberData = {
        name: visitor.name,
        email: visitor.email || '',
        phone: visitor.phone,
        sex: visitor.sex,
        maritalStatus: visitor.maritalStatus,
        dateOfBirth: visitor.dateOfBirth,
        tribe: visitor.tribe,
        residence: visitor.residence,
        membershipStatus: 'Active',
        categories: ['Member'],
        joinedAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
      };

      const memberRef = await addDoc(collection(db, 'members'), memberData);

      // 2. Update visitor status
      await updateDoc(doc(db, 'visitors', visitor.id), { 
        status: 'Member',
        convertedMemberId: memberRef.id,
        updatedAt: serverTimestamp()
      });

      alert(`${visitor.name} has been successfully converted to a member!`);
    } catch (error) {
      console.error("Conversion Error:", error);
      handleFirestoreError(error, OperationType.CREATE, 'members');
    }
  };

  const updateStatus = async (id: string, status: Visitor['status']) => {
    try {
      await updateDoc(doc(db, 'visitors', id), { 
        status,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'visitors');
    }
  };

  const filtered = visitors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.phone.includes(searchTerm)
  );

  const handleExport = () => {
    downloadExcel(visitors, `graceflow_visitors_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[40px] border border-slate-200">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Visitor Care</h2>
          <p className="text-slate-500 font-medium">Monitoring guest experience and spiritual conversion tracking.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-slate-50 text-slate-600 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all border border-slate-200"
          >
            <Download className="w-5 h-5" />
            Export Data
          </button>
          <button 
            onClick={() => {
              setEditingVisitor(null);
              setNewVisitor(initialVisitorState);
              setShowAddForm(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-sm hover:bg-indigo-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            Register Guest
          </button>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-4">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-black uppercase tracking-widest text-slate-500">Analytics Filters</span>
          </div>
          <div className="flex gap-2">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold"
            >
              <option value={0}>All Months</option>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-50 rounded-2xl">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Intake</p>
                <h3 className="text-2xl font-black text-slate-900">{stats.weekly}</h3>
              </div>
            </div>
            <p className="text-[10px] font-bold text-blue-600 py-1 px-2 bg-blue-50 rounded-full inline-block">Rolling 7 Days</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-indigo-50 rounded-2xl">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Monthly Status</p>
                <h3 className="text-2xl font-black text-slate-900">{stats.monthly}</h3>
              </div>
            </div>
            <p className="text-[10px] font-bold text-indigo-600 py-1 px-2 bg-indigo-50 rounded-full inline-block">
              {selectedMonth === 0 ? 'All Months' : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][selectedMonth - 1]} {selectedYear}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-emerald-50 rounded-2xl">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Yearly Volume</p>
                <h3 className="text-2xl font-black text-slate-900">{stats.yearly}</h3>
              </div>
            </div>
            <p className="text-[10px] font-bold text-emerald-600 py-1 px-2 bg-emerald-50 rounded-full inline-block">Full Year {selectedYear}</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-indigo-600 p-6 rounded-3xl shadow-lg relative overflow-hidden text-white"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Conversion Rate</p>
                  <h3 className="text-2xl font-black text-white">{stats.conversionRate}%</h3>
                </div>
              </div>
              <p className="text-[10px] font-bold text-indigo-200 py-1 px-2 bg-white/10 rounded-full inline-block">
                {stats.converted} Converts in Selected Period
              </p>
            </div>
            <Target className="absolute -right-8 -bottom-8 w-32 h-32 text-white/10" />
          </motion.div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] border border-church-blue/5 shadow-xl shadow-church-blue/5 flex items-center gap-4">
        <Search className="w-5 h-5 text-church-blue ml-4" />
        <input type="text" placeholder="Search visitors by name or phone..." className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {filtered.map((visitor) => (
          <motion.div 
            layout
            key={visitor.id} 
            className="bg-white rounded-[32px] p-8 border border-church-blue/10 shadow-lg relative overflow-hidden group hover:border-church-blue/30 transition-all"
          >
            <div className="flex items-start justify-between mb-6">
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-church-soft flex items-center justify-center text-church-blue font-black text-lg">
                    {visitor.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-church-black">{visitor.name}</h4>
                    <span className="text-[10px] font-black uppercase tracking-widest text-church-gray flex items-center gap-2">
                       <Calendar className="w-3 h-3" /> Visited: {formatDate(visitor.visitationDate)}
                    </span>
                  </div>
               </div>
               <div className={cn(
                 "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border",
                 visitor.status === 'New' ? "bg-amber-100 text-amber-700 border-amber-200" :
                 visitor.status === 'Followed Up' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                 "bg-church-blue text-white border-church-blue"
               )}>
                 {visitor.status}
               </div>
            </div>

            <div className="grid grid-cols-2 gap-6 p-4 bg-church-soft/50 rounded-2xl mb-4">
               <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-church-blue" />
                  <span className="text-sm font-bold text-church-black">{visitor.phone}</span>
               </div>
               <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-church-blue" />
                  <span className="text-sm font-bold text-church-gray truncate">{visitor.email || 'No Email'}</span>
               </div>
            </div>

            <div className="flex justify-end gap-2 mb-4">
               <button 
                 onClick={() => handleEdit(visitor)}
                 className="p-2 bg-church-soft text-church-blue rounded-xl hover:bg-church-blue hover:text-white transition-all shadow-sm"
               >
                 <Zap className="w-4 h-4" />
               </button>
               <button 
                 onClick={() => handleDelete(visitor.id!)}
                 className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
               >
                 <X className="w-4 h-4" />
               </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 px-2">
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-church-gray mb-1">Current Church</p>
                  <p className="text-xs font-bold text-church-black truncate">{visitor.currentChurch || 'None Registered'}</p>
               </div>
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-church-gray mb-1">Born Again</p>
                  <p className={cn("text-xs font-black", visitor.isBornAgain ? "text-emerald-600" : "text-rose-500")}>
                    {visitor.isBornAgain ? 'YES' : 'NO'}
                  </p>
               </div>
            </div>

            {visitor.prayerNeeds && (
              <div className="mb-6">
                <p className="text-xs text-church-gray font-bold uppercase tracking-widest mb-1 ml-1 flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" /> Prayer Needs
                </p>
                <p className="text-sm italic text-slate-600 pl-4 border-l-4 border-church-blue/20 leading-relaxed truncate">
                  "{visitor.prayerNeeds}"
                </p>
              </div>
            )}

            <div className="flex gap-2">
               {visitor.status === 'New' && (
                  <button 
                  onClick={() => updateStatus(visitor.id!, 'Followed Up')}
                  className="flex-1 bg-church-soft text-church-gray py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-church-blue hover:text-white transition-all"
                >
                  Mark Followed Up
                </button>
               )}
               {visitor.status === 'Followed Up' && (
                  <button 
                  onClick={() => convertToMember(visitor)}
                  className="flex-1 bg-emerald-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-all"
                >
                  Convert to Member
                </button>
               )}
               <button className="px-5 bg-church-soft text-church-gray py-3 rounded-xl hover:bg-church-blue hover:text-white transition-all">
                  <ChevronRight className="w-5 h-5" />
               </button>
            </div>
            
            <Zap className="absolute -right-4 -bottom-4 w-24 h-24 text-church-blue/5 group-hover:scale-110 transition-transform" />
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-church-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-[40px] p-10 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => {
                setEditingVisitor(null);
                setNewVisitor(initialVisitorState);
                setShowAddForm(false);
              }} className="absolute top-8 right-8 p-3 bg-church-soft rounded-2xl text-church-gray">
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-2xl font-black mb-6">{editingVisitor ? 'Edit Visitor Record' : 'Register New Visitor'}</h3>
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Visitor Name</label>
                    <input required type="text" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.name} onChange={e => setNewVisitor({...newVisitor, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Phone Number</label>
                    <input required type="text" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.phone} onChange={e => setNewVisitor({...newVisitor, phone: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Sex</label>
                    <select className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.sex} onChange={e => setNewVisitor({...newVisitor, sex: e.target.value as any})}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Marital Status</label>
                    <select className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.maritalStatus} onChange={e => setNewVisitor({...newVisitor, maritalStatus: e.target.value as any})}>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Date of Birth</label>
                    <input required type="date" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.dateOfBirth} onChange={e => setNewVisitor({...newVisitor, dateOfBirth: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Tribe</label>
                    <input type="text" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.tribe} onChange={e => setNewVisitor({...newVisitor, tribe: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Email (Optional)</label>
                    <input type="email" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.email} onChange={e => setNewVisitor({...newVisitor, email: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Residence / Location</label>
                  <div className="grid grid-cols-3 gap-4">
                    <input placeholder="Village" className="w-full px-4 py-2 rounded-lg bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all text-xs font-bold" value={newVisitor.residence.village} onChange={e => setNewVisitor({...newVisitor, residence: {...newVisitor.residence, village: e.target.value}})} />
                    <input placeholder="Parish" className="w-full px-4 py-2 rounded-lg bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all text-xs font-bold" value={newVisitor.residence.parish} onChange={e => setNewVisitor({...newVisitor, residence: {...newVisitor.residence, parish: e.target.value}})} />
                    <input placeholder="Division" className="w-full px-4 py-2 rounded-lg bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all text-xs font-bold" value={newVisitor.residence.division} onChange={e => setNewVisitor({...newVisitor, residence: {...newVisitor.residence, division: e.target.value}})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Current/Previous Church</label>
                    <input type="text" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.currentChurch} onChange={e => setNewVisitor({...newVisitor, currentChurch: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Is Born Again?</label>
                    <select className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.isBornAgain ? 'Yes' : 'No'} onChange={e => setNewVisitor({...newVisitor, isBornAgain: e.target.value === 'Yes'})}>
                      <option value="Yes">Yes, Born Again</option>
                      <option value="No">No, Not Yet</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Date of Visit</label>
                    <input required type="date" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.visitationDate} onChange={e => setNewVisitor({...newVisitor, visitationDate: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Invited By</label>
                    <input type="text" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.invitedBy} onChange={e => setNewVisitor({...newVisitor, invitedBy: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Prayer Needs / Notes</label>
                   <textarea rows={3} className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.prayerNeeds} onChange={e => setNewVisitor({...newVisitor, prayerNeeds: e.target.value})} />
                </div>
                <button type="submit" className="w-full py-4 bg-church-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-church-blue/20 hover:scale-105 transition-all">
                  {editingVisitor ? 'Update Record' : 'Start Follow-up Journey'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
