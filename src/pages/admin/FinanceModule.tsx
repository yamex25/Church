import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  DollarSign,
  TrendingUp,
  Download,
  Plus,
  Search,
  X,
  CalendarDays,
  ArrowRightLeft,
  TrendingDown,
  Wallet,
  Filter,
  ExternalLink
} from 'lucide-react';
import { ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { formatCurrency, formatDate, downloadExcel, cn } from '@/src/lib/utils';
import { TransactionType, FinanceRecord, ExpenseType, Expense } from '@/src/types';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, where } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';

export default function FinanceModule() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterPeriodType, setFilterPeriodType] = useState<'month' | 'year'>('month');
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [services, setServices] = useState<{id: string, name: string}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string, projectId?: string}[]>([]);
  const [customTypes, setCustomTypes] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showReports, setShowReports] = useState(false);
  const [activeTab, setActiveTab] = useState<'income' | 'expenses' | 'dashboard'>('dashboard');
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectData, setNewProjectData] = useState({ name: '', description: '', targetAmount: 0, startDate: '', endDate: '', status: 'Active', projectId: '' });
  
  const initialRecordState: {
    memberName: string;
    type: TransactionType | string;
    amount: number;
    category: string;
    description: string;
    serviceName: string;
    date: string;
  } = {
    memberName: '',
    type: TransactionType.TITHE,
    amount: 0,
    category: 'Main',
    description: '',
    serviceName: 'Sunday Morning Service',
    date: new Date().toISOString().split('T')[0]
  };

  const [newRecord, setNewRecord] = useState<typeof initialRecordState>(initialRecordState);

  const initialExpenseState = {
    type: ExpenseType.SALARY,
    category: '',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0]
  };

  const [newExpense, setNewExpense] = useState(initialExpenseState);

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
    // Fetch Expenses
    const expenseQuery = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribeExpenses = onSnapshot(expenseQuery, (snapshot) => {
      const expenseDocs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      setExpenses(expenseDocs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    return () => unsubscribeExpenses();
  }, []);

  useEffect(() => {
    // Fetch Services
    const unsubscribeServices = onSnapshot(query(collection(db, 'services'), orderBy('name', 'asc')), (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });

    // Fetch Projects
    const unsubscribeProjects = onSnapshot(query(collection(db, 'projects'), orderBy('name', 'asc')), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, projectId: doc.data().projectId || doc.id, name: doc.data().name })));
    });

    return () => {
      unsubscribeServices();
      unsubscribeProjects();
    };
  }, []);

  useEffect(() => {
    const unsubscribeCustomTypes = onSnapshot(query(collection(db, 'financeTypes'), orderBy('name', 'asc')), (snapshot) => {
      setCustomTypes(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });

    return () => unsubscribeCustomTypes();
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
          await addDoc(collection(db, 'projects'), { projectId: `PRJ_${p.trim().toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`, name: p, createdAt: serverTimestamp() });
        }
      }
      alert("Financial categories initialized.");
    } catch (error) {
      console.error("Initialization error:", error);
    }
  };

  const handleAddNewType = async () => {
    if (!newTypeName.trim()) {
      alert("Type name is required");
      return;
    }
    if (!user) {
      alert("You must be logged in to add a type");
      return;
    }
    try {
      // Generate a unique ID for the custom type
      const typeId = `CUSTOM_${newTypeName.trim().toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`;
      
      console.log("Adding custom type with data:", {
        type: newTypeName.trim(),
        typeId: typeId,
      });
      
      const docRef = await addDoc(collection(db, 'financeTypes'), {
        name: newTypeName.trim(),
        typeId: typeId,
        createdBy: user?.uid,
        createdAt: serverTimestamp()
      });
      console.log("Custom type created with ID:", docRef.id);
      setNewTypeName('');
      setShowAddTypeModal(false);
      alert("New type added successfully.");
    } catch (error) {
      console.error("Error adding type:", error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to add new type: ${message}`);
    }
  };

  const handleAddNewService = async () => {
    if (!newServiceName.trim()) {
      alert("Service name is required");
      return;
    }
    if (!user) {
      alert("You must be logged in to add a service");
      return;
    }
    try {
      const serviceId = `SRV_${newServiceName.trim().toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`;
      console.log("Adding service with data:", {
        name: newServiceName,
        id: serviceId,
      });
      const docRef = await addDoc(collection(db, 'services'), { 
        name: newServiceName, 
        id: serviceId,
        createdAt: serverTimestamp() 
      });
      console.log("Service created with ID:", docRef.id);
      setNewServiceName('');
      setShowAddServiceModal(false);
      alert("New service added successfully.");
    } catch (error) {
      console.error("Error adding service:", error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to add new service: ${message}`);
    }
  };

  const handleAddNewProject = async () => {
    if (!newProjectData.name.trim()) {
      alert("Project name is required");
      return;
    }
    if (!user) {
      alert("You must be logged in to add a project");
      return;
    }
    try {
      console.log("Adding project with data:", {
        name: newProjectData.name.trim(),
        targetAmount: newProjectData.targetAmount || 0,
        status: newProjectData.status || 'Active',
        description: newProjectData.description || '',
        startDate: newProjectData.startDate || null,
        endDate: newProjectData.endDate || null,
        createdBy: user?.displayName || user?.email || 'Staff',
      });
      const projectId = `PRJ_${newProjectData.name.trim().toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`;
      const docRef = await addDoc(collection(db, 'projects'), { 
        projectId,
        name: newProjectData.name.trim(), 
        targetAmount: newProjectData.targetAmount || 0,
        status: newProjectData.status || 'Active',
        description: newProjectData.description || '',
        startDate: newProjectData.startDate || null,
        endDate: newProjectData.endDate || null,
        createdBy: user?.displayName || user?.email || 'Staff',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log("Project created with ID:", docRef.id);
      setNewProjectData({ name: '', description: '', targetAmount: 0, startDate: '', endDate: '', status: 'Active', projectId: '' });
      setShowAddProjectModal(false);
      alert("New project added successfully.");
    } catch (error) {
      console.error("Error adding project:", error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to add new project: ${message}`);
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amount = Number(newRecord.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }

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
    const exportData = records.map((record, index) => ({
      ID: index + 1,
      Amount: record.amount,
      Category: record.category,
      ServiceName: record.serviceName || '',
      Date: record.date
    }));
    downloadExcel(exportData, `graceflow_finance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Expense Handlers
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingExpense) {
        const docRef = doc(db, 'expenses', editingExpense.id!);
        await updateDoc(docRef, {
          ...newExpense,
          amount: Number(newExpense.amount),
          date: new Date(newExpense.date).toISOString(),
          updatedAt: serverTimestamp()
        });
        alert("Expense updated successfully.");
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...newExpense,
          amount: Number(newExpense.amount),
          date: new Date(newExpense.date).toISOString(),
          recordedBy: user.uid,
          createdAt: serverTimestamp(),
          status: 'approved'
        });
        alert("Expense recorded successfully.");
      }
      setShowExpenseForm(false);
      setEditingExpense(null);
      setNewExpense(initialExpenseState);
    } catch (error) {
      handleFirestoreError(error, editingExpense ? OperationType.UPDATE : OperationType.CREATE, 'expenses');
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setNewExpense({
      type: expense.type,
      category: expense.category || '',
      description: expense.description || '',
      amount: expense.amount,
      date: expense.date.split('T')[0]
    });
    setShowExpenseForm(true);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
      alert("Expense deleted successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'expenses');
    }
  };

  // Filter records and expenses by period
  const getFilteredData = (data: any[], dateField: string) => {
    return data.filter(item => {
      // Extract date string in ISO format (2026-05-15T...)
      const dateStr = item[dateField];
      // Get YYYY-MM and YYYY from the ISO string directly to avoid timezone issues
      const itemMonth = dateStr.slice(0, 7);
      const itemYear = dateStr.slice(0, 4);

      if (filterPeriodType === 'month') {
        return itemMonth === filterMonth;
      } else {
        return itemYear === filterYear;
      }
    });
  };

  const filteredIncomeRecords = getFilteredData(records, 'date');
  const filteredExpenses = getFilteredData(expenses, 'date');

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

  // Calculate filtered period totals
  const filteredPeriodTotals = {
    income: filteredIncomeRecords.reduce((sum, r) => sum + r.amount, 0),
    expenses: filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    serviceBreakdown: {} as Record<string, number>,
    expenseBreakdown: {} as Record<string, number>
  };

  // Calculate service breakdown for filtered period
  filteredIncomeRecords.forEach(record => {
    const serviceName = record.serviceName || 'Standard Service';
    filteredPeriodTotals.serviceBreakdown[serviceName] = 
      (filteredPeriodTotals.serviceBreakdown[serviceName] || 0) + record.amount;
  });

  // Calculate expense breakdown by type for filtered period
  filteredExpenses.forEach(expense => {
    const expenseType = expense.type || 'Other';
    filteredPeriodTotals.expenseBreakdown[expenseType] = 
      (filteredPeriodTotals.expenseBreakdown[expenseType] || 0) + expense.amount;
  });

  const availableBalance = filteredPeriodTotals.income - filteredPeriodTotals.expenses;

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Finance Dashboard</h2>
          <p className="text-slate-500 text-sm">Manage income, expenses, and cash flow.</p>
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
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Income
          </button>
          <button 
            onClick={() => setShowExpenseForm(true)}
            className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-orange-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
          <Link 
            to="/admin/daily-expenses"
            className="flex items-center gap-2 border border-orange-200 text-orange-600 px-4 py-2 rounded-xl font-semibold hover:bg-orange-50 transition-colors shadow-sm"
          >
            <ExternalLink className="w-4 h-4" />
            View Expenses
          </Link>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Filter By</label>
            <select 
              value={filterPeriodType}
              onChange={(e) => setFilterPeriodType(e.target.value as 'month' | 'year')}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium"
            >
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </div>

          {filterPeriodType === 'month' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Select Month</label>
              <input 
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium"
              />
            </div>
          )}

          {filterPeriodType === 'year' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Select Year</label>
              <select 
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium"
              >
                {Array.from({ length: 21 }, (_, i) => 2026 + i).map(year => (
                  <option key={year} value={year.toString()}>{year}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-end">
            <button 
              onClick={() => {
                setFilterMonth(new Date().toISOString().slice(0, 7));
                setFilterYear(new Date().getFullYear().toString());
              }}
              className="w-full px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-all"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Main Dashboard - KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Income Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-3xl border border-emerald-200 shadow-lg relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-16 h-16" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Total Income</h3>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-900 mb-1">{formatCurrency(filteredPeriodTotals.income)}</p>
            <p className="text-[10px] text-emerald-700 font-medium">
              {filterPeriodType === 'month' ? new Date(filterMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `Year ${filterYear}`}
            </p>
          </div>
        </motion.div>

        {/* Total Expenses Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-3xl border border-orange-200 shadow-lg relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingDown className="w-16 h-16" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-orange-600 uppercase tracking-widest">Total Expenses</h3>
              <TrendingDown className="w-4 h-4 text-orange-600" />
            </div>
            <p className="text-2xl font-black text-orange-900 mb-1">{formatCurrency(filteredPeriodTotals.expenses)}</p>
            <p className="text-[10px] text-orange-700 font-medium">
              Salaries & Requisitions
            </p>
          </div>
        </motion.div>

        {/* Available Cash Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`p-4 rounded-3xl border shadow-lg relative overflow-hidden group ${
            availableBalance >= 0 
              ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200' 
              : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
          }`}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Wallet className={`w-16 h-16 ${availableBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-xs font-bold uppercase tracking-widest ${availableBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                Available Cash
              </h3>
              <Wallet className={`w-4 h-4 ${availableBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
            </div>
            <p className={`text-2xl font-black mb-1 ${availableBalance >= 0 ? 'text-blue-900' : 'text-red-900'}`}>
              {formatCurrency(availableBalance)}
            </p>
            <p className={`text-[10px] font-medium ${availableBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
              {availableBalance >= 0 ? 'Healthy balance' : 'Deficit'}
            </p>
          </div>
        </motion.div>
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Contribution Title</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    value={newRecord.memberName}
                    onChange={(e) => setNewRecord({...newRecord, memberName: e.target.value})}
                    placeholder="Enter contribution title..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Type</label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                      value={newRecord.type}
                      onChange={(e) => {
                        if (e.target.value === 'ADD_NEW') {
                          setShowAddTypeModal(true);
                        } else {
                          setNewRecord({...newRecord, type: e.target.value as TransactionType | string});
                        }
                      }}
                    >
                      <option value={TransactionType.TITHE}>Tithe</option>
                      <option value={TransactionType.OFFERING}>Offering</option>
                      <option value={TransactionType.DONATION}>Donation</option>
                      <option value={TransactionType.OTHER}>Other</option>
                      {customTypes.map((customType) => (
                        <option key={customType.id} value={customType.name}>{customType.name}</option>
                      ))}
                      <option value="ADD_NEW">+ Add New Type</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Church Service</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                      value={newRecord.serviceName}
                      onChange={(e) => {
                        if (e.target.value === 'ADD_NEW') {
                          setShowAddServiceModal(true);
                        } else {
                          setNewRecord({...newRecord, serviceName: e.target.value});
                        }
                      }}
                    >
                      <option value="">Select Service...</option>
                      {services.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                      {services.length === 0 && <option value="Sunday Morning Service">Sunday Morning Service</option>}
                      <option value="ADD_NEW">+ Add New Service</option>
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
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW') {
                        setShowAddProjectModal(true);
                      } else {
                        setNewRecord({...newRecord, category: e.target.value});
                      }
                    }}
                  >
                    <option value="">Select Project...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                    {projects.length === 0 && <option value="Main">Main</option>}
                    <option value="ADD_NEW">+ Add New Project</option>
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

      <AnimatePresence>
        {showExpenseForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl relative"
            >
              <button 
                onClick={() => {
                  setShowExpenseForm(false);
                  setEditingExpense(null);
                  setNewExpense(initialExpenseState);
                }}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-xl font-bold mb-6">Record New Expense</h3>
              <form onSubmit={handleCreateExpense} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Expense Type</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    value={newExpense.type}
                    onChange={(e) => setNewExpense({...newExpense, type: e.target.value as ExpenseType})}
                  >
                    <option value={ExpenseType.SALARY}>Salary</option>
                    <option value={ExpenseType.SUPPLIES}>Supplies</option>
                    <option value={ExpenseType.UTILITIES}>Utilities</option>
                    <option value={ExpenseType.MAINTENANCE}>Maintenance</option>
                    <option value={ExpenseType.OTHER}>Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Category</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                    placeholder="Expense category"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Amount (UGX)</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    value={newExpense.amount || ''}
                    onChange={(e) => setNewExpense({...newExpense, amount: Number(e.target.value)})}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Date</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Description</label>
                  <textarea
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg min-h-[100px]"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                    placeholder="Enter a short description"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20"
                >
                  {editingExpense ? 'Update Expense' : 'Record Expense'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Type Modal */}
      <AnimatePresence>
        {showAddTypeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAddTypeModal(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-xl font-bold mb-6">Add New Type</h3>
              <form onSubmit={(e) => { e.preventDefault(); handleAddNewType(); }} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Type ID (Auto-generated)</label>
                  <input 
                    type="text"
                    disabled
                    className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500"
                    value={`CUSTOM_${newTypeName.trim().toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`}
                    placeholder="Auto-generated ID"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Type Name</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="Enter new type name..."
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  Add Type
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Service Modal */}
      <AnimatePresence>
        {showAddServiceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAddServiceModal(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-xl font-bold mb-6">Add New Service</h3>
              <form onSubmit={(e) => { e.preventDefault(); handleAddNewService(); }} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Service ID (Auto-generated)</label>
                  <input 
                    type="text"
                    disabled
                    className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500"
                    value={`SRV_${newServiceName.trim().toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`}
                    placeholder="Auto-generated ID"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Service Name</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    placeholder="Enter new service name..."
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  Add Service
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Project Modal */}
      <AnimatePresence>
        {showAddProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-xl shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAddProjectModal(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-xl font-bold mb-6">Add New Project</h3>
              <form onSubmit={(e) => { e.preventDefault(); handleAddNewProject(); }} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Project ID (Auto-generated)</label>
                  <input 
                    type="text"
                    disabled
                    className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500"
                    value={newProjectData.projectId || `PRJ_${newProjectData.name.trim().toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`}
                    placeholder="Auto-generated ID"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Project Name *</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    value={newProjectData.name}
                    onChange={(e) => setNewProjectData({...newProjectData, name: e.target.value, projectId: newProjectData.projectId || `PRJ_${e.target.value.trim().toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`})}
                    placeholder="Enter project name..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Description</label>
                  <textarea 
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    value={newProjectData.description}
                    onChange={(e) => setNewProjectData({...newProjectData, description: e.target.value})}
                    placeholder="Enter project description..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Target Amount (UGX)</label>
                  <input 
                    type="number"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    value={newProjectData.targetAmount}
                    onChange={(e) => setNewProjectData({...newProjectData, targetAmount: Number(e.target.value)})}
                    placeholder="Enter target amount..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Start Date</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                      value={newProjectData.startDate}
                      onChange={(e) => setNewProjectData({...newProjectData, startDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">End Date</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                      value={newProjectData.endDate}
                      onChange={(e) => setNewProjectData({...newProjectData, endDate: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  Add Project
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
                  {customTypes.map((customType) => (
                    <option key={`filter-${customType.id}`} value={customType.name}>{customType.name}</option>
                  ))}
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
