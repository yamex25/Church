import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DollarSign,
  Plus,
  Search,
  X,
  Calendar,
  TrendingDown,
  Filter,
  Trash2,
  Edit
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '@/src/lib/utils';
import { ExpenseType, Expense } from '@/src/types';
import { db, handleFirestoreError, OperationType, recordExpense } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';

export default function DailyExpenseModule() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterPeriodType, setFilterPeriodType] = useState<'month' | 'year'>('month');

  const initialExpenseState = {
    type: ExpenseType.UTILITIES,
    category: '',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0]
  };

  const [newExpense, setNewExpense] = useState(initialExpenseState);

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      setExpenses(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    return () => unsubscribe();
  }, []);

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
        await recordExpense({
          type: newExpense.type,
          category: newExpense.category,
          description: newExpense.description,
          amount: Number(newExpense.amount),
          date: new Date(newExpense.date).toISOString(),
          recordedBy: user.uid,
        });
        alert("Expense recorded successfully.");
      }
      setShowAddForm(false);
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
    setShowAddForm(true);
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

  const getFilteredData = (data: Expense[]) => {
    return data.filter(item => {
      // Extract date string in ISO format (2026-05-15T...)
      const dateStr = item.date;
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

  const filteredExpenses = getFilteredData(expenses);

  const filteredBySearch = filteredExpenses.filter(expense =>
    expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredByType = filterType === 'All' 
    ? filteredBySearch 
    : filteredBySearch.filter(expense => expense.type === filterType);

  const totalExpenses = filteredByType.reduce((sum, e) => sum + e.amount, 0);

  const dailyExpenseCategories = [
    { value: ExpenseType.UTILITIES, label: 'Utilities (Water, Electricity)' },
    { value: ExpenseType.MAINTENANCE, label: 'Maintenance & Repairs' },
    { value: ExpenseType.SUPPLIES, label: 'Supplies & Materials' },
    { value: ExpenseType.TRANSPORT, label: 'Transport (Pastor, Staff)' },
    { value: ExpenseType.FUEL, label: 'Fuel & Vehicle Expenses' },
    { value: ExpenseType.COMMUNICATION, label: 'Communication (Internet, Phone)' },
    { value: ExpenseType.CLEANING, label: 'Cleaning & Sanitation' },
    { value: ExpenseType.SECURITY, label: 'Security Services' },
    { value: ExpenseType.HOSPITALITY, label: 'Hospitality & Refreshments' },
    { value: ExpenseType.OTHER, label: 'Other Daily Expenses' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Daily Expense Tracker</h2>
          <p className="text-slate-500 text-sm">Record daily operational expenses (water, fuel, transport, etc.)</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setEditingExpense(null);
              setNewExpense(initialExpenseState);
              setShowAddForm(true);
            }}
            className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-orange-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
          <button 
            onClick={() => {
              const expensesSection = document.getElementById('expenses-list');
              expensesSection?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-slate-700 transition-colors shadow-sm"
          >
            <Search className="w-4 h-4" />
            View Expenses
          </button>
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

      {/* Summary Card */}
      <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-8 rounded-3xl border border-orange-200 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-orange-600 uppercase tracking-widest mb-2">
              Total Daily Expenses
            </h3>
            <p className="text-4xl font-black text-orange-900">
              {formatCurrency(totalExpenses)}
            </p>
            <p className="text-xs text-orange-700 font-medium mt-2">
              {filterPeriodType === 'month' ? new Date(filterMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `Year ${filterYear}`}
            </p>
          </div>
          <TrendingDown className="w-16 h-16 text-orange-600 opacity-20" />
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search expenses..." 
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="All">All Categories</option>
            {dailyExpenseCategories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses List */}
      <div id="expenses-list" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold">View Expenses</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-100">
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredByType.map(expense => (
                <tr key={expense.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-700">{formatDate(expense.date)}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{expense.category || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{expense.type}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{expense.description || '-'}</td>
                  <td className="px-6 py-4 text-sm text-red-600 font-medium text-right">{formatCurrency(expense.amount)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button 
                        onClick={() => handleEditExpense(expense)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteExpense(expense.id!)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredByType.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <p className="text-sm">No expenses found for the selected period</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Expense Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-8 w-full max-w-lg shadow-2xl relative"
            >
              <button 
                onClick={() => setShowAddForm(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h3 className="text-xl font-bold mb-6">
                {editingExpense ? 'Edit Daily Expense' : 'Record New Daily Expense'}
              </h3>
              
              <form onSubmit={handleCreateExpense} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Expense Category</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    value={newExpense.type}
                    onChange={(e) => setNewExpense({...newExpense, type: e.target.value as ExpenseType})}
                  >
                    {dailyExpenseCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Sub-Category (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                    placeholder="e.g., Water Bill, Fuel for Van"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Description</label>
                  <textarea 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm h-24"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                    placeholder="Describe the expense..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
    </div>
  );
}
