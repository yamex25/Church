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

// Kampala location data structure
const kampalaLocations = {
  divisions: [
    'Kampala Central',
    'Rubaga',
    'Kawempe',
    'Nakawa',
    'Makindye'
  ],
  parishes: {
    'Kampala Central': [
      'Kampala Town Parish',
      'Nakasero Parish',
      'Kololo Parish',
      'Nakivubo Parish'
    ],
    'Rubaga': [
      'Rubaga Parish',
      'Lubaga Parish',
      'Mengo Parish',
      'Nabunya Parish'
    ],
    'Kawempe': [
      'Kawempe Parish',
      'Makerere Parish',
      'Bwaise Parish',
      'Kawala Parish',
      'Kanyanya Parish',
      'Nansana Parish'
    ],
    'Nakawa': [
      'Nakawa Parish',
      'Bugolobi Parish',
      'Mbuya Parish',
      'Ntinda Parish'
    ],
    'Makindye': [
      'Makindye Parish',
      'Kibuye Parish',
      'Kabalagala Parish',
      'Naguru Parish'
    ]
  },
  villages: {
    'Kampala Town Parish': [
      'Central Market',
      'Kampala Road',
      'Parliament Avenue',
      'Entebbe Road'
    ],
    'Nakasero Parish': [
      'Nakasero Hill',
      'Sheraton Road',
      'Speke Road',
      'Gaddafi Mosque'
    ],
    'Kololo Parish': [
      'Kololo Hill',
      'Independence Avenue',
      'Kira Road',
      'Prince Charles Drive'
    ],
    'Nakivubo Parish': [
      'Nakivubo',
      'Owino Market',
      'Kampala Bus Park',
      'Old Taxi Park'
    ],
    'Rubaga Parish': [
      'Rubaga Hill',
      'St. Mary\'s Cathedral',
      'Kabaka\'s Palace',
      'Bulange'
    ],
    'Lubaga Parish': [
      'Lubaga Hill',
      'St. Luke\'s',
      'Lubaga Road',
      'Kabaka\'s Lake'
    ],
    'Mengo Parish': [
      'Mengo Hill',
      'Bulange',
      'Kabaka\'s Palace',
      'Kabaka\'s Lake'
    ],
    'Nabunya Parish': [
      'Nabunya',
      'Lubiri',
      'Kagga',
      'Kasubi'
    ],
    'Kawempe Parish': [
      'Kawempe',
      'Kawempe Market',
      'Kawempe Junction',
      'Makerere Hill',
      'Kikoni',
      'Bwaise Junction'
    ],
    'Makerere Parish': [
      'Makerere Hill',
      'Makerere University',
      'Makerere Kikoni',
      'Makerere West',
      'Makerere East',
      'Wandegeya',
      'Bikya',
      'Katanga',
      'Kikoni',
      'Taka'
    ],
    'Bwaise Parish': [
      'Bwaise',
      'Bwaise I',
      'Bwaise II',
      'Bwaise III'
    ],
    'Kawala Parish': [
      'Kawala',
      'Kawala Market',
      'Kawala Trading Center',
      'Kawala Junction'
    ],
    'Kanyanya Parish': [
      'Kanyanya',
      'Kanyanya Market',
      'Kanyanya Trading Center',
      'Kanyanya Junction'
    ],
    'Nakawa Parish': [
      'Nakawa',
      'Nakawa Market',
      'Nakawa Trading Center',
      'Nakawa Junction'
    ],
    'Bugolobi Parish': [
      'Bugolobi',
      'Bugolobi Flats',
      'Bugolobi Market',
      'Bugolobi Trading Center'
    ],
    'Mbuya Parish': [
      'Mbuya',
      'Mbuya Market',
      'Mbuya Trading Center',
      'Mbuya Junction'
    ],
    'Ntinda Parish': [
      'Ntinda',
      'Ntinda Market',
      'Ntinda Trading Center',
      'Ntinda Junction'
    ],
    'Makindye Parish': [
      'Makindye',
      'Makindye Market',
      'Makindye Trading Center',
      'Makindye Junction'
    ],
    'Kibuye Parish': [
      'Kibuye',
      'Kibuye Market',
      'Kibuye Trading Center',
      'Kibuye Junction'
    ],
    'Kabalagala Parish': [
      'Kabalagala',
      'Kabalagala Market',
      'Kabalagala Trading Center',
      'Kabalagala Junction'
    ],
    'Naguru Parish': [
      'Naguru',
      'Naguru Market',
      'Naguru Trading Center',
      'Naguru Junction'
    ]
  }
};

