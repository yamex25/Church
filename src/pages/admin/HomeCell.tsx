import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  ChevronDown,
  Users,
  Crown,
  MapPin,
  Filter,
  Download,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { Member, Zone, Cell } from '@/src/types';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, addDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';

export default function HomeCell() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [selectedCell, setSelectedCell] = useState<string>('');
  const [filterByLeader, setFilterByLeader] = useState<'' | 'Cell' | 'Zone'>('');
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [showMembers, setShowMembers] = useState(false);

  // Zone and Cell Management States
  const [showAddZone, setShowAddZone] = useState(false);
  const [showAddCell, setShowAddCell] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneDesc, setNewZoneDesc] = useState('');
  const [newCellName, setNewCellName] = useState('');
  const [newCellDesc, setNewCellDesc] = useState('');
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [editingCell, setEditingCell] = useState<Cell | null>(null);
  const [selectedZoneForCell, setSelectedZoneForCell] = useState<Zone | null>(null);
  const [saving, setSaving] = useState(false);

  // Load Members
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

  // Load Zones
  useEffect(() => {
    const q = query(collection(db, 'zones'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Zone[];
      setZones(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'zones');
    });

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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cells');
    });

    return () => unsubscribe();
  }, []);

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
      setSaving(false);
      setNewZoneName('');
      setNewZoneDesc('');
      setShowAddZone(false);
      alert('Zone created successfully!');
    } catch (error) {
      setSaving(false);
      handleFirestoreError(error, OperationType.WRITE, 'zones');
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
      handleFirestoreError(error, OperationType.WRITE, 'zones');
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Are you sure you want to delete this zone? Any cells under this zone will need to be reassigned.')) return;
    try {
      setSaving(true);
      await deleteDoc(doc(db, 'zones', zoneId));
      setSaving(false);
      alert('Zone deleted successfully!');
    } catch (error) {
      setSaving(false);
      handleFirestoreError(error, OperationType.WRITE, 'zones');
    }
  };

  // Cell Management
  const handleAddCell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZoneForCell || !newCellName.trim()) {
      alert('Please select a zone and enter a cell name');
      return;
    }

    try {
      setSaving(true);
      const docRef = await addDoc(collection(db, 'cells'), {
        name: newCellName.trim(),
        zoneId: selectedZoneForCell.id,
        zoneName: selectedZoneForCell.name,
        description: newCellDesc.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSaving(false);
      setNewCellName('');
      setNewCellDesc('');
      setShowAddCell(false);
      alert('Cell created successfully!');
    } catch (error) {
      setSaving(false);
      handleFirestoreError(error, OperationType.WRITE, 'cells');
    }
  };

  const handleUpdateCell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCell || !newCellName.trim() || !selectedZoneForCell) {
      alert('Please enter all required information');
      return;
    }

    try {
      setSaving(true);
      await updateDoc(doc(db, 'cells', editingCell.id), {
        name: newCellName.trim(),
        zoneId: selectedZoneForCell.id,
        zoneName: selectedZoneForCell.name,
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
      handleFirestoreError(error, OperationType.WRITE, 'cells');
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
      handleFirestoreError(error, OperationType.WRITE, 'cells');
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
    if (zone) setSelectedZoneForCell(zone);
    setNewCellName(cell.name);
    setNewCellDesc(cell.description || '');
    setShowAddCell(true);
  };

  // Filter members based on search and selected filters
  const filteredMembers = members.filter(member => {
    let matchesSearch = true;
    if (searchTerm.trim()) {
      matchesSearch = 
        (member.name && member.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (member.phone && member.phone.includes(searchTerm)) ||
        (member.email && member.email.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    const matchesZone = !selectedZone || member.zone === selectedZone;
    const matchesCell = !selectedCell || member.cell === selectedCell;
    const matchesLeader = !filterByLeader || (member.isLeader && member.leaderType === filterByLeader);

    return matchesSearch && matchesZone && matchesCell && matchesLeader;
  });

  // Get members for a specific zone
  const getMembersInZone = (zoneId: string) => {
    return members.filter(m => m.zone === zoneId);
  };

  // Get cells for a zone
  const getCellsInZone = (zoneId: string) => {
    return cells.filter(c => c.zoneId === zoneId);
  };

  // Get stats
  const stats = {
    totalZones: zones.length,
    totalCells: cells.length,
    totalMembers: members.length,
    cellLeaders: members.filter(m => m.isLeader && m.leaderType === 'Cell').length,
    zonalLeaders: members.filter(m => m.isLeader && m.leaderType === 'Zone').length,
  };

  // Cells filtered by selected zone
  const cellsForSelectedZone = selectedZone ? getCellsInZone(selectedZone) : [];

  const toggleZoneExpand = (zoneId: string) => {
    const newExpanded = new Set(expandedZones);
    if (newExpanded.has(zoneId)) {
      newExpanded.delete(zoneId);
    } else {
      newExpanded.add(zoneId);
    }
    setExpandedZones(newExpanded);
  };

  const downloadReport = () => {
    const report = filteredMembers.map(m => ({
      Name: m.name || 'N/A',
      Email: m.email || 'N/A',
      Phone: m.phone || 'N/A',
      Zone: m.zoneName || 'N/A',
      Cell: m.cellName || 'N/A',
      'Is Leader': m.isLeader ? 'Yes' : 'No',
      'Leader Type': m.leaderType || 'N/A',
      'Membership Status': m.membershipStatus || 'N/A',
    }));

    const csv = [
      Object.keys(report[0] || {}).join(','),
      ...report.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HomeCell_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return <div className="text-center py-12">Loading HomeCell data...</div>;
  }

  return (
    <div className="space-y-8 text-church-black">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-display font-black text-church-black mb-2 tracking-tight">Home Cell Ministry</h2>
          <p className="text-church-gray font-medium">Manage zones, cells, members, and leaders</p>
        </div>
        <button 
          onClick={downloadReport}
          className="flex items-center gap-3 bg-church-yellow text-church-black px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95"
        >
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-6 bg-white rounded-2xl border border-church-blue/10 shadow-lg">
          <div className="text-xs font-bold text-church-gray uppercase mb-2">Total Zones</div>
          <div className="text-3xl font-black text-church-blue">{stats.totalZones}</div>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-church-blue/10 shadow-lg">
          <div className="text-xs font-bold text-church-gray uppercase mb-2">Total Cells</div>
          <div className="text-3xl font-black text-church-blue">{stats.totalCells}</div>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-church-blue/10 shadow-lg">
          <div className="text-xs font-bold text-church-gray uppercase mb-2">Members</div>
          <div className="text-3xl font-black text-church-blue">{stats.totalMembers}</div>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-orange-200/50 shadow-lg bg-orange-50">
          <div className="text-xs font-bold text-orange-600 uppercase mb-2">Cell Leaders</div>
          <div className="text-3xl font-black text-orange-600">{stats.cellLeaders}</div>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-purple-200/50 shadow-lg bg-purple-50">
          <div className="text-xs font-bold text-purple-600 uppercase mb-2">Zonal Leaders</div>
          <div className="text-3xl font-black text-purple-600">{stats.zonalLeaders}</div>
        </div>
      </div>

      {/* View Members Button */}
      {!showMembers && (
        <button
          onClick={() => setShowMembers(true)}
          className="flex items-center gap-3 bg-church-blue text-white px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95"
        >
          <Users className="w-4 h-4" />
          View Members
        </button>
      )}

      {/* Filters and Search */}
      {showMembers && (
      <div className="bg-white p-6 rounded-2xl sm:rounded-[40px] border border-church-blue/5 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-church-blue w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by name, email, phone..."
              className="w-full pl-12 pr-6 py-4 rounded-2xl bg-church-soft border-2 border-transparent focus:outline-none focus:border-church-blue/20 focus:bg-white text-sm placeholder:text-church-gray transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            value={selectedZone}
            onChange={(e) => {
              setSelectedZone(e.target.value);
              setSelectedCell('');
            }}
            className="px-6 py-4 border-2 border-church-blue/10 rounded-2xl text-church-gray bg-white transition-all text-xs font-bold uppercase tracking-widest w-full md:w-auto cursor-pointer focus:outline-none focus:border-church-blue/20"
          >
            <option value="">All Zones</option>
            {zones.map(zone => (
              <option key={zone.id} value={zone.id}>{zone.name}</option>
            ))}
          </select>
          <select 
            value={selectedCell}
            onChange={(e) => setSelectedCell(e.target.value)}
            disabled={!selectedZone}
            className="px-6 py-4 border-2 border-church-blue/10 rounded-2xl text-church-gray bg-white transition-all text-xs font-bold uppercase tracking-widest w-full md:w-auto cursor-pointer focus:outline-none focus:border-church-blue/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">All Cells</option>
            {cellsForSelectedZone.map(cell => (
              <option key={cell.id} value={cell.id}>{cell.name}</option>
            ))}
          </select>
          <select 
            value={filterByLeader}
            onChange={(e) => setFilterByLeader(e.target.value as '' | 'Cell' | 'Zone')}
            className="px-6 py-4 border-2 border-church-blue/10 rounded-2xl text-church-gray bg-white transition-all text-xs font-bold uppercase tracking-widest w-full md:w-auto cursor-pointer focus:outline-none focus:border-church-blue/20"
          >
            <option value="">All Members</option>
            <option value="Cell">Cell Leaders</option>
            <option value="Zone">Zonal Leaders</option>
          </select>
          <button 
            onClick={() => {
              setSearchTerm('');
              setSelectedZone('');
              setSelectedCell('');
              setFilterByLeader('');
            }}
            className="px-6 py-4 border-2 border-church-blue/10 rounded-2xl text-church-gray hover:bg-church-soft transition-all text-xs font-bold uppercase tracking-widest w-full md:w-auto"
          >
            Reset
          </button>
        </div>
      </div>
      )}

      {/* Zone & Members Display */}
      <div className={`${showMembers ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : ''}`}>
        {/* Zone Structure - Always visible */}
        <div className={`${showMembers ? 'lg:col-span-1' : ''} space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-display font-black text-church-black">Zone Structure</h3>
            <button
              onClick={() => {
                setEditingZone(null);
                setNewZoneName('');
                setNewZoneDesc('');
                setShowAddZone(true);
              }}
              className="flex items-center gap-2 bg-church-blue text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all"
            >
              <Plus className="w-3 h-3" />
              Add Zone
            </button>
          </div>
          <div className="space-y-2">
            {zones.map(zone => {
              const zoneMembers = getMembersInZone(zone.id);
              const zoneCells = getCellsInZone(zone.id);
              const isExpanded = expandedZones.has(zone.id);

              return (
                <div key={zone.id} className="bg-white rounded-xl border border-church-blue/10 overflow-hidden">
                  <button
                    onClick={() => toggleZoneExpand(zone.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-church-soft transition-all group"
                  >
                    <div className="text-left">
                      <h4 className="font-bold text-church-black">{zone.name}</h4>
                      <p className="text-xs text-church-gray mt-1">
                        {zoneMembers.length} members • {zoneCells.length} cells
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditZone(zone);
                        }}
                        className="p-2 text-church-blue hover:bg-church-blue/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteZone(zone.id);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-2 bg-church-soft/30 border-t border-church-blue/10">
                      {zoneCells.map(cell => {
                        const cellMembers = members.filter(m => m.cell === cell.id);
                        return (
                          <div key={cell.id} className="p-3 bg-white rounded-lg text-xs group/cell flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-bold text-church-blue">{cell.name}</div>
                              <div className="text-church-gray mt-1">{cellMembers.length} member{cellMembers.length !== 1 ? 's' : ''}</div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEditCell(cell)}
                                className="p-1 text-church-blue hover:bg-church-blue/10 rounded transition-all"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteCell(cell.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => {
                          setEditingCell(null);
                          setSelectedZoneForCell(zone);
                          setNewCellName('');
                          setNewCellDesc('');
                          setShowAddCell(true);
                        }}
                        className="w-full p-2 mt-2 text-xs font-bold text-church-blue border-2 border-dashed border-church-blue/30 rounded-lg hover:bg-church-blue/5 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-3 h-3" />
                        Add Cell
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Members List - Only show when toggled */}
        {showMembers && (
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-display font-black text-church-black">
              Members ({filteredMembers.length})
            </h3>
            <button
              onClick={() => setShowMembers(false)}
              className="text-church-gray hover:text-church-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-white rounded-2xl sm:rounded-[48px] border border-church-blue/5 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans">
                <thead>
                  <tr className="bg-church-blue text-white text-[10px] uppercase tracking-[0.25em] font-black border-b border-white/10">
                    <th className="px-6 py-4 text-left">Name</th>
                    <th className="px-6 py-4">Zone</th>
                    <th className="px-6 py-4">Cell</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-church-soft">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-church-gray">
                        No members found matching your filters
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map(member => (
                      <tr key={member.id} className="hover:bg-church-soft/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-church-black flex items-center gap-2">
                            {member.isLeader && (
                              <Crown className={`w-4 h-4 ${member.leaderType === 'Zone' ? 'text-purple-600' : 'text-orange-600'}`} />
                            )}
                            {member.name}
                          </div>
                          <div className="text-xs text-church-gray mt-1">{member.membershipStatus}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-church-black font-semibold">{member.zoneName || '-'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-church-black font-semibold">{member.cellName || '-'}</div>
                        </td>
                        <td className="px-6 py-4">
                          {member.isLeader ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              member.leaderType === 'Zone'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {member.leaderType} Leader
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-church-soft text-church-gray">Member</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-church-gray">{member.phone}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Add/Edit Zone Modal */}
      {showAddZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display font-black text-church-black">
                {editingZone ? 'Edit Zone' : 'Add New Zone'}
              </h2>
              <button
                onClick={() => {
                  setShowAddZone(false);
                  setEditingZone(null);
                  setNewZoneName('');
                  setNewZoneDesc('');
                }}
                className="text-church-gray hover:text-church-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingZone ? handleUpdateZone : handleAddZone} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-church-gray mb-2">Zone Name *</label>
                <input
                  type="text"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder="Enter zone name"
                  className="w-full px-4 py-3 border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue/30 bg-church-soft"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-church-gray mb-2">Description</label>
                <textarea
                  value={newZoneDesc}
                  onChange={(e) => setNewZoneDesc(e.target.value)}
                  placeholder="Enter zone description (optional)"
                  className="w-full px-4 py-3 border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue/30 bg-church-soft resize-none"
                  rows={3}
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-church-blue text-white py-3 rounded-2xl font-bold text-sm uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingZone ? 'Update Zone' : 'Create Zone'}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add/Edit Cell Modal */}
      {showAddCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display font-black text-church-black">
                {editingCell ? 'Edit Cell' : 'Add New Cell'}
              </h2>
              <button
                onClick={() => {
                  setShowAddCell(false);
                  setEditingCell(null);
                  setNewCellName('');
                  setNewCellDesc('');
                  setSelectedZoneForCell(null);
                }}
                className="text-church-gray hover:text-church-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingCell ? handleUpdateCell : handleAddCell} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-church-gray mb-2">Zone *</label>
                <select
                  value={selectedZoneForCell?.id || ''}
                  onChange={(e) => {
                    const zone = zones.find(z => z.id === e.target.value);
                    setSelectedZoneForCell(zone || null);
                  }}
                  className="w-full px-4 py-3 border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue/30 bg-church-soft"
                >
                  <option value="">Select a zone</option>
                  {zones.map(zone => (
                    <option key={zone.id} value={zone.id}>{zone.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-church-gray mb-2">Cell Name *</label>
                <input
                  type="text"
                  value={newCellName}
                  onChange={(e) => setNewCellName(e.target.value)}
                  placeholder="Enter cell name"
                  className="w-full px-4 py-3 border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue/30 bg-church-soft"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-church-gray mb-2">Description</label>
                <textarea
                  value={newCellDesc}
                  onChange={(e) => setNewCellDesc(e.target.value)}
                  placeholder="Enter cell description (optional)"
                  className="w-full px-4 py-3 border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue/30 bg-church-soft resize-none"
                  rows={3}
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-church-blue text-white py-3 rounded-2xl font-bold text-sm uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingCell ? 'Update Cell' : 'Create Cell'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
