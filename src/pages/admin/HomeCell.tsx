import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  ChevronDown,
  Users,
  Crown,
  Download,
  Edit2,
  Trash2,
  X,
  Eye,
  Hash
} from 'lucide-react';
import { Member, Zone, Cell } from '@/src/types';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import {
  collection, onSnapshot, query, orderBy,
  doc, addDoc, deleteDoc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
type MemberPanel =
  | { kind: 'members'; scope: 'zone' | 'cell'; id: string; name: string; code?: string }
  | { kind: 'cells'; id: string; name: string; code?: string }
  | null;

export default function HomeCell() {
  const { churchId } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Member panel
  const [memberPanel, setMemberPanel] = useState<MemberPanel>(null);
  const [memberSearch, setMemberSearch] = useState('');

  // Zone form
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneForm, setZoneForm] = useState({ name: '', code: '', description: '' });

  // Cell form
  const [showCellModal, setShowCellModal] = useState(false);
  const [editingCell, setEditingCell] = useState<Cell | null>(null);
  const [cellForm, setCellForm] = useState({ name: '', code: '', description: '' });
  const [cellZone, setCellZone] = useState<Zone | null>(null);

  useEffect(() => {
    if (!churchId) return;
    const q = query(collection(db, 'churches', churchId!, 'members'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Member[]);
      setLoading(false);
    }, err => handleFirestoreError(err, OperationType.LIST, 'members'));
  }, [churchId]);

  useEffect(() => {
    if (!churchId) return;
    const q = query(collection(db, 'churches', churchId!, 'zones'), orderBy('name', 'asc'));
    return onSnapshot(q, snap => {
      setZones(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Zone[]);
    }, err => handleFirestoreError(err, OperationType.LIST, 'zones'));
  }, [churchId]);

  useEffect(() => {
    if (!churchId) return;
    const q = query(collection(db, 'churches', churchId!, 'cells'), orderBy('name', 'asc'));
    return onSnapshot(q, snap => {
      setCells(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Cell[]);
    }, err => handleFirestoreError(err, OperationType.LIST, 'cells'));
  }, [churchId]);

  // Helpers
  const getCellsInZone = (zoneId: string) => cells.filter(c => c.zoneId === zoneId);
  const getMembersInZone = (zoneId: string) => members.filter(m => m.zone === zoneId);
  const getMembersInCell = (cellId: string) => members.filter(m => m.cell === cellId);
  const getZoneLeader = (zoneId: string) => members.find(m => m.zone === zoneId && m.isLeader && m.leaderType === 'Zone');
  const getCellLeader = (cellId: string) => members.find(m => m.cell === cellId && m.isLeader && m.leaderType === 'Cell');

  const isZoneCodeUnique = (code: string, excludeId?: string) =>
    !zones.some(z => z.code?.toUpperCase() === code.toUpperCase() && z.id !== excludeId);

  const isCellCodeUnique = (code: string, excludeId?: string) =>
    !cells.some(c => c.code?.toUpperCase() === code.toUpperCase() && c.id !== excludeId);

  // Zone CRUD
  const openZoneModal = (zone?: Zone) => {
    setEditingZone(zone || null);
    setZoneForm({ name: zone?.name || '', code: zone?.code || '', description: zone?.description || '' });
    setShowZoneModal(true);
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = zoneForm.name.trim();
    const code = zoneForm.code.trim().toUpperCase();
    if (!name) return alert('Zone name is required.');
    if (!code) return alert('Zone code is required.');
    if (!isZoneCodeUnique(code, editingZone?.id)) {
      return alert(`Code "${code}" is already used by another zone. Codes must be unique.`);
    }
    try {
      setSaving(true);
      const payload = { name, code, description: zoneForm.description.trim(), updatedAt: serverTimestamp() };
      if (editingZone) {
        await updateDoc(doc(db, 'churches', churchId!, 'zones', editingZone.id), payload);
      } else {
        await addDoc(collection(db, 'churches', churchId!, 'zones'), { ...payload, createdAt: serverTimestamp() });
      }
      setShowZoneModal(false);
      setEditingZone(null);
      setZoneForm({ name: '', code: '', description: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'zones');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Delete this zone? Cells under it will need reassignment.')) return;
    try {
      await deleteDoc(doc(db, 'churches', churchId!, 'zones', zoneId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'zones');
    }
  };

  // Cell CRUD
  const openCellModal = (zone?: Zone | null, cell?: Cell) => {
    setEditingCell(cell || null);
    const parentZone = zone || (cell ? zones.find(z => z.id === cell.zoneId) || null : null);
    setCellZone(parentZone || null);
    setCellForm({ name: cell?.name || '', code: cell?.code || '', description: cell?.description || '' });
    setShowCellModal(true);
  };

  const handleSaveCell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cellZone) return alert('Please select a zone.');
    const name = cellForm.name.trim();
    const code = cellForm.code.trim().toUpperCase();
    if (!name) return alert('Cell name is required.');
    if (!code) return alert('Cell code is required.');
    if (!isCellCodeUnique(code, editingCell?.id)) {
      return alert(`Code "${code}" is already used by another cell. Codes must be unique.`);
    }
    try {
      setSaving(true);
      const payload = {
        name, code,
        zoneId: cellZone.id,
        zoneName: cellZone.name,
        description: cellForm.description.trim(),
        updatedAt: serverTimestamp(),
      };
      if (editingCell) {
        await updateDoc(doc(db, 'churches', churchId!, 'cells', editingCell.id), payload);
      } else {
        await addDoc(collection(db, 'churches', churchId!, 'cells'), { ...payload, createdAt: serverTimestamp() });
      }
      setShowCellModal(false);
      setEditingCell(null);
      setCellForm({ name: '', code: '', description: '' });
      setCellZone(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'cells');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCell = async (cellId: string) => {
    if (!confirm('Delete this cell? Members assigned here will need reassignment.')) return;
    try {
      await deleteDoc(doc(db, 'churches', churchId!, 'cells', cellId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'cells');
    }
  };

  const toggleZone = (id: string) => {
    const next = new Set(expandedZones);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedZones(next);
  };

  const openMemberPanel = (scope: 'zone' | 'cell', id: string, name: string, code?: string) => {
    setMemberPanel({ kind: 'members', scope, id, name, code });
    setMemberSearch('');
  };

  const openCellsPanel = (id: string, name: string, code?: string) => {
    setMemberPanel({ kind: 'cells', id, name, code });
    setMemberSearch('');
  };

  const downloadReport = () => {
    const rows = members
      .filter(m => m.zone)
      .map(m => ({
        Name: m.name || '',
        Phone: m.phone || '',
        Zone: m.zoneName || '',
        Cell: m.cellName || '',
        Leader: m.isLeader ? `${m.leaderType} Leader` : 'Member',
        Status: m.membershipStatus || '',
      }));
    if (!rows.length) return alert('No members with zone assignments to export.');
    const header = Object.keys(rows[0]).join(',');
    const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `HomeCell_Report_${new Date().toISOString().split('T')[0]}.csv`,
    });
    a.click();
  };

  const panelMembers = memberPanel?.kind === 'members'
    ? (memberPanel.scope === 'zone' ? getMembersInZone(memberPanel.id) : getMembersInCell(memberPanel.id))
        .filter(m =>
          !memberSearch ||
          m.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
          m.phone?.includes(memberSearch)
        )
    : [];

  const panelCells = memberPanel?.kind === 'cells'
    ? getCellsInZone(memberPanel.id).filter(c =>
        !memberSearch ||
        c.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        (c.code ?? '').toLowerCase().includes(memberSearch.toLowerCase())
      )
    : [];

  const stats = {
    zones: zones.length,
    cells: cells.length,
    assigned: members.filter(m => m.zone).length,
    cellLeaders: members.filter(m => m.isLeader && m.leaderType === 'Cell').length,
    zoneLeaders: members.filter(m => m.isLeader && m.leaderType === 'Zone').length,
  };

  if (loading) return <div className="text-center py-12 text-church-gray">Loading...</div>;

  return (
    <div className="space-y-8 text-church-black">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-display font-black text-church-black mb-2 tracking-tight">Home Cell Ministry</h2>
          <p className="text-church-gray font-medium">Zones, cells, and member assignments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadReport}
            className="flex items-center gap-2 border-2 border-church-blue/10 text-church-gray px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-church-soft transition-all"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => openZoneModal()}
            className="flex items-center gap-2 bg-church-blue text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-church-blue/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Zone
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Zones', value: stats.zones, color: 'text-church-blue' },
          { label: 'Cells', value: stats.cells, color: 'text-church-blue' },
          { label: 'Assigned Members', value: stats.assigned, color: 'text-church-blue' },
          { label: 'Cell Leaders', value: stats.cellLeaders, color: 'text-orange-600' },
          { label: 'Zone Leaders', value: stats.zoneLeaders, color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-church-blue/10 shadow-sm p-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-church-gray mb-2">{s.label}</div>
            <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className={`grid grid-cols-1 gap-6 transition-all ${memberPanel ? 'lg:grid-cols-5' : ''}`}>

        {/* Zone structure */}
        <div className={memberPanel ? 'lg:col-span-3' : ''}>
          <div className="space-y-3">
            {zones.length === 0 && (
              <div className="bg-white rounded-2xl border-2 border-dashed border-church-blue/10 p-12 text-center">
                <Users className="w-10 h-10 text-church-blue/20 mx-auto mb-4" />
                <p className="text-church-gray font-medium">No zones yet. Click "Add Zone" to get started.</p>
              </div>
            )}
            {zones.map(zone => {
              const zoneCells = getCellsInZone(zone.id);
              const zoneMembers = getMembersInZone(zone.id);
              const zoneLeader = getZoneLeader(zone.id);
              const isExpanded = expandedZones.has(zone.id);
              const isActive = memberPanel !== null && memberPanel.id === zone.id;

              return (
                <div
                  key={zone.id}
                  className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all ${isActive ? 'border-church-blue/40 shadow-church-blue/10 shadow-md' : 'border-church-blue/10'}`}
                >
                  {/* Zone row */}
                  <div className="p-5 flex items-start gap-4 group">
                    <button
                      onClick={() => toggleZone(zone.id)}
                      className="mt-1 flex-shrink-0 text-church-gray hover:text-church-blue transition-colors"
                    >
                      <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-black text-church-black text-lg leading-tight">{zone.name}</span>
                        {zone.code && (
                          <span className="inline-flex items-center gap-1 bg-church-blue text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                            <Hash className="w-2.5 h-2.5" />{zone.code}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-church-gray font-medium">
                        <span>{zoneCells.length} {zoneCells.length === 1 ? 'cell' : 'cells'}</span>
                        <span>·</span>
                        <span>{zoneMembers.length} members</span>
                        {zoneLeader && (
                          <>
                            <span>·</span>
                            <span className="text-purple-600 flex items-center gap-1">
                              <Crown className="w-3 h-3" /> {zoneLeader.name}
                            </span>
                          </>
                        )}
                        {zone.description && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-xs">{zone.description}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openCellsPanel(zone.id, zone.name, zone.code)}
                        title="View cells in this zone"
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-church-gray border border-church-blue/15 rounded-lg hover:bg-church-soft transition-all"
                      >
                        <Eye className="w-3 h-3" />
                        {zoneCells.length} {zoneCells.length === 1 ? 'cell' : 'cells'}
                      </button>
                      <button
                        onClick={() => openMemberPanel('zone', zone.id, zone.name, zone.code)}
                        title="View members in this zone"
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-church-blue border border-church-blue/20 rounded-lg hover:bg-church-blue/5 transition-all"
                      >
                        <Users className="w-3 h-3" />
                        {zoneMembers.length} members
                      </button>
                      <button
                        onClick={() => openCellModal(zone)}
                        title="Add cell to zone"
                        className="p-2 text-church-blue hover:bg-church-blue/5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openZoneModal(zone)}
                        className="p-2 text-church-gray hover:bg-church-soft rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteZone(zone.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Cells (expanded) */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-church-soft"
                      >
                        <div className="p-4 bg-church-soft/30">
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {zoneCells.map(cell => {
                              const cellCount = getMembersInCell(cell.id).length;
                              const cellLeader = getCellLeader(cell.id);
                              const isCellActive = memberPanel?.kind === 'members' && memberPanel.scope === 'cell' && memberPanel.id === cell.id;

                              return (
                                <div
                                  key={cell.id}
                                  className={`bg-white rounded-xl border p-4 group/cell transition-all ${isCellActive ? 'border-church-blue/40 shadow-sm shadow-church-blue/10' : 'border-church-blue/5'}`}
                                >
                                  <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                        <span className="font-bold text-sm text-church-black truncate">{cell.name}</span>
                                        {cell.code && (
                                          <span className="inline-flex items-center gap-0.5 bg-church-yellow/30 text-church-black text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
                                            <Hash className="w-2 h-2" />{cell.code}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-church-gray">
                                        {cellCount} member{cellCount !== 1 ? 's' : ''}
                                        {cellLeader && (
                                          <span className="ml-1 text-orange-600"> · {cellLeader.name}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/cell:opacity-100 transition-opacity flex-shrink-0">
                                      <button
                                        onClick={() => openCellModal(null, cell)}
                                        className="p-1.5 text-church-gray hover:bg-church-soft rounded-lg transition-all"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteCell(cell.id)}
                                        className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-all"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => openMemberPanel('cell', cell.id, cell.name, cell.code)}
                                    className="w-full text-center text-[11px] font-bold text-church-blue border border-church-blue/15 rounded-lg py-1.5 hover:bg-church-blue/5 transition-all"
                                  >
                                    View {cellCount} Member{cellCount !== 1 ? 's' : ''}
                                  </button>
                                </div>
                              );
                            })}

                            {/* Add cell button */}
                            <button
                              onClick={() => openCellModal(zone)}
                              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-church-blue/15 p-4 text-church-blue hover:bg-church-blue/5 hover:border-church-blue/30 transition-all min-h-[80px]"
                            >
                              <Plus className="w-5 h-5" />
                              <span className="text-[11px] font-bold uppercase tracking-wider">Add Cell</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Member panel */}
        <AnimatePresence>
          {memberPanel && (
            <motion.div
              key="member-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="lg:col-span-2 bg-white rounded-2xl border border-church-blue/10 shadow-lg overflow-hidden flex flex-col"
              style={{ maxHeight: '75vh', position: 'sticky', top: '1.5rem' }}
            >
              {/* Panel header */}
              <div className="p-5 bg-church-blue text-white flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded uppercase font-black tracking-wider">
                        {memberPanel.kind === 'cells' ? 'zone cells' : memberPanel.scope}
                      </span>
                      <span className="font-black text-base leading-tight truncate">{memberPanel.name}</span>
                      {memberPanel.code && (
                        <span className="inline-flex items-center gap-0.5 bg-church-yellow text-church-black text-[9px] font-black uppercase px-2 py-0.5 rounded">
                          <Hash className="w-2.5 h-2.5" />{memberPanel.code}
                        </span>
                      )}
                    </div>
                    <p className="text-blue-200 text-xs">
                      {memberPanel.kind === 'cells'
                        ? `${getCellsInZone(memberPanel.id).length} cells`
                        : `${memberPanel.scope === 'zone' ? getMembersInZone(memberPanel.id).length : getMembersInCell(memberPanel.id).length} members`}
                    </p>
                  </div>
                  <button
                    onClick={() => { setMemberPanel(null); setMemberSearch(''); }}
                    className="flex-shrink-0 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="px-4 py-3 border-b border-church-soft flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-church-gray w-4 h-4" />
                  <input
                    type="text"
                    placeholder={memberPanel.kind === 'cells' ? 'Search cells...' : 'Search by name or phone...'}
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-church-soft border-2 border-transparent focus:outline-none focus:border-church-blue/20 text-sm placeholder:text-church-gray transition-all"
                  />
                </div>
              </div>

              {/* Panel body — cells list */}
              {memberPanel.kind === 'cells' && (
                <div className="flex-1 overflow-y-auto divide-y divide-church-soft">
                  {panelCells.length === 0 && (
                    <div className="py-16 text-center">
                      <Eye className="w-8 h-8 text-church-blue/20 mx-auto mb-3" />
                      <p className="text-church-gray text-sm font-medium">
                        {memberSearch ? 'No matching cells' : 'No cells in this zone yet'}
                      </p>
                    </div>
                  )}
                  {panelCells.map(cell => {
                    const count = getMembersInCell(cell.id).length;
                    const leader = getCellLeader(cell.id);
                    return (
                      <div key={cell.id} className="px-4 py-4 hover:bg-church-soft/40 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-bold text-sm text-church-black truncate">{cell.name}</span>
                              {cell.code && (
                                <span className="inline-flex items-center gap-0.5 bg-church-yellow/30 text-church-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                                  <Hash className="w-2 h-2" />{cell.code}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-church-gray">
                              {count} member{count !== 1 ? 's' : ''}
                              {leader && (
                                <span className="ml-1.5 text-orange-600 flex items-center gap-1 inline-flex">
                                  <Crown className="w-3 h-3" />{leader.name}
                                </span>
                              )}
                            </div>
                            {cell.description && (
                              <p className="text-[11px] text-church-gray mt-1 truncate">{cell.description}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => openMemberPanel('cell', cell.id, cell.name, cell.code)}
                          className="w-full text-[11px] font-bold text-church-blue border border-church-blue/15 rounded-lg py-1.5 hover:bg-church-blue/5 transition-all text-center"
                        >
                          View {count} Member{count !== 1 ? 's' : ''}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Panel body — members list */}
              {memberPanel.kind === 'members' && (
                <div className="flex-1 overflow-y-auto divide-y divide-church-soft">
                  {panelMembers.length === 0 && (
                    <div className="py-16 text-center">
                      <Users className="w-8 h-8 text-church-blue/20 mx-auto mb-3" />
                      <p className="text-church-gray text-sm font-medium">
                        {memberSearch ? 'No matching members' : 'No members assigned here yet'}
                      </p>
                    </div>
                  )}
                  {panelMembers.map(member => (
                    <div key={member.id} className="px-4 py-3 hover:bg-church-soft/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-church-yellow flex items-center justify-center font-black text-[10px] text-church-black flex-shrink-0">
                          {(member.name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {member.isLeader && (
                              <Crown className={`w-3 h-3 flex-shrink-0 ${member.leaderType === 'Zone' ? 'text-purple-500' : 'text-orange-500'}`} />
                            )}
                            <span className="font-bold text-sm text-church-black truncate">{member.name}</span>
                          </div>
                          <div className="text-[11px] text-church-gray mt-0.5">{member.phone}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {member.isLeader && (
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${member.leaderType === 'Zone' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                              {member.leaderType}
                            </span>
                          )}
                          {memberPanel.scope === 'zone' && member.cellName && (
                            <span className="text-[9px] text-church-gray bg-church-soft px-1.5 py-0.5 rounded font-medium">
                              {member.cellName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Panel footer */}
              <div className="px-4 py-3 border-t border-church-soft bg-church-soft/30 flex-shrink-0">
                <p className="text-[10px] text-church-gray font-bold uppercase tracking-widest text-center">
                  {memberPanel.kind === 'cells'
                    ? `Showing ${panelCells.length} of ${getCellsInZone(memberPanel.id).length} cells`
                    : `Showing ${panelMembers.length} of ${memberPanel.scope === 'zone' ? getMembersInZone(memberPanel.id).length : getMembersInCell(memberPanel.id).length} members`}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Zone Modal */}
      <AnimatePresence>
        {showZoneModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-black text-church-black">
                  {editingZone ? 'Edit Zone' : 'Add New Zone'}
                </h2>
                <button
                  onClick={() => { setShowZoneModal(false); setEditingZone(null); setZoneForm({ name: '', code: '', description: '' }); }}
                  className="p-2 text-church-gray hover:bg-church-soft rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveZone} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-church-gray mb-2 ml-1">Zone Name *</label>
                  <input
                    type="text"
                    value={zoneForm.name}
                    onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. North Zone"
                    className="w-full px-5 py-3.5 border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue/30 bg-church-soft text-sm font-bold transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-church-gray mb-2 ml-1">
                    Zone Code * <span className="normal-case font-medium text-church-gray/60">(must be unique)</span>
                  </label>
                  <input
                    type="text"
                    value={zoneForm.code}
                    onChange={e => setZoneForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. Z-001"
                    className="w-full px-5 py-3.5 border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue/30 bg-church-soft text-sm font-black tracking-widest uppercase transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-church-gray mb-2 ml-1">Description</label>
                  <textarea
                    value={zoneForm.description}
                    onChange={e => setZoneForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional notes about this zone"
                    className="w-full px-5 py-3.5 border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue/30 bg-church-soft text-sm font-medium resize-none transition-all"
                    rows={3}
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-church-blue text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-church-blue/20 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingZone ? 'Update Zone' : 'Create Zone'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cell Modal */}
      <AnimatePresence>
        {showCellModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-black text-church-black">
                  {editingCell ? 'Edit Cell' : 'Add New Cell'}
                </h2>
                <button
                  onClick={() => { setShowCellModal(false); setEditingCell(null); setCellForm({ name: '', code: '', description: '' }); setCellZone(null); }}
                  className="p-2 text-church-gray hover:bg-church-soft rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCell} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-church-gray mb-2 ml-1">Zone *</label>
                  <select
                    value={cellZone?.id || ''}
                    onChange={e => setCellZone(zones.find(z => z.id === e.target.value) || null)}
                    className="w-full px-5 py-3.5 border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue/30 bg-church-soft text-sm font-bold transition-all"
                  >
                    <option value="">Select a zone</option>
                    {zones.map(z => (
                      <option key={z.id} value={z.id}>{z.name}{z.code ? ` (${z.code})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-church-gray mb-2 ml-1">Cell Name *</label>
                  <input
                    type="text"
                    value={cellForm.name}
                    onChange={e => setCellForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Grace Cell"
                    className="w-full px-5 py-3.5 border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue/30 bg-church-soft text-sm font-bold transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-church-gray mb-2 ml-1">
                    Cell Code * <span className="normal-case font-medium text-church-gray/60">(must be unique)</span>
                  </label>
                  <input
                    type="text"
                    value={cellForm.code}
                    onChange={e => setCellForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. C-001"
                    className="w-full px-5 py-3.5 border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue/30 bg-church-soft text-sm font-black tracking-widest uppercase transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-church-gray mb-2 ml-1">Description</label>
                  <textarea
                    value={cellForm.description}
                    onChange={e => setCellForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional notes about this cell"
                    className="w-full px-5 py-3.5 border-2 border-church-blue/10 rounded-2xl focus:outline-none focus:border-church-blue/30 bg-church-soft text-sm font-medium resize-none transition-all"
                    rows={3}
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-church-blue text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-church-blue/20 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingCell ? 'Update Cell' : 'Create Cell'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
