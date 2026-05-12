import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardList, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  Filter,
  Package,
  User,
  ArrowRight,
  X
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { Requisition, RequisitionStatus, UserRole, Employee } from '@/src/types';
import { cn, formatCurrency, formatDate } from '@/src/lib/utils';

export default function Requisitions() {
  const { user } = useAuth();
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeptHead, setIsDeptHead] = useState(false);
  const [empRecord, setEmpRecord] = useState<Employee | null>(null);
  
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  
  const [newReq, setNewReq] = useState({
    department: '',
    items: '',
    estimatedCost: 0,
    purpose: ''
  });

  useEffect(() => {
    // Fetch departments
    const unsubscribeDepts = onSnapshot(query(collection(db, 'departments'), orderBy('name', 'asc')), (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });
    return () => unsubscribeDepts();
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    
    // Check if user is a department head
    const qEmp = query(collection(db, 'employees'), where('email', '==', user.email));
    const unsubscribeEmp = onSnapshot(qEmp, (snapshot) => {
      if (!snapshot.empty) {
        const emp = snapshot.docs[0].data() as Employee;
        setEmpRecord(emp);
        setIsDeptHead(emp.isDepartmentHead || user.role === UserRole.ADMIN);
        if (emp.department) {
          setNewReq(prev => ({ ...prev, department: emp.department }));
        }
      } else if (user.role === UserRole.ADMIN) {
        setIsDeptHead(true);
      }
    });

    return () => unsubscribeEmp();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'requisitions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Requisition[];
      setRequisitions(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requisitions');
    });

    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!isDeptHead) {
      alert("Access Denied: Only Department Heads are authorized to submit resource requisitions.");
      return;
    }

    try {
      await addDoc(collection(db, 'requisitions'), {
        ...newReq,
        requestedBy: user.displayName,
        requesterId: user.uid,
        status: RequisitionStatus.PENDING,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Auto-fill department if they are linked to an employee record
        department: empRecord?.department || newReq.department
      });
      setShowAddForm(false);
      setNewReq({ department: '', items: '', estimatedCost: 0, purpose: '' });
      alert("Requisition submitted for verification.");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requisitions');
    }
  };

  const handleAction = async (id: string, status: RequisitionStatus) => {
    if (!user) return;
    
    let notes = '';
    if (status === RequisitionStatus.DECLINED) {
      const reason = prompt("Please provide a reason for declining this requisition:");
      if (reason === null) return; // Cancelled
      notes = reason;
    }

    try {
      const docRef = doc(db, 'requisitions', id);
      const requisition = requisitions.find(r => r.id === id);
      
      // Update requisition status
      await updateDoc(docRef, {
        status,
        approverId: user.uid,
        approverName: user.displayName,
        notes,
        updatedAt: serverTimestamp()
      });

      // If approved, handle finance and stockable items
      if (status === RequisitionStatus.APPROVED && requisition) {
        // Update finance budget (reduce by total amount)
        if (requisition.total) {
          try {
            const financeQuery = query(collection(db, 'finance'), orderBy('createdAt', 'desc'));
            const financeSnapshot = await getDocs(financeQuery);
            if (!financeSnapshot.empty) {
              const latestFinance = financeSnapshot.docs[0].data();
              const newBalance = (latestBalance.balance || 0) - requisition.total;
              
              await updateDoc(doc(db, 'finance', financeSnapshot.docs[0].id), {
                balance: newBalance,
                updatedAt: serverTimestamp()
              });
            }
          } catch (financeError) {
            console.error('Error updating finance:', financeError);
          }
        }

        // If stockable item, add to assets
        if (requisition.stockable) {
          try {
            await addDoc(collection(db, 'assets'), {
              name: requisition.itemName || requisition.items,
              category: 'Requisition Item',
              department: requisition.department,
              value: requisition.total || requisition.estimatedCost,
              location: 'Storage',
              condition: 'Good',
              purchaseDate: new Date().toISOString().split('T')[0],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } catch (assetError) {
            console.error('Error adding asset:', assetError);
          }
        }
      }
      
      alert(`Requisition ${status.toLowerCase()} successfully.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'requisitions');
    }
  };

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.PASTOR || user?.role === UserRole.TREASURER;

  const filtered = requisitions.filter(r => 
    r.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.items && r.items.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.itemName && r.itemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    r.requestedBy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 text-church-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-display font-black tracking-tight mb-2">Requisitions & Requests</h2>
          <p className="text-church-gray font-medium">Departmental resource management and approvals.</p>
        </div>
        {isDeptHead && (
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-3 bg-church-blue text-white px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-church-blue/20"
          >
            <Plus className="w-4 h-4" />
            Make Request
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-church-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[40px] p-10 w-full max-w-xl shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAddForm(false)}
                className="absolute top-8 right-8 p-3 bg-church-soft rounded-2xl text-church-gray hover:text-church-blue transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="mb-8">
                <h3 className="text-2xl font-display font-black tracking-tight">New Resource Request</h3>
                <p className="text-sm text-church-gray mt-1">Submit for procurement approval.</p>
              </div>

              <form onSubmit={handleCreate} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Department</label>
                    <select 
                      required
                      className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm"
                      value={newReq.department}
                      onChange={(e) => setNewReq({...newReq, department: e.target.value})}
                    >
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Est. Cost (UGX)</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm"
                      value={newReq.estimatedCost || ''}
                      onChange={(e) => setNewReq({...newReq, estimatedCost: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Items Needed</label>
                  <textarea 
                    required
                    placeholder="List the items..."
                    className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm h-24"
                    value={newReq.items}
                    onChange={(e) => setNewReq({...newReq, items: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Purpose / Reason</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm"
                    value={newReq.purpose}
                    onChange={(e) => setNewReq({...newReq, purpose: e.target.value})}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-church-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-church-blue/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Submit Requisition
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white p-6 rounded-[32px] border border-church-blue/5 shadow-xl shadow-church-blue/5 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full font-sans">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-church-blue w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search requisitions..."
            className="w-full pl-12 pr-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:outline-none focus:border-church-blue/20 focus:bg-white text-sm placeholder:text-church-gray transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6">
        {filtered.map((req) => (
          <motion.div 
            layout
            key={req.id}
            className="bg-white rounded-[32px] p-8 border border-church-blue/10 shadow-lg shadow-church-blue/5 relative overflow-hidden group"
          >
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-church-soft px-4 py-1.5 rounded-full text-church-gray border border-church-blue/5 group-hover:bg-church-blue group-hover:text-white transition-colors">
                    {req.department}
                  </span>
                  <div className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                    req.status === RequisitionStatus.PENDING ? "bg-church-yellow text-church-black border-church-yellow-dark" :
                    req.status === RequisitionStatus.APPROVED ? "bg-emerald-500 text-white border-emerald-600" :
                    "bg-rose-500 text-white border-rose-600"
                  )}>
                    {req.status}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-2xl font-display font-black tracking-tight text-church-black mb-1 italic">
                    "{req.itemName || req.items}"
                  </h3>
                  <p className="text-sm font-medium text-church-gray">{req.purpose || 'Department requisition'}</p>
                  {req.quantity && (
                    <p className="text-sm text-church-gray mt-1">Quantity: {req.quantity}</p>
                  )}
                  {req.stockable && (
                    <span className="inline-block mt-2 text-xs font-bold text-church-blue bg-church-blue/5 px-3 py-1 rounded-full">
                      Stockable Item
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-church-gray">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-church-blue" />
                    {req.requestedBy}
                  </div>
                  <div className="flex items-center gap-2 font-display text-base text-church-black normal-case">
                    <Package className="w-4 h-4 text-church-blue" />
                    {formatCurrency(req.total || req.estimatedCost)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(req.createdAt)}
                  </div>
                </div>
              </div>

              {isAdmin && req.status === RequisitionStatus.PENDING && (
                <div className="flex gap-3 self-center">
                  <button 
                    onClick={() => handleAction(req.id!, RequisitionStatus.APPROVED)}
                    className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border border-emerald-100 hover:bg-emerald-500 hover:text-white transition-all active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button 
                    onClick={() => handleAction(req.id!, RequisitionStatus.DECLINED)}
                    className="flex items-center gap-2 bg-rose-50 text-rose-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border border-rose-100 hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                  >
                    <XCircle className="w-4 h-4" />
                    Decline
                  </button>
                </div>
              )}
              
              {req.status !== RequisitionStatus.PENDING && (
                <div className="flex flex-col items-end text-right">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-church-gray mb-1">Authenticated By</span>
                  <div className="flex items-center gap-2 text-[10px] font-black text-church-blue">
                    {req.approverName || 'System Admin'}
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              )}
            </div>
            
            {/* Background Accent */}
            <div className="absolute -right-10 -bottom-10 opacity-[0.03] pointer-events-none group-hover:opacity-10 transition-opacity">
              <ClipboardList className="w-64 h-64 rotate-12" />
            </div>
          </motion.div>
        ))}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-20 bg-church-soft/30 rounded-[40px] border-2 border-dashed border-church-blue/10">
            <ClipboardList className="w-16 h-16 mx-auto text-church-gray opacity-20 mb-4" />
            <p className="text-church-gray font-bold uppercase tracking-widest text-[10px]">No budget requisitions found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
