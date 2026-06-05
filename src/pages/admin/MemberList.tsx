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
import { MembershipStatus, Member, Zone, Cell } from '@/src/types';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';

// Kampala location data structure
const kampalaLocations: {
  divisions: string[];
  parishes: { [key: string]: string[] };
  villages: { [key: string]: string[] };
} = {
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


export default function MemberList() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMinistry, setFilterMinistry] = useState('All');
  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showAddDivision, setShowAddDivision] = useState(false);
  const [showAddParish, setShowAddParish] = useState(false);
  const [showAddVillage, setShowAddVillage] = useState(false);
  const [newDivision, setNewDivision] = useState('');
  const [newParish, setNewParish] = useState('');
  const [newVillage, setNewVillage] = useState('');
  const [memberNameInput, setMemberNameInput] = useState('');
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateMembers, setDuplicateMembers] = useState<Member[]>([]);
  
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
    zone: '',
    zoneName: '',
    cell: '',
    cellName: '',
    isLeader: false,
    leaderType: '' as '' | 'Cell' | 'Zone',
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

  useEffect(() => {
    const qZones = query(collection(db, 'zones'), orderBy('name', 'asc'));
    const unsubscribeZones = onSnapshot(qZones, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Zone[];
      setZones(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'zones');
    });

    return () => unsubscribeZones();
  }, []);

  useEffect(() => {
    const qCells = query(collection(db, 'cells'), orderBy('name', 'asc'));
    const unsubscribeCells = onSnapshot(qCells, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Cell[];
      setCells(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cells');
    });

    return () => unsubscribeCells();
  }, []);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMember.name.trim() || !newMember.email.trim() || !newMember.phone.trim() || !newMember.dateOfBirth) {
      alert("Please fill in all required fields.");
      return;
    }

    // Duplicate check
    if (!editingMember && members.some(m => m.phone === newMember.phone)) {
      alert("A member with this phone number is already registered.");
      return;
    }

    try {
      if (editingMember) {
        await updateDoc(doc(db, 'members', editingMember.id), {
          ...newMember,
          updatedAt: serverTimestamp(),
          updatedBy: user?.displayName || user?.email || 'Admin'
        });
        setEditingMember(null);
        alert("Member updated successfully!");
      } else {
        // Create new member
        await addDoc(collection(db, 'members'), {
          ...newMember,
          createdAt: serverTimestamp(),
          joinedAt: serverTimestamp(),
          categories: [newMember.category]
        });
        alert("New member registered successfully in GraceFlow.");
      }
      
      setShowAddForm(false);
      setNewMember(initialMemberState);
      setMemberNameInput('');
      setShowDuplicateWarning(false);
      setDuplicateMembers([]);
    } catch (error) {
      handleFirestoreError(error, editingMember ? OperationType.UPDATE : OperationType.CREATE, 'members');
    }
  };

  const handleMemberNameChange = (value: string) => {
    setMemberNameInput(value);
    setNewMember({...newMember, name: value});
    
    if (value.trim()) {
      // Check for potential duplicates
      const duplicates = members.filter(member => 
        member.name.toLowerCase().includes(value.toLowerCase()) ||
        value.toLowerCase().includes(member.name.toLowerCase())
      );
      setDuplicateMembers(duplicates);
      setShowDuplicateWarning(duplicates.length > 0);
    } else {
      setDuplicateMembers([]);
      setShowDuplicateWarning(false);
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
      zone: member.zone || '',
      zoneName: member.zoneName || '',
      cell: member.cell || '',
      cellName: member.cellName || '',
      isLeader: member.isLeader || false,
      leaderType: member.leaderType || '',
      residence: member.residence || { division: '', parish: '', village: '' }
    });
    setMemberNameInput(member.name);
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
    const exportData = members.map((member, index) => ({
      ID: index + 1,
      Tribe: member.tribe || '',
      Residence: `${member.residence?.division || ''} ${member.residence?.parish || ''} ${member.residence?.village || ''}`.trim(),
      Categories: member.categories?.join(', ') || '',
      Phone: member.phone || ''
    }));
    downloadExcel(exportData, `graceflow_members_${new Date().toISOString().split('T')[0]}.xlsx`);
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-church-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl sm:rounded-[48px] p-10 w-full max-w-2xl shadow-2xl relative overflow-hidden"
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
                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Full Legal Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-sm font-bold"
                      value={memberNameInput}
                      onChange={(e) => handleMemberNameChange(e.target.value)}
                      placeholder="Start typing member name..."
                    />
                    {showDuplicateWarning && duplicateMembers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-red-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                        <div className="p-3 bg-red-50 border-b border-red-200">
                          <div className="text-xs font-bold text-red-600">⚠️ Potential duplicates found</div>
                          <div className="text-xs text-red-500 mt-1">These members already exist in the database</div>
                        </div>
                        {duplicateMembers.map(member => (
                          <div key={member.id} className="px-4 py-3 border-b border-church-soft last:border-b-0">
                            <div className="font-bold text-sm text-church-black">{member.name}</div>
                            <div className="text-xs text-church-gray">
                              {member.email && `Email: ${member.email}`}
                              {member.phone && ` • Phone: ${member.phone}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                      placeholder="Enter tribe..."
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
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-church-blue px-2">Zone & Cell Assignment</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-church-gray ml-2">Zone</label>
                      <select 
                        className="w-full px-4 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-xs font-bold"
                        value={newMember.zone}
                        onChange={(e) => {
                          const selectedZoneId = e.target.value;
                          const selectedZone = zones.find(z => z.id === selectedZoneId);
                          setNewMember({
                            ...newMember,
                            zone: selectedZoneId,
                            zoneName: selectedZone?.name || '',
                            cell: '',
                            cellName: ''
                          });
                        }}
                      >
                        <option value="">Select Zone (Optional)</option>
                        {zones.map(zone => (
                          <option key={zone.id} value={zone.id}>{zone.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-church-gray ml-2">Cell</label>
                      <select 
                        className="w-full px-4 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-xs font-bold"
                        value={newMember.cell}
                        onChange={(e) => {
                          const selectedCellId = e.target.value;
                          const selectedCell = cells.find(c => c.id === selectedCellId);
                          setNewMember({
                            ...newMember,
                            cell: selectedCellId,
                            cellName: selectedCell?.name || ''
                          });
                        }}
                        disabled={!newMember.zone}
                      >
                        <option value="">Select Cell (Optional)</option>
                        {newMember.zone && cells
                          .filter(c => c.zoneId === newMember.zone)
                          .map(cell => (
                            <option key={cell.id} value={cell.id}>{cell.name}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-church-soft">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-church-blue px-2">Leadership Role</h4>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newMember.isLeader}
                        onChange={(e) => setNewMember({
                          ...newMember,
                          isLeader: e.target.checked,
                          leaderType: e.target.checked ? newMember.leaderType : ''
                        })}
                        className="w-4 h-4 accent-church-blue rounded"
                      />
                      <span className="text-xs font-bold text-church-gray">This member is a leader</span>
                    </label>
                    {newMember.isLeader && (
                      <select
                        value={newMember.leaderType}
                        onChange={(e) => setNewMember({
                          ...newMember,
                          leaderType: e.target.value as 'Cell' | 'Zone'
                        })}
                        className="px-4 py-2 rounded-lg bg-church-soft border-2 border-transparent focus:border-church-blue/20 text-xs font-bold"
                      >
                        <option value="">Select Leader Type</option>
                        <option value="Cell">Cell Leader</option>
                        <option value="Zone">Zonal Leader</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-church-soft">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-church-blue px-2">Area of Residence</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-church-gray ml-2">Division</label>
                      <select 
                        className="w-full px-4 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-xs font-bold"
                        value={newMember.residence.division}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '__ADD_NEW__') {
                            setShowAddDivision(true);
                          } else {
                            setNewMember({
                              ...newMember, 
                              residence: {
                                ...newMember.residence,
                                division: value,
                                parish: '',
                                village: ''
                              }
                            });
                          }
                        }}
                      >
                        <option value="">Select Division</option>
                        {kampalaLocations.divisions.map(division => (
                          <option key={division} value={division}>{division}</option>
                        ))}
                        <option value="__ADD_NEW__">+ Add New</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-church-gray ml-2">Parish</label>
                      <select 
                        className="w-full px-4 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-xs font-bold"
                        value={newMember.residence.parish}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '__ADD_NEW__') {
                            setShowAddParish(true);
                          } else {
                            setNewMember({
                              ...newMember, 
                              residence: {
                                ...newMember.residence,
                                parish: value,
                                village: ''
                              }
                            });
                          }
                        }}
                        disabled={!newMember.residence.division}
                      >
                        <option value="">Select Parish</option>
                        {newMember.residence.division && kampalaLocations.parishes[newMember.residence.division]?.map(parish => (
                          <option key={parish} value={parish}>{parish}</option>
                        ))}
                        {newMember.residence.division && <option value="__ADD_NEW__">+ Add New</option>}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-church-gray ml-2">Village</label>
                      <select 
                        className="w-full px-4 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all text-xs font-bold"
                        value={newMember.residence.village}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '__ADD_NEW__') {
                            setShowAddVillage(true);
                          } else {
                            setNewMember({
                              ...newMember, 
                              residence: {
                                ...newMember.residence,
                                village: value
                              }
                            });
                          }
                        }}
                        disabled={!newMember.residence.parish}
                      >
                        <option value="">Select Village</option>
                        {newMember.residence.parish && kampalaLocations.villages[newMember.residence.parish]?.map(village => (
                          <option key={village} value={village}>{village}</option>
                        ))}
                        {newMember.residence.parish && <option value="__ADD_NEW__">+ Add New</option>}
                      </select>
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
      <div className="bg-white p-6 rounded-2xl sm:rounded-[40px] border border-church-blue/5 shadow-xl shadow-church-blue/5 flex flex-col md:flex-row gap-5 items-center">
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
            className="px-6 py-4 border-2 border-church-blue/10 rounded-2xl text-church-gray bg-white transition-all text-xs font-bold w-full md:w-auto cursor-pointer focus:outline-none focus:border-church-blue/20"
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
      <div className="bg-white rounded-2xl sm:rounded-[48px] border border-church-blue/5 shadow-2xl shadow-church-blue/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans min-w-[700px]">
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
                const matchesSearch = (m.name && m.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                  (m.tribe && m.tribe.toLowerCase().includes(searchTerm.toLowerCase())) ||
                  (m.residence?.village && m.residence.village.toLowerCase().includes(searchTerm.toLowerCase())) ||
                  (m.residence?.division && m.residence.division.toLowerCase().includes(searchTerm.toLowerCase())) ||
                  (m.categories && m.categories.some(cat => cat.toLowerCase().includes(searchTerm.toLowerCase())));
                
                const matchesFilter = filterMinistry === 'All' || (m.categories && m.categories.includes(filterMinistry));
                
                return matchesSearch && matchesFilter;
              }).map((member) => {
                try {
                  return (
                    <tr key={member.id} className="hover:bg-church-blue/[0.02] transition-colors group text-center">
                      <td className="px-6 py-6 text-left">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-church-yellow border-2 border-church-yellow-dark/20 flex items-center justify-center text-church-black font-black text-[10px] shadow-sm shrink-0">
                            {(member.name || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-sm text-church-black truncate">{member.name || 'Unknown'}</span>
                            <span className="text-[10px] text-church-gray font-medium truncate">{member.phone || 'N/A'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-sm font-bold text-church-black">
                        {member.dateOfBirth ? calculateAge(member.dateOfBirth) : 'N/A'}
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
                        <span className="text-[10px] font-black uppercase tracking-widest text-church-blue bg-church-blue/5 px-3 py-1.5 rounded-lg border border-church-blue/10 shrink-0">{member.categories?.[0] || 'General'}</span>
                      </td>
                      <td className="px-6 py-6">
                        <span className={cn(
                          "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm shrink-0",
                          member.membershipStatus === MembershipStatus.ACTIVE ? "bg-church-blue text-white border-church-blue" : 
                          member.membershipStatus === MembershipStatus.LEFT ? "bg-amber-100 text-amber-700 border-amber-200" : 
                          member.membershipStatus === MembershipStatus.DIED ? "bg-slate-100 text-slate-700 border-slate-200" : 
                          "bg-white text-church-gray border-church-blue/10"
                        )}>
                          {member.membershipStatus || 'Unknown'}
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
                            onClick={() => handleDelete(member.id!)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                } catch (err) {
                  console.error('Error rendering member:', member, err);
                  return null;
                }
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 border-t border-church-soft flex items-center justify-between bg-church-soft/30">
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
                      setNewMember({...newMember, residence: {...newMember.residence, division: newDivision.trim(), parish: '', village: ''}});
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
                    if (newParish.trim() && newMember.residence.division) {
                      kampalaLocations.parishes[newMember.residence.division].push(newParish.trim());
                      kampalaLocations.villages[newParish.trim()] = [];
                      setNewMember({...newMember, residence: {...newMember.residence, parish: newParish.trim(), village: ''}});
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
                    if (newVillage.trim() && newMember.residence.parish) {
                      kampalaLocations.villages[newMember.residence.parish].push(newVillage.trim());
                      setNewMember({...newMember, residence: {...newMember.residence, village: newVillage.trim()}});
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
