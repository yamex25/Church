import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Plus,
  Search,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  DollarSign,
  Calendar,
  X,
  Trash2,
  Edit2,
  Download,
  LayoutGrid,
  List
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { Asset } from '@/src/types';
import { cn, formatCurrency, formatDate, downloadExcel } from '@/src/lib/utils';

export default function AssetInventory() {
  const { user, churchId } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    assetId: '',
    category: '',
    department: '',
    condition: 'Good' as Asset['condition'],
    location: '',
    value: 0,
    purchaseDate: new Date().toISOString().split('T')[0],
    serialNumber: '',
    proofUrl: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [assetView, setAssetView] = useState<'kanban' | 'list'>('kanban');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (limit to 5MB for prototype bank storage)
    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Please upload a document under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, proofUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const viewProof = (url: string) => {
    if (!url) return;
    try {
      const newTab = window.open();
      if (newTab) {
        newTab.document.body.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #f8fafc; font-family: sans-serif; padding: 40px;">
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 90%;">
              ${url.startsWith('data:image') 
                ? `<img src="${url}" style="max-width: 100%; height: auto; border-radius: 8px;">` 
                : `<iframe src="${url}" style="width: 800px; height: 600px; border: none;"></iframe>`
              }
              <div style="margin-top: 20px; text-align: center;">
                <p style="font-weight: bold; color: #1e293b;">Asset Proof Document</p>
                <a href="${url}" download="asset-proof" style="display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; margin-top: 10px;">Download Document</a>
              </div>
            </div>
          </div>
        `;
      } else {
        // Fallback to direct download if popup blocked
        const link = document.createElement('a');
        link.href = url;
        link.download = 'asset-proof';
        link.click();
      }
    } catch (err) {
      console.error("Error viewing proof:", err);
      alert("Could not open document. Try downloading it instead.");
    }
  };

  useEffect(() => {
    if (!churchId) return;
    const q = query(collection(db, 'churches', churchId!, 'assets'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Asset[];
      setAssets(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'assets');
    });
    return () => unsubscribe();
  }, [churchId]);

  useEffect(() => {
    if (!churchId) return;
    const unsubscribeDepts = onSnapshot(query(collection(db, 'churches', churchId!, 'departments'), orderBy('name', 'asc')), (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });
    return () => unsubscribeDepts();
  }, [churchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'churches', churchId!, 'assets', editingId), { ...formData, updatedAt: serverTimestamp() });
        alert("Asset status updated.");
      } else {
        await addDoc(collection(db, 'churches', churchId!, 'assets'), { ...formData, churchId, createdAt: serverTimestamp() });
        alert("New asset registered.");
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', assetId: '', category: '', department: '', condition: 'Good', location: '', value: 0, purchaseDate: new Date().toISOString().split('T')[0], serialNumber: '', proofUrl: '' });
    } catch (error) {
       handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'assets');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this asset from registry?")) return;
    try {
      await deleteDoc(doc(db, 'churches', churchId!, 'assets', id));
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, 'assets');
    }
  };

  const handleEdit = (asset: Asset) => {
    setEditingId(asset.id!);
    setFormData({
      name: asset.name,
      assetId: asset.assetId || '',
      category: asset.category || '',
      department: (asset as any).department || '',
      condition: asset.condition,
      location: asset.location || '',
      value: asset.value,
      purchaseDate: asset.purchaseDate,
      serialNumber: asset.serialNumber || '',
      proofUrl: asset.proofUrl || ''
    });
    setShowForm(true);
  };

  const handleExport = () => {
    downloadExcel(assets, `graceflow_assets_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-display font-black tracking-tight text-church-black">Inventory & Assets</h2>
          <p className="text-church-gray font-medium">Stewardship of physical resources and church equipment.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-church-gray w-4 h-4" />
            <input
              type="text"
              placeholder="Search assets by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 border-2 border-church-blue/10 rounded-2xl font-medium text-sm focus:outline-none focus:border-church-blue/30 transition-all"
            />
          </div>
          <div className="flex items-center gap-1 bg-church-soft p-1 rounded-xl border border-church-blue/10">
            <button onClick={() => setAssetView('kanban')} title="Card view" className={cn('p-2.5 rounded-lg transition-all', assetView === 'kanban' ? 'bg-white shadow-sm text-church-blue' : 'text-church-gray hover:text-church-black')}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setAssetView('list')} title="List view" className={cn('p-2.5 rounded-lg transition-all', assetView === 'list' ? 'bg-white shadow-sm text-church-blue' : 'text-church-gray hover:text-church-black')}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <button onClick={handleExport} className="flex items-center gap-2 border-2 border-church-blue/10 text-church-gray px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-church-soft transition-all">
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-3 bg-church-blue text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-church-blue/20">
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
         {[
           { label: 'Total Assets', val: assets.length, icon: Package, color: 'blue' },
           { label: 'Total Value', val: formatCurrency(assets.reduce((acc, curr) => acc + curr.value, 0)), icon: DollarSign, color: 'yellow' },
           { label: 'Condition', val: `${assets.filter(a => a.condition === 'Good').length} Good / ${assets.filter(a => a.condition === 'Fair').length} Fair / ${assets.filter(a => a.condition === 'Bad').length} Bad`, icon: ShieldCheck, color: 'blue' },
         ].map((s) => (
           <div key={s.label} className={cn("p-4 rounded-[32px] border shadow-xl shadow-church-blue/5",
             s.color === 'blue' ? "bg-church-blue text-white border-church-blue/20" : "bg-yellow-400 text-slate-900 border-yellow-400/20"
           )}>
              <div className="flex items-center justify-between mb-3">
                <s.icon className={cn("w-4 h-4", s.color === 'yellow' ? 'text-church-blue' : 'text-white')} />
              </div>
              <h3 className={cn("text-lg font-black", s.color === 'blue' ? 'text-white' : 'text-slate-900')}>{s.val}</h3>
              <p className={cn("text-[8px] font-black uppercase tracking-widest mt-1", s.color === 'blue' ? 'text-white/80' : 'text-slate-700')}>{s.label}</p>
           </div>
         ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-church-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-2xl sm:rounded-[40px] p-10 w-full max-w-xl shadow-2xl relative">
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="absolute top-8 right-8 p-3 bg-church-soft rounded-2xl text-church-gray"><X className="w-6 h-6" /></button>
              <h3 className="text-2xl font-black mb-6">{editingId ? 'Update Asset' : 'New Asset Registration'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Asset Name</label>
                  <input required className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Asset ID (Number Plate, etc.)</label>
                  <input className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.assetId} onChange={e => setFormData({...formData, assetId: e.target.value})} placeholder="e.g., KAB 123X, SN001, etc." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Department Owner</label>
                    <select required className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
                      <option value="">Select Department...</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Category Type</label>
                    <select required className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                      <option value="">Choose Type...</option>
                      <option value="Furniture">Furniture</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Instruments">Musical Instruments</option>
                      <option value="ICT">ICT & Computer</option>
                      <option value="Vehicle">Vehicle/Transport</option>
                      <option value="Construction">Construction/Building</option>
                      <option value="Kitchen">Kitchen & Catering</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Condition</label>
                    <select className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value as any})}>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Bad">Bad</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Current Location</label>
                    <input required className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Value (UGX)</label>
                    <input required type="number" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.value || ''} onChange={e => setFormData({...formData, value: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Purchase Date</label>
                    <input required type="date" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Proof of Property (Receipt/Doc)</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="file" 
                      accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden" 
                      id="asset-proof" 
                    />
                    <label 
                      htmlFor="asset-proof"
                      className="flex-1 px-5 py-3 rounded-xl bg-church-soft border-2 border-dashed border-church-blue/20 hover:border-church-blue/40 transition-all font-bold text-xs cursor-pointer flex items-center justify-center gap-2 text-church-gray relative overflow-hidden"
                    >
                      {formData.proofUrl ? '✓ Document Loaded' : 'Click to Upload Receipt/Proof'}
                      {formData.proofUrl && formData.proofUrl.startsWith('data:image') && (
                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                           <img src={formData.proofUrl} className="w-full h-full object-cover" alt="preview" />
                        </div>
                      )}
                    </label>
                    {formData.proofUrl && (
                      <button 
                        type="button" 
                        onClick={() => setFormData(prev => ({ ...prev, proofUrl: '' }))}
                        className="p-3 bg-rose-50 text-rose-500 rounded-xl"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-church-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-church-blue/20 hover:scale-105 transition-all">
                  {editingId ? 'Update Asset' : 'Register Asset'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {assetView === 'list' ? (
        <div className="bg-white rounded-[32px] border border-church-blue/5 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr className="bg-church-blue text-white text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                  <th className="px-6 py-5 text-left">Asset</th>
                  <th className="px-6 py-5">Category</th>
                  <th className="px-6 py-5">Department</th>
                  <th className="px-6 py-5">Condition</th>
                  <th className="px-6 py-5 text-right">Value</th>
                  <th className="px-6 py-5">Location</th>
                  <th className="px-6 py-5">Purchased</th>
                  <th className="px-6 py-5">Proof</th>
                  <th className="px-6 py-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-church-soft">
                {assets.filter(a => searchTerm === '' || a.name.toLowerCase().includes(searchTerm.toLowerCase())).map(asset => (
                  <tr key={asset.id} className="hover:bg-church-soft/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-church-black">{asset.name}</div>
                      {asset.assetId && <div className="text-[10px] text-church-blue font-black">{asset.assetId}</div>}
                    </td>
                    <td className="px-6 py-4 text-xs text-church-gray font-medium">{asset.category || '—'}</td>
                    <td className="px-6 py-4 text-xs text-indigo-600 font-bold">{(asset as any).department || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={cn('px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest',
                        asset.condition === 'Good' ? 'bg-emerald-100 text-emerald-700' :
                        asset.condition === 'Fair' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-rose-100 text-rose-700'
                      )}>{asset.condition}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-church-blue text-sm">{formatCurrency(asset.value)}</td>
                    <td className="px-6 py-4 text-xs text-church-gray font-medium">{asset.location || '—'}</td>
                    <td className="px-6 py-4 text-xs text-church-gray whitespace-nowrap">{asset.purchaseDate}</td>
                    <td className="px-6 py-4">
                      {asset.proofUrl
                        ? <button onClick={() => viewProof(asset.proofUrl!)} className="text-[10px] font-black uppercase text-emerald-600 underline hover:text-emerald-700">View</button>
                        : <span className="text-[10px] font-black uppercase text-slate-400">None</span>
                      }
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(asset)} className="p-1.5 bg-church-soft text-church-blue rounded-lg hover:bg-church-blue hover:text-white transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(asset.id!)} className="p-1.5 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (

      <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-6">
        {assets.filter(asset =>
          searchTerm === '' || asset.name.toLowerCase().includes(searchTerm.toLowerCase())
        ).map((asset) => (
          <div key={asset.id} className="bg-white rounded-[32px] p-8 border border-church-blue/5 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group">
            <div className="flex justify-between items-start mb-6">
               <div className={cn(
                 "p-4 rounded-2xl",
                 asset.condition === 'Good' ? "bg-emerald-50 text-emerald-600" : (asset.condition === 'Fair' ? "bg-yellow-50 text-church-yellow" : "bg-rose-50 text-rose-600")
               )}>
                 <Package className="w-6 h-6" />
               </div>
               <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(asset)} className="p-2 bg-church-soft text-church-blue rounded-lg hover:bg-church-blue hover:text-white transition-all"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(asset.id!)} className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
               </div>
            </div>
            <h4 className="text-xl font-black text-church-black mb-1">{asset.name}</h4>
            {asset.assetId && (
              <p className="text-sm font-black text-church-blue mb-2">ID: {asset.assetId}</p>
            )}
            <div className="flex flex-col gap-1 mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-church-gray flex items-center gap-2">
                <Package className="w-3 h-3 text-church-blue" /> {asset.category}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-church-gray flex items-center gap-2">
                <MapPin className="w-3 h-3 text-church-blue" /> {asset.location}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 font-bold">
                Owned by: {(asset as any).department || 'N/A'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-church-soft pt-4 mt-auto">
               <div>
                  <span className="text-[10px] font-black uppercase text-church-gray block">Value</span>
                  <span className="text-sm font-black text-church-blue">{formatCurrency(asset.value)}</span>
               </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-church-gray block">Proof</span>
                  {asset.proofUrl ? (
                    <button 
                      onClick={() => viewProof(asset.proofUrl!)} 
                      className="text-[9px] font-black uppercase text-emerald-600 underline hover:text-emerald-700"
                    >
                      View Record
                    </button>
                  ) : (
                    <span className="text-[9px] font-black uppercase text-slate-400">No Proof</span>
                  )}
               </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
