import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { format, subMonths, subWeeks, startOfYear } from 'date-fns';
import {
  calculateBalance,
  getAllExpenses,
  getAllIncome,
} from '../../lib/firebase';
import {
  aggregateIncomeByPeriod,
  aggregateExpenseByPeriod,
  getChartData,
  aggregateByExpenseType,
  ChartDataPoint,
} from '../../lib/utils';
import { Expense, FinanceRecord, ExpenseType } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';

type Period = 'week' | 'month' | 'year';
type FilterPeriodType = 'month' | 'year';

export default function FinanceDashboard() {
  const [period, setPeriod] = useState<Period>('month');
  const [filterPeriodType, setFilterPeriodType] = useState<FilterPeriodType>('month');
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [income, setIncome] = useState<FinanceRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balance, setBalance] = useState({ totalIncome: 0, totalExpenses: 0, balance: 0 });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [expenseTypeData, setExpenseTypeData] = useState<{ type: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const periodIncome = aggregateIncomeByPeriod(
    income,
    period,
    new Date()
  );
  const periodExpense = aggregateExpenseByPeriod(
    expenses,
    period,
    new Date()
  );

  // Filter data by selected month or year
  const getFilteredData = (data: any[], dateField: string) => {
    return data.filter(item => {
      const itemDate = new Date(item[dateField]);
      const itemMonth = itemDate.toISOString().slice(0, 7);
      const itemYear = itemDate.getFullYear().toString();

      if (filterPeriodType === 'month') {
        return itemMonth === filterMonth;
      } else {
        return itemYear === filterYear;
      }
    });
  };

  const filteredIncome = getFilteredData(income, 'date');
  const filteredExpenses = getFilteredData(expenses, 'date');
  const filteredPeriodIncome = filteredIncome.reduce((sum, r) => sum + r.amount, 0);
  const filteredPeriodExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const filteredExpenseTypeData = aggregateByExpenseType(filteredExpenses);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (income.length > 0 && expenses.length > 0) {
      const startDate = getStartDate(period);
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const data = getChartData(income, expenses, startDate, endDate, getPeriodGranularity(period));
      setChartData(data);
      setExpenseTypeData(aggregateByExpenseType(expenses));
    }
  }, [income, expenses, period]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [incomeData, expenseData, balanceData] = await Promise.all([
        getAllIncome(),
        getAllExpenses(),
        calculateBalance(),
      ]);

      setIncome(incomeData || []);
      setExpenses(expenseData || []);
      setBalance(balanceData || { totalIncome: 0, totalExpenses: 0, balance: 0 });
      setError(null);
    } catch (err) {
      console.error('Error fetching financial data:', err);
      setError('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = (period: Period): string => {
    const now = new Date();
    let startDate: Date;

    if (period === 'week') {
      startDate = subWeeks(now, 1);
    } else if (period === 'month') {
      startDate = subMonths(now, 1);
    } else {
      startDate = startOfYear(now);
    }

    return format(startDate, 'yyyy-MM-dd');
  };

  const getPeriodGranularity = (period: Period): 'daily' | 'weekly' | 'monthly' => {
    if (period === 'week') return 'daily';
    if (period === 'month') return 'daily';
    return 'monthly';
  };

  const COLORS = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
  ];

  if (loading) {
    return <div className="p-8">Loading financial data...</div>;
  }

  const sortedIncome = [...income].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900">Finance Dashboard</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Period Selection */}
      <div className="flex gap-2">
        {(['week', 'month', 'year'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded font-medium transition ${
              period === p
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Month/Year Filter Controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Filter By</label>
            <select 
              value={filterPeriodType}
              onChange={(e) => setFilterPeriodType(e.target.value as FilterPeriodType)}
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
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-gray-600 text-xs font-medium">
            Total Income ({filterPeriodType === 'month' ? new Date(filterMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `Year ${filterYear}`})
          </h3>
          <p className="text-lg font-bold text-green-600 mt-1">
            {formatCurrency(filteredPeriodIncome)}
          </p>
          <p className="text-gray-500 text-[10px] mt-1">
            All-time: {formatCurrency(balance.totalIncome)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-gray-600 text-xs font-medium">
            Total Expenses ({filterPeriodType === 'month' ? new Date(filterMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `Year ${filterYear}`})
          </h3>
          <p className="text-lg font-bold text-red-600 mt-1">
            {formatCurrency(filteredPeriodExpense)}
          </p>
          <p className="text-gray-500 text-[10px] mt-1">
            Includes: Salaries, Requisitions, Daily Expenses
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-gray-600 text-xs font-medium">Net Balance</h3>
          <p className={`text-lg font-bold mt-1 ${filteredPeriodIncome - filteredPeriodExpense >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatCurrency(filteredPeriodIncome - filteredPeriodExpense)}
          </p>
          <p className="text-gray-500 text-[10px] mt-1">
            Income - Expenses (Filtered Period)
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Line Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                dot={false}
                name="Income"
              />
              <Line
                type="monotone"
                dataKey="expense"
                stroke="#ef4444"
                dot={false}
                name="Expense"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={filteredExpenseTypeData}
                dataKey="amount"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry: any) => `${entry.type}: ${formatCurrency(entry.amount)}`}
              >
                {filteredExpenseTypeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Income Transactions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Income Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-4 text-gray-600 font-medium">Date</th>
                <th className="text-left py-2 px-4 text-gray-600 font-medium">Member</th>
                <th className="text-left py-2 px-4 text-gray-600 font-medium">Type</th>
                <th className="text-left py-2 px-4 text-gray-600 font-medium">Amount</th>
                <th className="text-left py-2 px-4 text-gray-600 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {sortedIncome.slice(0, 10).map(record => (
                <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-700">{formatDate(record.date)}</td>
                  <td className="py-3 px-4 text-gray-700">{record.memberName || 'N/A'}</td>
                  <td className="py-3 px-4 text-gray-700">{record.type}</td>
                  <td className="py-3 px-4 text-green-600 font-medium">{formatCurrency(record.amount)}</td>
                  <td className="py-3 px-4 text-gray-700">{record.description || record.category || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedIncome.length === 0 && (
            <p className="text-center py-4 text-gray-500">No income records found</p>
          )}
        </div>
      </div>

      {/* Expense Transactions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Expenses ({filterPeriodType === 'month' ? new Date(filterMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `Year ${filterYear}`})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-4 text-gray-600 font-medium">Date</th>
                <th className="text-left py-2 px-4 text-gray-600 font-medium">Type</th>
                <th className="text-left py-2 px-4 text-gray-600 font-medium">Category</th>
                <th className="text-left py-2 px-4 text-gray-600 font-medium">Amount</th>
                <th className="text-left py-2 px-4 text-gray-600 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.slice(0, 10).map(expense => (
                <tr key={expense.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-700">{formatDate(expense.date)}</td>
                  <td className="py-3 px-4 text-gray-700">{expense.type}</td>
                  <td className="py-3 px-4 text-gray-700">{expense.category}</td>
                  <td className="py-3 px-4 text-red-600 font-medium">{formatCurrency(expense.amount)}</td>
                  <td className="py-3 px-4 text-gray-700">{expense.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredExpenses.length === 0 && (
            <p className="text-center py-4 text-gray-500">No expenses found for the selected period</p>
          )}
        </div>
      </div>
    </div>
  );
}
