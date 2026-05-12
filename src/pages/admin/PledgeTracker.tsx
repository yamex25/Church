import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Award, 
  Plus, 
  Search, 
  Filter, 
  User, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  TrendingUp,
  X,
  Target,
  Download
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { Pledge } from '@/src/types';
import { cn, formatCurrency, formatDate, downloadExcel } from '@/src/lib/utils';

export default function PledgeTracker() {
  const { user } = useAuth();
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string, targetAmount?: number, status?: string}[]>([]);
  const [projectNameInput, setProjectNameInput] = useState('');
  const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState<{id: string, name: string, targetAmount?: number, status?: string}[]>([]);
  const [showAddProjectForm, setShowAddProjectForm] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ name: '', description: '', targetAmount: 0, startDate: '', endDate: '', status: 'Active' });
  const [members, setMembers] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [memberNameInput, setMemberNameInput] = useState('');
  const [showMemberSuggestions, setShowMemberSuggestions] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', targetAmount: 0, startDate: '', endDate: '' });
  const [filteredMembers, setFilteredMembers] = useState<{id: string, name: string}[]>([]);
  const [selectedMember, setSelectedMember] = useState<{id: string, name: string} | null>(null);
  
  const [newPledge, setNewPledge] = useState({
    memberName: '',
    amount: 0,
    project: 'Sanctuary Project',
    date: new Date().toISOString().split('T')[0],
    status: 'Pending' as 'Pending' | 'Fulfilled'
  });

  useEffect(() => {
    const q = query(collection(db, 'pledges'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Pledge[];
      setPledges(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'pledges');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const qProjects = query(collection(db, 'projects'), orderBy('name', 'asc'));
    const unsubscribeProjects = onSnapshot(qProjects, (snapshot) => {
      const projectDocs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name, 
        targetAmount: doc.data().targetAmount,
        status: doc.data().status || 'Active'
      }));
      setProjects(projectDocs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    return () => unsubscribeProjects();
  }, []);

  const handleProjectNameChange = (value: string) => {
    setProjectNameInput(value);
    
    if (value.trim()) {
      // Filter projects based on input
      const filtered = projects.filter(project => 
        project.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredProjects(filtered);
      setShowProjectSuggestions(true);
      
      // Check if exact match exists
      const exactMatch = projects.find(p => p.name.toLowerCase() === value.toLowerCase().trim());
      if (exactMatch) {
        setNewPledge({...newPledge, project: exactMatch.name});
      } else {
        setNewPledge({...newPledge, project: value.trim()});
      }
    } else {
      setFilteredProjects([]);
      setShowProjectSuggestions(false);
      setNewPledge({...newPledge, project: ''});
    }
  };

  const selectProject = (project: {id: string, name: string, targetAmount?: number, status?: string}) => {
    setNewPledge({...newPledge, project: project.name});
    setProjectNameInput(project.name);
    setShowProjectSuggestions(false);
    setFilteredProjects([]);
  };

  useEffect(() => {
    const unsubscribeProjects = onSnapshot(query(collection(db, 'projects'), orderBy('name', 'asc')), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });
    return () => unsubscribeProjects();
  }, []);

  useEffect(() => {
    const unsubscribeMembers = onSnapshot(query(collection(db, 'members'), orderBy('name', 'asc')), (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });
    return () => unsubscribeMembers();
  }, []);

  const validateMemberName = (name: string) => {
    if (!name.trim()) return { isValid: false, message: 'Member name is required' };
    
    const existingMember = members.find(m => m.name.toLowerCase() === name.toLowerCase().trim());
    if (existingMember) {
      return { isValid: false, message: 'Member already exists in database' };
    }
    
    return { isValid: true, message: 'Valid member name' };
  };

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
        setNewPledge({...newPledge, memberName: exactMatch.name});
      } else {
        setNewPledge({...newPledge, memberName: value.trim()});
      }
    } else {
      setFilteredMembers([]);
      setShowMemberSuggestions(false);
      setNewPledge({...newPledge, memberName: ''});
    }
  };

  const selectMember = (member: {id: string, name: string}) => {
    setSelectedMember(member);
    setMemberNameInput(member.name);
    setNewPledge({...newPledge, memberName: member.name});
    setShowMemberSuggestions(false);
    setFilteredMembers([]);
  };

  const clearMemberSelection = () => {
    setSelectedMember(null);
    setNewPledge({...newPledge, memberName: memberNameInput});
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const validation = validateMemberName(newPledge.memberName);
    if (!validation.isValid) {
      alert(validation.message);
      return;
    }
    
    try {
      await addDoc(collection(db, 'pledges'), {
        ...newPledge,
        recordedBy: user.displayName || user.email || 'Staff',
        createdAt: serverTimestamp()
      });
      setShowAddForm(false);
      setNewPledge({
        memberName: '',
        amount: 0,
        project: 'Sanctuary Project',
        date: new Date().toISOString().split('T')[0],
        status: 'Pending'
      });
      setMemberNameInput('');
      setShowMemberSuggestions(false);
      alert("Spiritual pledge recorded successfully.");
    } catch (error) {
      console.error("Pledge Creation Error:", error);
      handleFirestoreError(error, OperationType.CREATE, 'pledges');
    }
  };

  const toggleStatus = async (id: string, current: string) => {
    try {
      const docRef = doc(db, 'pledges', id);
      await updateDoc(docRef, {
        status: current === 'Pending' ? 'Fulfilled' : 'Pending',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'pledges');
    }
  };

  const handleExport = () => {
    downloadExcel(pledges, `graceflow_pledges_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filtered = pledges.filter(p => 
    p.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.project.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPledged = pledges.reduce((acc, curr) => acc + curr.amount, 0);
  const totalFulfilled = pledges.filter(p => p.status === 'Fulfilled').reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-display font-black tracking-tight text-church-black">Pledge Tracker</h2>
          <p className="text-church-gray font-medium">Tracking faith-based commitments to church projects.</p>
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
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-3 bg-church-blue text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-church-blue/20"
          >
            <Plus className="w-4 h-4" />
            Record Pledge
          </button>
          <button 
            onClick={() => setShowProjectForm(true)}
            className="flex items-center gap-3 bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-emerald-500/20"
          >
            <Target className="w-4 h-4" />
            Manage Projects
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[32px] border border-church-blue/5 shadow-xl shadow-church-blue/5">
           <div className="flex items-center justify-between mb-4">
             <Target className="w-6 h-6 text-church-blue" />
             <span className="text-[10px] font-black uppercase tracking-widest text-church-gray">Global Goal</span>
           </div>
           <h3 className="text-3xl font-black mb-1">{formatCurrency(totalPledged)}</h3>
           <p className="text-xs text-church-gray font-bold uppercase tracking-wider">Total Pledged</p>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-church-blue/5 shadow-xl shadow-church-blue/5">
           <div className="flex items-center justify-between mb-4">
             <CheckCircle className="w-6 h-6 text-emerald-500" />
             <span className="text-[10px] font-black uppercase tracking-widest text-church-gray">Success Rate</span>
           </div>
           <h3 className="text-3xl font-black mb-1">{formatCurrency(totalFulfilled)}</h3>
           <p className="text-xs text-church-gray font-bold uppercase tracking-wider">Total Fulfilled</p>
        </div>
        <div className="bg-slate-900 p-8 rounded-[32px] text-white shadow-2xl relative overflow-hidden group">
           <div className="relative z-10">
             <TrendingUp className="w-6 h-6 text-blue-400 mb-4" />
             <h3 className="text-2xl font-black mb-1">
               {totalPledged > 0 ? Math.round((totalFulfilled / totalPledged) * 100) : 0}%
             </h3>
             <p className="text-blue-300 text-[10px] font-black uppercase tracking-[0.2em]">Completion Progress</p>
           </div>
           <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
              <Award className="w-32 h-32" />
           </div>
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-church-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-[40px] p-10 w-full max-w-xl shadow-2xl relative">
              <button onClick={() => setShowAddForm(false)} className="absolute top-8 right-8 p-3 bg-church-soft rounded-2xl text-church-gray">
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-2xl font-black mb-6">New Faith Pledge</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Member Name</label>
                  <div className="relative">
                    <input 
                      required 
                      type="text" 
                      className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" 
                      value={memberNameInput} 
                      onChange={e => handleMemberNameChange(e.target.value)}
                      onFocus={() => {
                        if (memberNameInput.trim()) {
                          const filtered = members.filter(member => 
                            member.name.toLowerCase().includes(memberNameInput.toLowerCase())
                          );
                          setFilteredMembers(filtered);
                          setShowMemberSuggestions(true);
                        }
                      }}
                      placeholder="Start typing member name..."
                    />
                    {selectedMember && (
                      <button
                        type="button"
                        onClick={clearMemberSelection}
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
                        <div className="text-xs text-church-gray">This will be registered as a new member</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Amount (UGX)</label>
                    <input required type="number" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newPledge.amount || ''} onChange={e => setNewPledge({...newPledge, amount: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Project</label>
                    <div className="relative">
                      <select 
                        required 
                        className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 focus:bg-white transition-all font-bold text-sm" 
                        value={newPledge.project} 
                        onChange={e => {
                          const value = e.target.value;
                          if (value === '__ADD_NEW__') {
                            setShowProjectForm(true);
                          setNewPledge({...newPledge, project: ''});
                          setNewProjectData({ name: '', description: '', targetAmount: 0, startDate: '', endDate: '', status: 'Active' });
                          setProjectNameInput('');
                          setShowProjectSuggestions(false);
                          setFilteredProjects([]);
                          e.target.value = '';
                        } else {
                          setNewPledge({...newPledge, project: value});
                        }
                        }}
                      >
                        <option value="">Select Project...</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                        {projects.length === 0 && <option value="Sanctuary Project">Sanctuary Project</option>}
                        <option value="__ADD_NEW__">+ Add New Project</option>
                      </select>
                      {selectedProject && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewPledge({...newPledge, project: ''});
                            setProjectNameInput('');
                            setShowProjectSuggestions(false);
                            setFilteredProjects([]);
                            setSelectedProject(null);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-church-soft rounded-lg hover:bg-church-blue/10 transition-all"
                        >
                          <X className="w-4 h-4 text-church-gray" />
                        </button>
                      )}
                    </div>
                    {showProjectSuggestions && filteredProjects.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-church-blue/20 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                        {filteredProjects.map(project => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => selectProject(project)}
                            className="w-full text-left px-4 py-3 hover:bg-church-blue/5 transition-all border-b border-church-soft last:border-b-0"
                          >
                            <div className="font-bold text-sm text-church-black">{project.name}</div>
                            <div className="text-xs text-church-gray">
                              {project.targetAmount && `Target: UGX ${project.targetAmount?.toLocaleString()}`}
                              {project.status && `Status: ${project.status}`}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showProjectSuggestions && filteredProjects.length === 0 && projectNameInput.trim() && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-church-blue/20 rounded-xl shadow-lg z-10 p-4">
                        <div className="text-center">
                          <div className="text-sm font-bold text-church-gray mb-2">No existing projects found</div>
                          <div className="text-xs text-church-gray">This will create a new project</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-church-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-church-blue/20 hover:scale-105 transition-all">Record Commitment</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Project Modal */}
      <AnimatePresence>
        {showProjectForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-church-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-[40px] p-10 w-full max-w-xl shadow-2xl relative">
              <button onClick={() => setShowProjectForm(false)} className="absolute top-8 right-8 p-3 bg-church-soft rounded-2xl text-church-gray">
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-2xl font-black mb-6">Add New Project</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!user) return;
                
                if (!newProject.name.trim()) {
                  alert('Project name is required');
                  return;
                }
                
                try {
                  console.log("Creating project with data:", newProject);
                  const projectData = {
                    name: newProject.name.trim(),
                    description: newProject.description.trim(),
                    targetAmount: newProject.targetAmount || 0,
                    startDate: newProject.startDate || null,
                    endDate: newProject.endDate || null,
                    status: 'Active',
                    createdBy: user.displayName || user.email || 'Staff',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                  };
                  
                  const docRef = await addDoc(collection(db, 'projects'), projectData);
                  console.log("Project created with ID:", docRef.id);
                  
                  setShowProjectForm(false);
                  setNewProject({ name: '', description: '', targetAmount: 0, startDate: '', endDate: '' });
                  alert(`Project "${newProject.name.trim()}" created successfully!`);
                } catch (error) {
                  console.error("Project Creation Error:", error);
                  alert(`Error creating project: ${error.message || 'Unknown error'}`);
                  handleFirestoreError(error, OperationType.CREATE, 'projects');
                }
              }} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Project Name *</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" 
                    value={newProject.name} 
                    onChange={e => setNewProject({...newProject, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Description</label>
                  <textarea 
                    rows={3}
                    className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" 
                    value={newProject.description} 
                    onChange={e => setNewProject({...newProject, description: e.target.value})}
                    placeholder="Enter project description..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Target Amount (UGX)</label>
                    <input 
                      type="number" 
                      className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" 
                      value={newProject.targetAmount} 
                      onChange={e => setNewProject({...newProject, targetAmount: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Start Date</label>
                    <input 
                      type="date" 
                      className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" 
                      value={newProject.startDate} 
                      onChange={e => setNewProject({...newProject, startDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">End Date</label>
                    <input 
                      type="date" 
                      className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" 
                      value={newProject.endDate} 
                      onChange={e => setNewProject({...newProject, endDate: e.target.value})}
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-church-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-church-blue/20 hover:scale-105 transition-all">Create Project</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white p-6 rounded-[32px] border border-church-blue/5 shadow-xl shadow-church-blue/5 flex items-center gap-4">
        <Search className="w-5 h-5 text-church-blue ml-4" />
        <input type="text" placeholder="Search pledges by name or project..." className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <button 
          onClick={() => setShowProjectForm(true)}
          className="flex items-center gap-3 bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-emerald-500/20"
        >
          <Target className="w-4 h-4" />
          Manage Projects
        </button>
      </div>

      <div className="grid gap-6">
        {filtered.map((pledge) => (
          <div key={pledge.id} className="bg-white rounded-[32px] p-8 border border-church-blue/10 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6 group">
            <div className="flex items-center gap-6">
               <div className="w-16 h-16 rounded-2xl bg-church-soft flex items-center justify-center text-church-blue group-hover:bg-church-blue group-hover:text-white transition-all">
                  <User className="w-8 h-8" />
               </div>
               <div>
                  <h4 className="text-xl font-black text-church-black mb-1">{pledge.memberName}</h4>
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-church-gray">
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3"/> {pledge.project}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {formatDate(pledge.date)}</span>
                  </div>
               </div>
            </div>
            <div className="flex items-center gap-8">
               <div className="text-right">
                  <span className="block text-2xl font-black text-church-black">{formatCurrency(pledge.amount)}</span>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-[0.2em]",
                    pledge.status === 'Fulfilled' ? "text-emerald-500" : "text-church-yellow"
                  )}>
                    {pledge.status}
                  </span>
               </div>
               <button 
                 onClick={() => toggleStatus(pledge.id!, pledge.status)}
                 className={cn(
                  "p-4 rounded-2xl transition-all hover:scale-110 active:scale-95 shadow-lg",
                  pledge.status === 'Fulfilled' ? "bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white" : "bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white"
                 )}
               >
                 {pledge.status === 'Fulfilled' ? <X className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
