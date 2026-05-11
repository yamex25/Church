import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Mail, 
  Phone, 
  ChevronLeft, 
  ChevronRight,
  UserPlus,
  X,
  Edit2
} from 'lucide-react';
import { cn, formatDate, calculateAge, downloadExcel } from '@/src/lib/utils';
import { MembershipStatus, Member } from '@/src/types';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, deleteDoc, doc } from 'firebase/firestore';

export default function MemberList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMinistry, setFilterMinistry] = useState('All');
  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  
  // Member form state
  const initialMemberState = {
    name: '',
    email: '',
    phone: '',
    membershipStatus: MembershipStatus.ACTIVE,
    category: 'General',
    sex: 'Male' as 'Male' | 'Female',
    maritalStatus: 'Single' as 'Single' | 'Married' | 'Widowed' | 'Divorced',
    dateOfBirth: '',
    tribe: '',
    residence: {
      division: '',
      parish: '',
      village: ''
    }
  };

  const [newMember, setNewMember] = useState(initialMemberState);

  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Member[];
      setMembers(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const qDepts = query(collection(db, 'departments'), orderBy('name', 'asc'));
    const unsubscribeDepts = onSnapshot(qDepts, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setDepartments(docs);
    }, (error) => {
      console.error("Error fetching departments:", error);
    });

    return () => unsubscribeDepts();
  }, []);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();

    // Duplicate check
    if (!editingMember && members.some(m => m.phone === newMember.phone)) {
      alert("A member with this phone number is already registered.");
      return;
    }

    try {
      if (editingMember) {
        const docRef = doc(db, 'members', editingMember.id);
        await updateDoc(docRef, {
          ...newMember,
          updatedAt: serverTimestamp(),
          categories: [newMember.category]
        });
        alert("Member stewardship record updated.");
      } else {
        await addDoc(collection(db, 'members'), {
          ...newMember,
          createdAt: serverTimestamp(),
          joinedAt: serverTimestamp(),
          categories: [newMember.category]
        });
        alert("New member registered successfully in GraceFlow.");
      }
      setShowAddForm(false);
      setEditingMember(null);
      setNewMember(initialMemberState);
    } catch (error) {
      handleFirestoreError(error, editingMember ? OperationType.UPDATE : OperationType.CREATE, 'members');
    }
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setNewMember({
      name: member.name,
      email: member.email,
      phone: member.phone,
      membershipStatus: member.membershipStatus,
      category: member.categories[0] || 'General',
      sex: member.sex || 'Male',
      maritalStatus: member.maritalStatus || 'Single',
      dateOfBirth: member.dateOfBirth,
      tribe: member.tribe || '',
      residence: member.residence || { division: '', parish: '', village: '' }
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to archive this member record? This action is tracked.")) return;
    try {
      await deleteDoc(doc(db, 'members', id));
      alert("Member record archived.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'members');
    }
  };

  const handleExport = () => {
    downloadExcel(members, `graceflow_members_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8 text-church-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-display font-black text-church-black mb-2 tracking-tight">Member Registry</h2>
          <p className="text-church-gray font-medium">Detailed congregation records and community data.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-3 bg-church-blue text-white px-10 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-church-blue/20 self-start md:self-center active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-church-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[48px] p-10 w-full max-w-2xl shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8">
                <button onClick={() => setShowAddForm(false)} className="p-3 bg-church-soft rounded-2xl text-church-gray hover:text-church-blue transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

                <div className="mb-10 text-center">
                  <div className="bg-church-soft w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center">
                    <UserPlus className="text-church-blue w-10 h-10" />
                  </div>
                  <h3 className="text-3xl font-display font-black tracking-tight text-church-black">
                    {editingMember ? 'Edit Stewardship Record' : 'New Member Onboarding'}
                  </h3>
                  <p className="text-sm font-medium text-church-gray mt-2">
                    {editingMember ? `Updating record for ${editingMember.name}` : 'Initialize spiritual stewardship records.'}
                  </p>
                </div>

              <form onSubmit={handleCreateMember} className="space-y-6 max-h-[60vh] overflow-y-auto px-4 custom-scrollbar">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Full Legal Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-sm font-bold"
                      value={newMember.name}
                      onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Email Identity</label>
                    <input 
                      required
                      type="email" 
                      className="w-full px-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-sm font-bold"
                      value={newMember.email}
                      onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Contact Number</label>
                    <input 
                      required
                      type="tel" 
                      className="w-full px-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-sm font-bold"
                      value={newMember.phone}
                      onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Tribe / Ancestry</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Muganda, Musoga..."
                      className="w-full px-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-sm font-bold"
                      value={newMember.tribe}
                      onChange={(e) => setNewMember({...newMember, tribe: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Date of Birth</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-sm font-bold"
                      value={newMember.dateOfBirth}
                      onChange={(e) => setNewMember({...newMember, dateOfBirth: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Sex</label>
                    <select 
                      className="w-full px-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-sm font-bold"
                      value={newMember.sex}
                      onChange={(e) => setNewMember({...newMember, sex: e.target.value as any})}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Marital Status</label>
                    <select 
                      className="w-full px-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-sm font-bold"
                      value={newMember.maritalStatus}
                      onChange={(e) => setNewMember({...newMember, maritalStatus: e.target.value as any})}
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Ministry Assignment</label>
                    <select 
                      className="w-full px-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-sm font-bold appearance-none cursor-pointer"
                      value={newMember.category}
                      onChange={(e) => setNewMember({...newMember, category: e.target.value})}
                    >
                      <option value="General">General</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Membership Status</label>
                    <select 
                      className="w-full px-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-sm font-bold appearance-none cursor-pointer"
                      value={newMember.membershipStatus}
                      onChange={(e) => setNewMember({...newMember, membershipStatus: e.target.value as MembershipStatus})}
                    >
                      {Object.values(MembershipStatus).map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-church-soft">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-church-blue px-2">Area of Residence</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-church-gray ml-2">Division</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-xs font-bold"
                        value={newMember.residence.division}
                        onChange={(e) => setNewMember({...newMember, residence: {...newMember.residence, division: e.target.value}})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-church-gray ml-2">Parish</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-xs font-bold"
                        value={newMember.residence.parish}
                        onChange={(e) => setNewMember({...newMember, residence: {...newMember.residence, parish: e.target.value}})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-church-gray ml-2">Village</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-xs font-bold"
                        value={newMember.residence.village}
                        onChange={(e) => setNewMember({...newMember, residence: {...newMember.residence, village: e.target.value}})}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button 
                    type="submit"
                    className="w-full py-5 bg-church-blue text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-church-blue/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Authorize Registration
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-[40px] border border-church-blue/5 shadow-xl shadow-church-blue/5 flex flex-col md:flex-row gap-5 items-center">
        <div className="relative flex-1 w-full font-sans">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-church-blue w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search registry..."
            className="w-full pl-12 pr-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:outline-none focus:border-church-blue/20 focus:bg-white text-sm placeholder:text-church-gray transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            value={filterMinistry}
            onChange={(e) => setFilterMinistry(e.target.value)}
            className="px-6 py-4 border-2 border-church-blue/10 rounded-2xl text-church-gray bg-white transition-all text-xs font-bold uppercase tracking-widest w-full md:w-auto cursor-pointer focus:outline-none focus:border-church-blue/20"
          >
            <option value="All">All Ministries</option>
            <option value="General">General</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.name}>{dept.name}</option>
            ))}
          </select>
          <button 
            onClick={handleExport}
            className="flex items-center gap-3 px-8 py-4 border-2 border-church-blue/10 rounded-2xl text-church-gray hover:bg-church-soft transition-all text-xs font-bold uppercase tracking-widest w-full md:w-auto justify-center"
          >
            Export
          </button>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-[48px] border border-church-blue/5 shadow-2xl shadow-church-blue/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans">
            <thead>
              <tr className="bg-church-blue text-white text-[10px] uppercase tracking-[0.25em] font-black border-b border-white/10 text-center">
                <th className="px-6 py-6 text-left">Member</th>
                <th className="px-6 py-6">Age</th>
                <th className="px-6 py-6">Tribe</th>
                <th className="px-6 py-6">Sex</th>
                <th className="px-6 py-6">Marital</th>
                <th className="px-6 py-6">Village</th>
                <th className="px-6 py-6">Ministry</th>
                <th className="px-6 py-6">Status</th>
                <th className="px-6 py-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-church-soft">
              {members.filter(m => {
                const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  m.tribe?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  m.residence?.village?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  m.residence?.division?.toLowerCase().includes(searchTerm.toLowerCase());
                
                const matchesFilter = filterMinistry === 'All' || m.categories.includes(filterMinistry);
                
                return matchesSearch && matchesFilter;
              }).map((member) => (
                <tr key={member.id} className="hover:bg-church-blue/[0.02] transition-colors group text-center">
                  <td className="px-6 py-6 text-left">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-church-yellow border-2 border-church-yellow-dark/20 flex items-center justify-center text-church-black font-black text-[10px] shadow-sm shrink-0">
                        {member.name.split(' ').map(n => n[0]).join('').substring(0,2)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-church-black truncate">{member.name}</span>
                        <span className="text-[10px] text-church-gray font-medium truncate">{member.phone}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-sm font-bold text-church-black">
                    {calculateAge(member.dateOfBirth)}
                  </td>
                  <td className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-church-gray">
                    {member.tribe || 'N/A'}
                  </td>
                  <td className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-church-gray">
                    {member.sex || 'N/A'}
                  </td>
                  <td className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-church-gray">
                    {member.maritalStatus || 'N/A'}
                  </td>
                  <td className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-church-gray">
                    {member.residence?.village || 'N/A'}
                  </td>
                  <td className="px-6 py-6">
                    <span className="text-[10px] font-black uppercase tracking-widest text-church-blue bg-church-blue/5 px-3 py-1.5 rounded-lg border border-church-blue/10 shrink-0">{member.categories[0]}</span>
                  </td>
                  <td className="px-6 py-6">
                    <span className={cn(
                      "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm shrink-0",
                      member.membershipStatus === MembershipStatus.ACTIVE ? "bg-church-blue text-white border-church-blue" : 
                      member.membershipStatus === MembershipStatus.LEFT ? "bg-amber-100 text-amber-700 border-amber-200" : 
                      member.membershipStatus === MembershipStatus.DIED ? "bg-slate-100 text-slate-700 border-slate-200" : 
                      "bg-white text-church-gray border-church-blue/10"
                    )}>
                      {member.membershipStatus}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-right">
                    <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(member)}
                          className="p-2 text-church-blue hover:bg-church-blue/10 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                       <button 
                         onClick={() => handleDelete(member.id)}
                         className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                       >
                         <X className="w-4 h-4" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-10 py-8 border-t border-church-soft flex items-center justify-between bg-church-soft/30">
          <span className="text-xs font-bold uppercase tracking-widest text-church-gray opacity-60">Listing {members.length} of 1,280 entries</span>
          <div className="flex items-center gap-4">
            <button className="p-4 border-2 border-church-blue/10 rounded-2xl text-church-gray hover:bg-white transition-all disabled:opacity-30 shadow-sm" disabled>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button className="p-4 border-2 border-church-blue/10 rounded-2xl text-church-black font-black hover:bg-church-blue hover:text-white transition-all shadow-sm active:scale-95">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
