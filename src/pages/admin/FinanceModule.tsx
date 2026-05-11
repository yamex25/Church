import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DollarSign, 
  TrendingUp, 
  Download, 
  Plus, 
  Search,
  Filter,
  ArrowUpRight,
  PieChart as PieIcon,
  X,
  CalendarDays,
  ArrowRightLeft
} from 'lucide-react';
import { ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Tooltip } from 'recharts';
import { formatCurrency, formatDate, downloadExcel, cn } from '@/src/lib/utils';
import { TransactionType, FinanceRecord } from '@/src/types';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';

export default function FinanceModule() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [services, setServices] = useState<{id: string, name: string}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null);
  
  const initialRecordState = {
    memberName: '',
    type: TransactionType.TITHE,
    amount: 0,
    category: 'Main',
    description: '',
    serviceName: 'Sunday Morning Service',
    date: new Date().toISOString().split('T')[0]
  };

  const [newRecord, setNewRecord] = useState(initialRecordState);

  useEffect(() => {
    const q = query(collection(db, 'finance'), orderBy('date', 'desc'));
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
  }, []);

  useEffect(() => {
    // Fetch Services
    const unsubscribeServices = onSnapshot(query(collection(db, 'services'), orderBy('name', 'asc')), (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });

    // Fetch Projects
    const unsubscribeProjects = onSnapshot(query(collection(db, 'projects'), orderBy('name', 'asc')), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });

    return () => {
      unsubscribeServices();
      unsubscribeProjects();
    };
  }, []);

  const handleInitializeFinanceData = async () => {
    const defaultServices = ['Sunday Morning Service', 'Midweek Service', 'Youth Impact', 'Overnight Prayer', 'Special Program'];
    const defaultProjects = ['Main', 'Building Project', 'Youth Center', 'Sanctuary Sound', 'Evangelism Outreaches'];

    try {
      for (const s of defaultServices) {
        if (!services.some(sv => sv.name === s)) {
          await addDoc(collection(db, 'services'), { name: s, createdAt: serverTimestamp() });
        }
      }
      for (const p of defaultProjects) {
        if (!projects.some(pj => pj.name === p)) {
          await addDoc(collection(db, 'projects'), { name: p, createdAt: serverTimestamp() });
        }
      }
      alert("Financial categories initialized.");
    } catch (error) {
      console.error("Initialization error:", error);
    }
  };

  const [showReports, setShowReports] = useState(false);

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingRecord) {
        const docRef = doc(db, 'finance', editingRecord.id!);
        await updateDoc(docRef, {
          ...newRecord,
          amount: Number(newRecord.amount),
          date: new Date(newRecord.date).toISOString(),
          updatedAt: serverTimestamp()
        });
        alert("Financial record updated successfully.");
      } else {
        await addDoc(collection(db, 'finance'), {
          ...newRecord,
          amount: Number(newRecord.amount),
          date: new Date(newRecord.date).toISOString(),
          recordedBy: user.uid,
          createdAt: serverTimestamp(),
          currency: 'UGX'
        });
        alert("Spiritual contribution recorded in UGX.");
      }
      setShowAddForm(false);
      setEditingRecord(null);
      setNewRecord(initialRecordState);
    } catch (error) {
      handleFirestoreError(error, editingRecord ? OperationType.UPDATE : OperationType.CREATE, 'finance');
    }
  };

  const handleEdit = (record: FinanceRecord) => {
    setEditingRecord(record);
    setNewRecord({
      memberName: record.memberName || '',
      type: record.type,
      amount: record.amount,
      category: record.category,
      description: record.description || '',
      serviceName: record.serviceName || 'Sunday Morning Service',
      date: record.date.split('T')[0]
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this financial record?")) return;
    try {
      await deleteDoc(doc(db, 'finance', id));
      alert("Record deleted successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'finance');
    }
  };

  const handleExport = () => {
    downloadExcel(records, `graceflow_finance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const totals = records.reduce((acc, curr) => {
    acc.total += curr.amount;
    acc[curr.type] = (acc[curr.type] || 0) + curr.amount;
    
    // Group by Service
    const serviceKey = curr.serviceName || 'Standard Service';
    if (!acc.services) acc.services = {};
    acc.services[serviceKey] = (acc.services[serviceKey] || 0) + curr.amount;
    
    // Group by Year for Reporting
    const year = new Date(curr.date).getFullYear().toString();
    if (!acc.yearly) acc.yearly = {};
    acc.yearly[year] = (acc.yearly[year] || 0) + curr.amount;

    return acc;
  }, { total: 0, services: {}, yearly: {} } as any);

  const categoryData = [
    { name: 'Tithe', value: totals[TransactionType.TITHE] || 0, color: '#3b82f6' },
    { name: 'Offering', value: totals[TransactionType.OFFERING] || 0, color: '#10b981' },
    { name: 'Donations', value: totals[TransactionType.DONATION] || 0, color: '#8b5cf6' },
    { name: 'Other', value: totals[TransactionType.OTHER] || 0, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const filteredRecords = records.filter(r => 
    r.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.type.toLowerCase().includes(searchTerm.toLowerCase())
  );
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Financial Records</h2>
          <p className="text-slate-500 text-sm">Monitor contributions and manage church income.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
          {services.length === 0 && (
            <button 
              onClick={handleInitializeFinanceData}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
            >
              Initialize Categories
            </button>
          )}
          <button 
            onClick={() => setShowReports(!showReports)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all shadow-sm",
              showReports ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <CalendarDays className="w-4 h-4" />
            {showReports ? 'View Transactions' : 'Yearly Reports'}
          </button>
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Record
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAddForm(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h3 className="text-xl font-bold mb-6">Record New Contribution</h3>
              
              <form onSubmit={handleCreateRecord} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Member Name (or Anonymous)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    value={newRecord.memberName}
                    onChange={(e) => setNewRecord({...newRecord, memberName: e.target.value})}
                    placeholder="Enter name..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Type</label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                      value={newRecord.type}
                      onChange={(e) => setNewRecord({...newRecord, type: e.target.value as TransactionType})}
                    >
                      <option value={TransactionType.TITHE}>Tithe</option>
                      <option value={TransactionType.OFFERING}>Offering</option>
                      <option value={TransactionType.DONATION}>Donation</option>
                      <option value={TransactionType.OTHER}>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Church Service</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                      value={newRecord.serviceName}
                      onChange={(e) => setNewRecord({...newRecord, serviceName: e.target.value})}
                    >
                      <option value="">Select Service...</option>
                      {services.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                      {services.length === 0 && <option value="Sunday Morning Service">Sunday Morning Service</option>}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Date of Contribution</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                      value={newRecord.date}
                      onChange={(e) => setNewRecord({...newRecord, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Amount (UGX)</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                      value={newRecord.amount || ''}
                      onChange={(e) => setNewRecord({...newRecord, amount: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Project / Category</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    value={newRecord.category}
                    onChange={(e) => setNewRecord({...newRecord, category: e.target.value})}
                  >
                    <option value="">Select Project...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                    {projects.length === 0 && <option value="Main">Main</option>}
                  </select>
                </div>
                <button 
                  type="submit"
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  {editingRecord ? 'Update Entry' : 'Confirm Entry'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showReports ? (
        <div className="space-y-8">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-10 rounded-[48px] border border-church-blue/10 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-10 opacity-[0.03]">
                 <ArrowRightLeft className="w-48 h-48" />
               </div>
               <h3 className="text-3xl font-display font-black mb-8 tracking-tight italic">Program & Service Analytics</h3>
               <div className="grid md:grid-cols-2 gap-6">
                  {Object.entries(totals.services || {}).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([service, amount]) => (
                    <div key={service} className="p-6 bg-church-soft/30 rounded-3xl border border-church-blue/5 flex items-center justify-between group hover:bg-church-blue transition-all">
                      <div>
                        <h4 className="text-sm font-black text-church-black mb-1 group-hover:text-white transition-colors">{service}</h4>
                        <p className="text-[10px] font-bold text-church-gray uppercase tracking-widest group-hover:text-white/60">Total Resource Intake</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-church-blue group-hover:text-church-yellow">{formatCurrency(amount as number)}</p>
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-church-blue p-10 rounded-[48px] text-white shadow-2xl relative overflow-hidden group">
               <div className="relative z-10">
                 <h4 className="text-4xl font-display font-black mb-2 italic">Contribution Analysis</h4>
                 <p className="text-white/60 text-sm font-medium leading-relaxed">Year-over-year spiritual stewardship growth tracking and capacity planning.</p>
               </div>
               <div className="mt-10 pt-10 border-t border-white/10 relative z-10">
                 <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">Lifetime Gross</p>
                      <h4 className="text-3xl font-black text-church-yellow">{formatCurrency(totals.total)}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">Fiscal Records</p>
                      <h4 className="text-3xl font-black text-white">{records.length}</h4>
                    </div>
                 </div>
               </div>
               <TrendingUp className="absolute -bottom-10 -right-10 w-64 h-64 text-white/[0.03] group-hover:scale-110 transition-transform duration-700" />
            </div>
          </div>

          <div className="bg-white p-10 rounded-[48px] border border-church-blue/10 shadow-xl">
             <h4 className="text-2xl font-display font-black tracking-tight mb-8">Annual Performance Summary</h4>
             <div className="grid md:grid-cols-4 gap-6">
                {Object.entries(totals.yearly).sort((a,b) => Number(b[0]) - Number(a[0])).map(([year, amount]) => (
                  <div key={year} className="flex flex-col p-8 bg-church-soft/30 rounded-[32px] border border-church-blue/5 hover:border-church-blue/20 transition-all group">
                    <span className="text-3xl font-black text-church-blue mb-1 group-hover:scale-110 transition-transform origin-left">{year}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-church-gray mb-4">Fiscal Year Total</span>
                    <span className="text-xl font-black text-church-black">{formatCurrency(amount as number)}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm">Total Collections (UGX)</span>
                <TrendingUp className="text-emerald-500 w-4 h-4" />
              </div>
              <h3 className="text-3xl font-bold">{formatCurrency(totals.total)}</h3>
              <p className="text-xs text-slate-400 mt-2">Historical stewardship tracking</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-y-auto max-h-[140px]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Service Breakdown</h4>
              <div className="space-y-2">
                {Object.entries(totals.services || {}).map(([service, amount]) => (
                  <div key={service} className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-600">{service}</span>
                    <span className="font-bold text-church-blue">{formatCurrency(amount as number)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Records */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="font-bold">Recent Contributions</h3>
              <div className="flex gap-2 w-full md:w-auto">
                <select 
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="All">All Types</option>
                  <option value={TransactionType.TITHE}>Tithe</option>
                  <option value={TransactionType.OFFERING}>Offering</option>
                  <option value={TransactionType.DONATION}>Donation</option>
                  <option value={TransactionType.OTHER}>Other</option>
                </select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-sm w-full" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-100">
                    <th className="px-6 py-3">Member</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.filter(r => {
                    const matchesSearch = r.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      r.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      r.type.toLowerCase().includes(searchTerm.toLowerCase());
                    
                    const matchesType = filterType === 'All' || r.type === filterType;
                    
                    return matchesSearch && matchesType;
                  }).map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-sm">{d.memberName || 'Anonymous'}</td>
                      <td className="px-6 py-4 tracking-wide">
                        <span className="text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-600 font-medium">{d.type}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">{formatDate(d.date)}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">{formatCurrency(d.amount)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => handleEdit(d)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Plus className="w-4 h-4 rotate-45" />
                          </button>
                          <button 
                            onClick={() => handleDelete(d.id!)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm italic">No records found matching your selection.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Charts / Breakdown */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold mb-6">Distribution</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={categoryData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 mt-4">
              {categoryData.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-slate-600">{cat.name}</span>
                  </div>
                  <span className="font-bold">{formatCurrency(cat.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-lg overflow-hidden relative group cursor-pointer">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-2">Sanctuary Project</h3>
              <p className="text-blue-100 text-sm mb-4 italic">"New Sanctuary Sound System"</p>
              <div className="w-full bg-blue-500/50 h-2 rounded-full mb-2">
                <div className="bg-white h-full rounded-full w-[45%]" />
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span>{formatCurrency(45000000)} Raised</span>
                <span>{formatCurrency(100000000)} Goal</span>
              </div>
            </div>
            <DollarSign className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10 group-hover:scale-110 transition-transform" />
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
