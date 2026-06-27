import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  DollarSign, TrendingUp, TrendingDown, Activity,
  AlertCircle, Loader2, Calendar,
} from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';
import { FinanceRecord, Expense } from '@/src/types';
import { formatCurrency } from '@/src/lib/utils';

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'red' | 'yellow';
  sub?: string;
}) {
  const cfg = {
    blue: 'bg-church-blue text-white shadow-church-blue/20',
    green: 'bg-emerald-500 text-white shadow-emerald-500/20',
    red: 'bg-red-500 text-white shadow-red-500/20',
    yellow: 'bg-church-yellow text-church-black shadow-church-yellow/20',
  }[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-5 shadow-lg ${cfg}`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl font-black font-display">{value}</p>
      {sub && <p className="text-[11px] opacity-70 mt-1">{sub}</p>}
    </motion.div>
  );
}

export default function PortalFinance() {
  const { user, churchId, isAccountant, employeeDepartment } = useAuth();
  const [income, setIncome] = useState<FinanceRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const isFinance = isAccountant || /finance|accounts?/i.test(employeeDepartment ?? '');

  useEffect(() => {
    if (!churchId || !isFinance) { setLoading(false); return; }

    const load = async () => {
      try {
        const [incSnap, expSnap] = await Promise.all([
          getDocs(query(collection(db, 'churches', churchId, 'finance'), orderBy('date', 'desc'))),
          getDocs(query(collection(db, 'churches', churchId, 'expenses'), orderBy('date', 'desc'))),
        ]);
        setIncome(incSnap.docs.map(d => ({ id: d.id, ...d.data() } as FinanceRecord)));
        setExpenses(expSnap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
      } catch (e) {
        console.error('PortalFinance load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [churchId, isFinance]);

  if (!isFinance) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertCircle className="w-12 h-12 text-church-gray/30 mb-3" />
        <p className="text-church-gray">You don't have access to Finance data.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-church-blue" />
      </div>
    );
  }

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthIncome = income
    .filter(r => r.date?.startsWith(thisMonth))
    .reduce((s, r) => s + r.amount, 0);
  const monthExpenses = expenses
    .filter(e => e.date?.startsWith(thisMonth))
    .reduce((s, e) => s + e.amount, 0);
  const totalIncome = income.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpenses;

  const recent = [...income]
    .slice(0, 8)
    .map(r => ({ ...r, kind: 'income' as const }));

  const recentExpenses = [...expenses]
    .slice(0, 5)
    .map(e => ({ ...e, kind: 'expense' as const }));

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-display font-black text-church-black">Finance Overview</h2>
        <p className="text-church-gray text-sm mt-0.5">Read-only summary · {now.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={TrendingUp}    label="Income This Month"    value={formatCurrency(monthIncome)}    color="green" />
        <StatCard icon={TrendingDown}  label="Expenses This Month"  value={formatCurrency(monthExpenses)}  color="red" />
        <StatCard icon={DollarSign}    label="Current Balance"       value={formatCurrency(balance)}        color={balance >= 0 ? 'blue' : 'red'} sub="All time" />
        <StatCard icon={Activity}      label="Total Income (All)"   value={formatCurrency(totalIncome)}    color="yellow" />
      </div>

      {/* Recent income */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-church-gray mb-3 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Recent Income
        </h3>
        <div className="bg-white rounded-2xl border border-church-blue/8 divide-y divide-church-soft shadow-sm">
          {recent.length === 0 ? (
            <p className="text-church-gray text-sm text-center py-6">No income records yet.</p>
          ) : recent.map(r => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-church-black truncate">{r.type} — {r.category}</p>
                <p className="text-xs text-church-gray">{r.date} · {r.memberName ?? 'Anonymous'}</p>
              </div>
              <p className="font-bold text-emerald-600 text-sm flex-shrink-0 ml-3">{formatCurrency(r.amount)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent expenses */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-church-gray mb-3 flex items-center gap-2">
          <TrendingDown className="w-3.5 h-3.5 text-red-500" /> Recent Expenses
        </h3>
        <div className="bg-white rounded-2xl border border-church-blue/8 divide-y divide-church-soft shadow-sm">
          {recentExpenses.length === 0 ? (
            <p className="text-church-gray text-sm text-center py-6">No expense records yet.</p>
          ) : recentExpenses.map(e => (
            <div key={e.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-church-black truncate">{e.type} — {e.category}</p>
                <p className="text-xs text-church-gray">{e.date}</p>
                {e.description && <p className="text-xs text-church-gray truncate">{e.description}</p>}
              </div>
              <p className="font-bold text-red-600 text-sm flex-shrink-0 ml-3">{formatCurrency(e.amount)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
