import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Plus, 
  Calculator,
  Package,
  Calendar,
  User,
  Building
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, getDocs } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { cn } from '@/src/lib/utils';

export default function PortalRequisitions() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    itemName: '',
    cost: '',
    quantity: '',
    stockable: 'no',
    department: '',
    requesterName: user?.displayName || '',
    requestDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'requisitions'),
      where('requesterId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequisitions(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requisitions');
    });

    return () => unsubscribe();
  }, [user]);

  // Auto-detect department from employee database
  useEffect(() => {
    if (!user?.email) return;

    const fetchEmployeeDepartment = async () => {
      try {
        const q = query(collection(db, 'employees'), where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const employee = querySnapshot.docs[0].data();
          setFormData(prev => ({
            ...prev,
            department: employee.department || '',
            requesterName: user.displayName || employee.name || ''
          }));
        } else {
          // If no employee record found, just set the requester name
          setFormData(prev => ({
            ...prev,
            requesterName: user.displayName || '',
            department: 'Not Assigned'
          }));
        }
      } catch (error) {
        console.error('Error fetching employee department:', error);
        setFormData(prev => ({
          ...prev,
          requesterName: user.displayName || '',
          department: 'Not Assigned'
        }));
      }
    };

    fetchEmployeeDepartment();
  }, [user]);

  const calculateTotal = () => {
    const cost = parseFloat(formData.cost) || 0;
    const quantity = parseInt(formData.quantity) || 0;
    return cost * quantity;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert("You must be logged in to submit a requisition.");
      return;
    }

    try {
      const requisitionData = {
        itemName: formData.itemName,
        cost: parseFloat(formData.cost),
        quantity: parseInt(formData.quantity),
        total: calculateTotal(),
        stockable: formData.stockable === 'yes',
        department: formData.department,
        requesterName: user.displayName,
        requesterId: user.uid,
        requestDate: formData.requestDate,
        status: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'requisitions'), requisitionData);
      
      setFormData({
        itemName: '',
        cost: '',
        quantity: '',
        stockable: 'no',
        department: '',
        requesterName: user?.displayName || '',
        requestDate: new Date().toISOString().split('T')[0]
      });
      setShowForm(false);
      alert("Your requisition has been submitted successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requisitions');
    }
  };

  return (
    <div className="space-y-8 text-church-black">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-black tracking-tight text-church-black">Requisitions</h2>
          <p className="text-xs font-black text-church-gray uppercase tracking-widest mt-1">Department Requests</p>
        </div>
        {!showForm && (
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center gap-3 bg-church-blue text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-church-blue/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Requisition
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-10 rounded-2xl sm:rounded-[48px] border-2 border-church-yellow shadow-2xl relative overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
              <h3 className="font-display text-2xl font-black mb-6">Create Requisition Request</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Item Name</label>
                  <input 
                    type="text"
                    required
                    value={formData.itemName}
                    onChange={(e) => setFormData({...formData, itemName: e.target.value})}
                    className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue transition-all font-bold text-sm mt-1"
                    placeholder="Enter item name"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Cost per Unit</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData({...formData, cost: e.target.value})}
                    className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue transition-all font-bold text-sm mt-1"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Quantity</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                    className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent focus:border-church-blue transition-all font-bold text-sm mt-1"
                    placeholder="1"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Total Amount</label>
                  <input 
                    type="text"
                    value={`UGX ${calculateTotal().toLocaleString()}`}
                    readOnly
                    className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent font-bold text-sm mt-1 text-church-blue"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Stockable Item?</label>
                <div className="flex gap-6 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio"
                      name="stockable"
                      value="yes"
                      checked={formData.stockable === 'yes'}
                      onChange={(e) => setFormData({...formData, stockable: e.target.value})}
                      className="w-4 h-4 text-church-blue"
                    />
                    <span className="text-sm font-bold">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio"
                      name="stockable"
                      value="no"
                      checked={formData.stockable === 'no'}
                      onChange={(e) => setFormData({...formData, stockable: e.target.value})}
                      className="w-4 h-4 text-church-blue"
                    />
                    <span className="text-sm font-bold">No</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Requester Name</label>
                  <input 
                    type="text"
                    value={formData.requesterName}
                    readOnly
                    className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent font-bold text-sm mt-1"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Request Date</label>
                  <input 
                    type="date"
                    value={formData.requestDate}
                    readOnly
                    className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent font-bold text-sm mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Department</label>
                <input 
                  type="text"
                  value={formData.department}
                  readOnly
                  placeholder="Auto-detected from your role"
                  className="w-full p-4 rounded-2xl bg-church-soft border-2 border-transparent font-bold text-sm mt-1"
                />
              </div>

              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-church-soft text-church-black py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-church-blue/5 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-church-yellow text-church-black py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-church-yellow/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black text-church-gray uppercase tracking-[0.2em]">Your Requisitions</h3>
          <span className="text-[10px] font-bold text-church-blue bg-church-blue/5 px-3 py-1 rounded-full uppercase tracking-widest italic">{requisitions.length} Requests</span>
        </div>
        
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white p-8 rounded-2xl sm:rounded-[40px] border border-church-soft shadow-sm text-church-gray text-sm">
              Loading your requisitions...
            </div>
          ) : requisitions.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl sm:rounded-[40px] border border-church-soft shadow-sm text-church-gray text-sm">
              No requisitions found yet. Submit a request to see it listed here.
            </div>
          ) : (
            requisitions.map((req: any) => (
              <div key={req.id} className="bg-white p-8 rounded-2xl sm:rounded-[40px] border border-church-blue/5 shadow-xl shadow-church-blue/5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-6 gap-4">
                  <div>
                    <h4 className="text-xl font-black text-church-black mb-2">{req.itemName}</h4>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="flex items-center gap-2 text-church-gray">
                        <Package className="w-4 h-4" /> Qty: {req.quantity}
                      </span>
                      <span className="flex items-center gap-2 text-church-gray">
                        <Calculator className="w-4 h-4" /> UGX {req.total?.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-2 text-church-gray">
                        <Building className="w-4 h-4" /> {req.department}
                      </span>
                      <span className="flex items-center gap-2 text-church-gray">
                        <Calendar className="w-4 h-4" /> {req.requestDate || req.createdAt?.toDate?.()?.toLocaleDateString?.() || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className={cn(
                    "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest",
                    req.status === 'Pending' ? "bg-amber-100 text-amber-700" : 
                    req.status === 'Approved' ? "bg-emerald-100 text-emerald-700" : 
                    "bg-rose-100 text-rose-700"
                  )}>
                    {req.status}
                  </div>
                </div>
                {req.stockable && (
                  <div className="mb-4">
                    <span className="text-xs font-bold text-church-blue bg-church-blue/5 px-3 py-1 rounded-full">Stockable Item</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