export default function VisitorManagement() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingVisitor, setEditingVisitor] = useState<Visitor | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-indexed
  const [showAddDivision, setShowAddDivision] = useState(false);
  const [showAddParish, setShowAddParish] = useState(false);
  const [showAddVillage, setShowAddVillage] = useState(false);
  const [newDivision, setNewDivision] = useState('');
  const [newParish, setNewParish] = useState('');
  const [newVillage, setNewVillage] = useState('');
  const [members, setMembers] = useState<{id: string, name: string}[]>([]);
  const [invitedByInput, setInvitedByInput] = useState('');
  const [showInvitedBySuggestions, setShowInvitedBySuggestions] = useState(false);
  const [filteredInvitedByMembers, setFilteredInvitedByMembers] = useState<{id: string, name: string}[]>([]);
  const [selectedInvitedByMember, setSelectedInvitedByMember] = useState<{id: string, name: string} | null>(null);

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

  const handleInvitedByChange = (value: string) => {
    setInvitedByInput(value);
    setSelectedInvitedByMember(null);
    
    if (value.trim()) {
      // Filter members based on input
      const filtered = members.filter(member => 
        member.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredInvitedByMembers(filtered);
      setShowInvitedBySuggestions(true);
      
      // Check if exact match exists
      const exactMatch = members.find(m => m.name.toLowerCase() === value.toLowerCase().trim());
      if (exactMatch) {
        setSelectedInvitedByMember(exactMatch);
        setNewVisitor({...newVisitor, invitedBy: exactMatch.name});
      } else {
        setNewVisitor({...newVisitor, invitedBy: value.trim()});
      }
    } else {
      setFilteredInvitedByMembers([]);
      setShowInvitedBySuggestions(false);
      setNewVisitor({...newVisitor, invitedBy: ''});
    }
  };

  const selectInvitedByMember = (member: {id: string, name: string}) => {
    setSelectedInvitedByMember(member);
    setInvitedByInput(member.name);
    setNewVisitor({...newVisitor, invitedBy: member.name});
    setShowInvitedBySuggestions(false);
    setFilteredInvitedByMembers([]);
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-2xl sm:rounded-[40px] border border-slate-200">
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
            className="bg-church-blue p-6 rounded-3xl border border-church-blue/20 shadow-lg hover:shadow-xl transition-all text-white"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/20 rounded-2xl">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-white/80 uppercase tracking-widest">Global Intake</p>
                <h3 className="text-2xl font-black text-white">{stats.weekly}</h3>
              </div>
            </div>
            <p className="text-[10px] font-bold text-white/70 py-1 px-2 bg-white/10 rounded-full inline-block">Rolling 7 Days</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-church-blue p-6 rounded-3xl border border-church-blue/20 shadow-lg hover:shadow-xl transition-all text-white"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/20 rounded-2xl">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-white/80 uppercase tracking-widest">Monthly Status</p>
                <h3 className="text-2xl font-black text-white">{stats.monthly}</h3>
              </div>
            </div>
            <p className="text-[10px] font-bold text-white/70 py-1 px-2 bg-white/10 rounded-full inline-block">
              {selectedMonth === 0 ? 'All Months' : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][selectedMonth - 1]} {selectedYear}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-church-blue p-6 rounded-3xl border border-church-blue/20 shadow-lg hover:shadow-xl transition-all text-white"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/20 rounded-2xl">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-white/80 uppercase tracking-widest">Yearly Volume</p>
                <h3 className="text-2xl font-black text-white">{stats.yearly}</h3>
              </div>
            </div>
            <p className="text-[10px] font-bold text-white/70 py-1 px-2 bg-white/10 rounded-full inline-block">Full Year {selectedYear}</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-yellow-400 p-6 rounded-3xl border border-yellow-400/20 shadow-lg hover:shadow-xl transition-all text-slate-900"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/30 rounded-2xl">
                <Target className="w-6 h-6 text-church-blue" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Conversion Rate</p>
                <h3 className="text-2xl font-black text-slate-900">{stats.conversionRate}%</h3>
              </div>
            </div>
            <p className="text-[10px] font-bold text-slate-700 py-1 px-2 bg-white/50 rounded-full inline-block">
              {stats.converted} Converts in Selected Period
            </p>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-church-soft/50 rounded-2xl mb-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 px-2">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-church-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-2xl sm:rounded-[40px] p-10 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => {
                setEditingVisitor(null);
                setNewVisitor(initialVisitorState);
                setShowAddForm(false);
              }} className="absolute top-8 right-8 p-3 bg-church-soft rounded-2xl text-church-gray">
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-2xl font-black mb-6">{editingVisitor ? 'Edit Visitor Record' : 'Register New Visitor'}</h3>
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Visitor Name</label>
                    <input required type="text" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.name} onChange={e => setNewVisitor({...newVisitor, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Phone Number</label>
                    <input required type="text" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.phone} onChange={e => setNewVisitor({...newVisitor, phone: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Tribe</label>
                    <input type="text" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.tribe} onChange={e => setNewVisitor({...newVisitor, tribe: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Email (Optional)</label>
                    <input type="email" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.email} onChange={e => setNewVisitor({...newVisitor, email: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Residence / Location</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="relative">
                      <select 
                        className="w-full px-4 py-2 rounded-lg bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all text-xs font-bold appearance-none"
                        value={newVisitor.residence.division}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '__ADD_NEW__') {
                            setShowAddDivision(true);
                          } else {
                            setNewVisitor({...newVisitor, residence: {...newVisitor.residence, division: value, parish: '', village: ''}});
                          }
                        }}
                      >
                        <option value="">Select Division</option>
                        {kampalaLocations.divisions.map(division => (
                          <option key={division} value={division}>{division}</option>
                        ))}
                        <option value="__ADD_NEW__">+ Add New</option>
                      </select>
                      <div className="absolute right-2 top-1/2 pointer-events-none">
                        <ChevronRight className="w-3 h-3 text-church-blue rotate-90" />
                      </div>
                    </div>
                    <div className="relative">
                      <select 
                        className="w-full px-4 py-2 rounded-lg bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all text-xs font-bold appearance-none disabled:opacity-50"
                        value={newVisitor.residence.parish}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '__ADD_NEW__') {
                            setShowAddParish(true);
                          } else {
                            setNewVisitor({...newVisitor, residence: {...newVisitor.residence, parish: value, village: ''}});
                          }
                        }}
                        disabled={!newVisitor.residence.division}
                      >
                        <option value="">Select Parish</option>
                        {newVisitor.residence.division && kampalaLocations.parishes[newVisitor.residence.division]?.map(parish => (
                          <option key={parish} value={parish}>{parish}</option>
                        ))}
                        {newVisitor.residence.division && <option value="__ADD_NEW__">+ Add New</option>}
                      </select>
                      <div className="absolute right-2 top-1/2 pointer-events-none">
                        <ChevronRight className="w-3 h-3 text-church-blue rotate-90" />
                      </div>
                    </div>
                    <div className="relative">
                      <select 
                        className="w-full px-4 py-2 rounded-lg bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all text-xs font-bold appearance-none disabled:opacity-50"
                        value={newVisitor.residence.village}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '__ADD_NEW__') {
                            setShowAddVillage(true);
                          } else {
                            setNewVisitor({...newVisitor, residence: {...newVisitor.residence, village: value}});
                          }
                        }}
                        disabled={!newVisitor.residence.parish}
                      >
                        <option value="">Select Village</option>
                        {newVisitor.residence.parish && kampalaLocations.villages[newVisitor.residence.parish]?.map(village => (
                          <option key={village} value={village}>{village}</option>
                        ))}
                        {newVisitor.residence.parish && <option value="__ADD_NEW__">+ Add New</option>}
                      </select>
                      <div className="absolute right-2 top-1/2 pointer-events-none">
                        <ChevronRight className="w-3 h-3 text-church-blue rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Date of Visit</label>
                    <input required type="date" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newVisitor.visitationDate} onChange={e => setNewVisitor({...newVisitor, visitationDate: e.target.value})} />
                  </div>
                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Invited By</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" 
                        value={invitedByInput} 
                        onChange={e => handleInvitedByChange(e.target.value)}
                        placeholder="Start typing member name..."
                      />
                      {selectedInvitedByMember && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvitedByMember(null);
                            setInvitedByInput('');
                            setNewVisitor({...newVisitor, invitedBy: ''});
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-church-soft rounded-lg hover:bg-church-blue/10 transition-all"
                        >
                          <X className="w-4 h-4 text-church-gray" />
                        </button>
                      )}
                    </div>
                    {showInvitedBySuggestions && filteredInvitedByMembers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-church-blue/20 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                        {filteredInvitedByMembers.map(member => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => selectInvitedByMember(member)}
                            className="w-full text-left px-4 py-3 hover:bg-church-blue/5 transition-all border-b border-church-soft last:border-b-0"
                          >
                            <div className="font-bold text-sm text-church-black">{member.name}</div>
                            <div className="text-xs text-church-gray">Click to select this member</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showInvitedBySuggestions && filteredInvitedByMembers.length === 0 && invitedByInput.trim() && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-church-blue/20 rounded-xl shadow-lg z-10 p-4">
                        <div className="text-center">
                          <div className="text-sm font-bold text-church-gray mb-2">No existing members found</div>
                          <div className="text-xs text-church-gray">This will be recorded as a new name</div>
                        </div>
                      </div>
                    )}
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

      {/* Add Division Modal */}
      <AnimatePresence>
        {showAddDivision && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-church-black/80 backdrop-blur-md"
          >
            <div className="bg-white rounded-2xl sm:rounded-[48px] p-10 w-full max-w-md shadow-2xl relative">
              <h3 className="text-2xl font-display font-black mb-6">Add New Division</h3>
              <input 
                type="text"
                placeholder="Enter division name..."
                className="w-full px-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-lg font-bold mb-6"
                value={newDivision}
                onChange={(e) => setNewDivision(e.target.value)}
              />
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setShowAddDivision(false);
                    setNewDivision('');
                  }}
                  className="flex-1 bg-church-soft text-church-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-church-blue/5 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (newDivision.trim()) {
                      kampalaLocations.divisions.push(newDivision.trim());
                      kampalaLocations.parishes[newDivision.trim()] = [];
                      setNewVisitor({...newVisitor, residence: {...newVisitor.residence, division: newDivision.trim(), parish: '', village: ''}});
                      setShowAddDivision(false);
                      setNewDivision('');
                    }
                  }}
                  className="flex-1 bg-church-yellow text-church-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-church-yellow/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Add Division
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Parish Modal */}
      <AnimatePresence>
        {showAddParish && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-church-black/80 backdrop-blur-md"
          >
            <div className="bg-white rounded-2xl sm:rounded-[48px] p-10 w-full max-w-md shadow-2xl relative">
              <h3 className="text-2xl font-display font-black mb-6">Add New Parish</h3>
              <input 
                type="text"
                placeholder="Enter parish name..."
                className="w-full px-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-lg font-bold mb-6"
                value={newParish}
                onChange={(e) => setNewParish(e.target.value)}
              />
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setShowAddParish(false);
                    setNewParish('');
                  }}
                  className="flex-1 bg-church-soft text-church-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-church-blue/5 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (newParish.trim() && newVisitor.residence.division) {
                      kampalaLocations.parishes[newVisitor.residence.division].push(newParish.trim());
                      kampalaLocations.villages[newParish.trim()] = [];
                      setNewVisitor({...newVisitor, residence: {...newVisitor.residence, parish: newParish.trim(), village: ''}});
                      setShowAddParish(false);
                      setNewParish('');
                    }
                  }}
                  className="flex-1 bg-church-yellow text-church-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-church-yellow/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Add Parish
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Village Modal */}
      <AnimatePresence>
        {showAddVillage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-church-black/80 backdrop-blur-md"
          >
            <div className="bg-white rounded-2xl sm:rounded-[48px] p-10 w-full max-w-md shadow-2xl relative">
              <h3 className="text-2xl font-display font-black mb-6">Add New Village</h3>
              <input 
                type="text"
                placeholder="Enter village name..."
                className="w-full px-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-lg font-bold mb-6"
                value={newVillage}
                onChange={(e) => setNewVillage(e.target.value)}
              />
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setShowAddVillage(false);
                    setNewVillage('');
                  }}
                  className="flex-1 bg-church-soft text-church-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-church-blue/5 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (newVillage.trim() && newVisitor.residence.parish) {
                      kampalaLocations.villages[newVisitor.residence.parish].push(newVillage.trim());
                      setNewVisitor({...newVisitor, residence: {...newVisitor.residence, village: newVillage.trim()}});
                      setShowAddVillage(false);
                      setNewVillage('');
                    }
                  }}
                  className="flex-1 bg-church-yellow text-church-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-church-yellow/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Add Village
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
