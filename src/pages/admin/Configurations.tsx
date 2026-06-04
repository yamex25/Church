import { useEffect, useState } from 'react';
import { Info, Save, Plus, Trash2, Edit2, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { doc, onSnapshot, setDoc, collection, query, orderBy, addDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { Zone, Cell } from '@/src/types';

export default function Configurations() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [activeTab, setActiveTab] = useState('contributions');
  
  // Zone and Cell Management States
  const [zones, setZones] = useState<Zone[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [showAddZone, setShowAddZone] = useState(false);
  const [showAddCell, setShowAddCell] = useState(false);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneDesc, setNewZoneDesc] = useState('');
  const [newCellName, setNewCellName] = useState('');
  const [newCellDesc, setNewCellDesc] = useState('');
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [editingCell, setEditingCell] = useState<Cell | null>(null);

  // Load Contributions Settings
  useEffect(() => {
    const settingsDoc = doc(db, 'configs', 'contributions');
    const unsubscribe = onSnapshot(settingsDoc, (snap) => {
      if (snap.exists()) setSettings(snap.data());
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'configs/contributions'));

    return () => unsubscribe();
  }, []);

  // Load Zones
  useEffect(() => {
    const q = query(collection(db, 'zones'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Zone[];
      setZones(docs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'zones'));

    return () => unsubscribe();
  }, []);

  // Load Cells
  useEffect(() => {
    const q = query(collection(db, 'cells'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Cell[];
      setCells(docs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cells'));

    return () => unsubscribe();
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((s: any) => ({ ...s, [key]: value }));
  };

  const handleSaveContributions = async () => {
    setSaving(true);
    try {
      const settingsDoc = doc(db, 'configs', 'contributions');
      await setDoc(settingsDoc, settings, { merge: true });
      setSaving(false);
      alert('Configuration saved.');
    } catch (error) {
      setSaving(false);
      handleFirestoreError(error, OperationType.WRITE, 'configs/contributions');
    }
  };

  // Zone Management
  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) {
      alert('Please enter a zone name');
      return;
    }

    try {
      setSaving(true);
      const docRef = await addDoc(collection(db, 'zones'), {
        name: newZoneName.trim(),
        description: newZoneDesc.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('Zone created with ID:', docRef.id);
      setSaving(false);
      setNewZoneName('');
      setNewZoneDesc('');
      setShowAddZone(false);
      alert('Zone created successfully!');
    } catch (error) {
      setSaving(false);
      console.error('Error creating zone:', error);
      alert('Error creating zone: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleUpdateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZone || !newZoneName.trim()) {
      alert('Please enter a zone name');
      return;
    }

    try {
      setSaving(true);
      await updateDoc(doc(db, 'zones', editingZone.id), {
        name: newZoneName.trim(),
        description: newZoneDesc.trim(),
        updatedAt: serverTimestamp(),
      });
      setSaving(false);
      setEditingZone(null);
      setNewZoneName('');
      setNewZoneDesc('');
      setShowAddZone(false);
      alert('Zone updated successfully!');
    } catch (error) {
      setSaving(false);
      console.error('Error updating zone:', error);
      alert('Error updating zone: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Are you sure you want to delete this zone? Any cells under this zone will need to be reassigned.')) return;
    try {
      setSaving(true);
      await deleteDoc(doc(db, 'zones', zoneId));
      setSaving(false);
      setSelectedZone(null);
      alert('Zone deleted successfully!');
    } catch (error) {
      setSaving(false);
      console.error('Error deleting zone:', error);
      alert('Error deleting zone: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Cell Management
  const handleAddCell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZone || !newCellName.trim()) {
      alert('Please select a zone and enter a cell name');
      return;
    }

    try {
      setSaving(true);
      const docRef = await addDoc(collection(db, 'cells'), {
        name: newCellName.trim(),
        zoneId: selectedZone.id,
        zoneName: selectedZone.name,
        description: newCellDesc.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('Cell created with ID:', docRef.id);
      setSaving(false);
      setNewCellName('');
      setNewCellDesc('');
      setShowAddCell(false);
      alert('Cell created successfully!');
    } catch (error) {
      setSaving(false);
      console.error('Error creating cell:', error);
      alert('Error creating cell: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleUpdateCell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCell || !newCellName.trim() || !selectedZone) {
      alert('Please enter all required information');
      return;
    }

    try {
      setSaving(true);
      await updateDoc(doc(db, 'cells', editingCell.id), {
        name: newCellName.trim(),
        zoneId: selectedZone.id,
        zoneName: selectedZone.name,
        description: newCellDesc.trim(),
        updatedAt: serverTimestamp(),
      });
      setSaving(false);
      setEditingCell(null);
      setNewCellName('');
      setNewCellDesc('');
      setShowAddCell(false);
      alert('Cell updated successfully!');
    } catch (error) {
      setSaving(false);
      console.error('Error updating cell:', error);
      alert('Error updating cell: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDeleteCell = async (cellId: string) => {
    if (!confirm('Are you sure you want to delete this cell? Members assigned to this cell will need to be reassigned.')) return;
    try {
      setSaving(true);
      await deleteDoc(doc(db, 'cells', cellId));
      setSaving(false);
      alert('Cell deleted successfully!');
    } catch (error) {
      setSaving(false);
      console.error('Error deleting cell:', error);
      alert('Error deleting cell: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleEditZone = (zone: Zone) => {
    setEditingZone(zone);
    setNewZoneName(zone.name);
    setNewZoneDesc(zone.description || '');
    setShowAddZone(true);
  };

  const handleEditCell = (cell: Cell) => {
    setEditingCell(cell);
    const zone = zones.find(z => z.id === cell.zoneId);
    if (zone) setSelectedZone(zone);
    setNewCellName(cell.name);
    setNewCellDesc(cell.description || '');
    setShowAddCell(true);
  };

  const zonesWithCellCount = zones.map(zone => ({
    ...zone,
    cellCount: cells.filter(c => c.zoneId === zone.id).length
  }));

  const cellsForSelectedZone = selectedZone ? cells.filter(c => c.zoneId === selectedZone.id) : [];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-church-blue/10">
        <button
          onClick={() => setActiveTab('contributions')}
          className={`px-6 py-4 font-bold text-sm uppercase tracking-widest transition-all ${
            activeTab === 'contributions'
              ? 'text-church-blue border-b-2 border-church-blue'
              : 'text-church-gray hover:text-church-blue'
          }`}
        >
          Contributions
        </button>
        <button
          onClick={() => setActiveTab('zones')}
          className={`px-6 py-4 font-bold text-sm uppercase tracking-widest transition-all ${
            activeTab === 'zones'
              ? 'text-church-blue border-b-2 border-church-blue'
              : 'text-church-gray hover:text-church-blue'
          }`}
        >
          Zones & Cells
        </button>
      </div>

      {/* Contributions Tab */}
      {activeTab === 'contributions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-display font-black">Contributions Configuration</h2>
              <p className="text-xs text-church-gray mt-1">Manage contribution channels and contact details shown in the member portal.</p>
            </div>
            <div>
              <button
                onClick={handleSaveContributions}
                disabled={saving}
                className="px-6 py-3 bg-church-yellow rounded-2xl font-bold shadow-md"
              >
                <Save className="w-4 h-4 inline-block mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white rounded-2xl border border-church-blue/10">
              <h3 className="font-bold text-church-blue">Mobile Money</h3>
              <label className="block text-xs text-church-gray mt-3">Church Mobile Number</label>
              <input value={settings?.mobileNumber || ''} onChange={(e) => handleChange('mobileNumber', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
              <label className="block text-xs text-church-gray mt-3">Merchant / Paybill Code</label>
              <input value={settings?.merchantCode || ''} onChange={(e) => handleChange('merchantCode', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
            </div>

            <div className="p-6 bg-white rounded-2xl border border-church-blue/10">
              <h3 className="font-bold text-church-blue">Bank Details</h3>
              <label className="block text-xs text-church-gray mt-3">Bank Name</label>
              <input value={settings?.bankName || ''} onChange={(e) => handleChange('bankName', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
              <label className="block text-xs text-church-gray mt-3">Account Name</label>
              <input value={settings?.bankAccountName || ''} onChange={(e) => handleChange('bankAccountName', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
              <label className="block text-xs text-church-gray mt-3">Account Number</label>
              <input value={settings?.bankAccountNumber || ''} onChange={(e) => handleChange('bankAccountNumber', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
            </div>

            <div className="p-6 bg-white rounded-2xl border border-church-blue/10 md:col-span-2">
              <h3 className="font-bold text-church-blue">Finance Contact</h3>
              <label className="block text-xs text-church-gray mt-3">Help Phone</label>
              <input value={settings?.helpPhone || ''} onChange={(e) => handleChange('helpPhone', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
              <label className="block text-xs text-church-gray mt-3">Help Email</label>
              <input value={settings?.helpEmail || ''} onChange={(e) => handleChange('helpEmail', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
              <label className="block text-xs text-church-gray mt-3">Additional Info / Instructions</label>
              <textarea value={settings?.additionalInfo || ''} onChange={(e) => handleChange('additionalInfo', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft h-24" />
            </div>
          </div>
        </div>
      )}

      {/* Zones & Cells Tab */}
      {activeTab === 'zones' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Zones Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-display font-black text-church-black">Zones</h3>
                <button
                  onClick={() => {
                    setEditingZone(null);
                    setNewZoneName('');
                    setNewZoneDesc('');
                    setShowAddZone(!showAddZone);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-church-blue text-white rounded-xl font-bold text-xs hover:scale-105 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {showAddZone ? 'Cancel' : 'Add Zone'}
                </button>
              </div>

              {showAddZone && (
                <form onSubmit={editingZone ? handleUpdateZone : handleAddZone} className="p-4 bg-white rounded-xl border border-church-blue/10 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-church-gray">Zone Name</label>
                    <input
                      type="text"
                      required
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                      className="w-full p-2 mt-1 rounded-lg bg-church-soft border-2 border-transparent focus:border-church-blue/20"
                      placeholder="Enter zone name..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-church-gray">Description (Optional)</label>
                    <textarea
                      value={newZoneDesc}
                      onChange={(e) => setNewZoneDesc(e.target.value)}
                      className="w-full p-2 mt-1 rounded-lg bg-church-soft border-2 border-transparent focus:border-church-blue/20"
                      placeholder="Enter zone description..."
                      rows={3}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-2 bg-church-blue text-white rounded-lg font-bold text-xs hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Creating Zone...' : editingZone ? 'Update Zone' : 'Create Zone'}
                  </button>
                </form>
              )}

              <div className="space-y-2">
                {zonesWithCellCount.map(zone => (
                  <div
                    key={zone.id}
                    onClick={() => setSelectedZone(zone)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedZone?.id === zone.id
                        ? 'bg-church-blue/10 border-church-blue'
                        : 'bg-white border-church-blue/10 hover:border-church-blue'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-church-black">{zone.name}</h4>
                        <p className="text-xs text-church-gray">{zone.cellCount} cells</p>
                        {zone.description && <p className="text-xs text-church-gray mt-1">{zone.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditZone(zone);
                          }}
                          className="p-2 hover:bg-church-soft rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4 text-church-blue" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteZone(zone.id);
                          }}
                          className="p-2 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cells Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-display font-black text-church-black">
                  {selectedZone ? `Cells in ${selectedZone.name}` : 'Cells'}
                </h3>
                <button
                  onClick={() => {
                    setEditingCell(null);
                    setNewCellName('');
                    setNewCellDesc('');
                    setShowAddCell(!showAddCell);
                  }}
                  disabled={!selectedZone}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                    selectedZone
                      ? 'bg-church-blue text-white hover:scale-105'
                      : 'bg-church-soft text-church-gray cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  {showAddCell ? 'Cancel' : 'Add Cell'}
                </button>
              </div>

              {!selectedZone && (
                <div className="p-4 bg-church-soft rounded-xl text-center text-church-gray text-sm">
                  Select a zone to manage its cells
                </div>
              )}

              {selectedZone && showAddCell && (
                <form onSubmit={editingCell ? handleUpdateCell : handleAddCell} className="p-4 bg-white rounded-xl border border-church-blue/10 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-church-gray">Cell Name</label>
                    <input
                      type="text"
                      required
                      value={newCellName}
                      onChange={(e) => setNewCellName(e.target.value)}
                      className="w-full p-2 mt-1 rounded-lg bg-church-soft border-2 border-transparent focus:border-church-blue/20"
                      placeholder="Enter cell name..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-church-gray">Description (Optional)</label>
                    <textarea
                      value={newCellDesc}
                      onChange={(e) => setNewCellDesc(e.target.value)}
                      className="w-full p-2 mt-1 rounded-lg bg-church-soft border-2 border-transparent focus:border-church-blue/20"
                      placeholder="Enter cell description..."
                      rows={3}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-2 bg-church-blue text-white rounded-lg font-bold text-xs hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Processing...' : editingCell ? 'Update Cell' : 'Create Cell'}
                  </button>
                </form>
              )}

              {selectedZone && (
                <div className="space-y-2">
                  {cellsForSelectedZone.length === 0 ? (
                    <div className="p-4 bg-church-soft rounded-xl text-center text-church-gray text-sm">
                      No cells yet. Create one to get started.
                    </div>
                  ) : (
                    cellsForSelectedZone.map(cell => (
                      <div key={cell.id} className="p-4 rounded-xl bg-white border border-church-blue/10">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-bold text-church-black">{cell.name}</h4>
                            {cell.description && <p className="text-xs text-church-gray mt-1">{cell.description}</p>}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditCell(cell)}
                              className="p-2 hover:bg-church-soft rounded-lg transition-all"
                            >
                              <Edit2 className="w-4 h-4 text-church-blue" />
                            </button>
                            <button
                              onClick={() => handleDeleteCell(cell.id)}
                              className="p-2 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
