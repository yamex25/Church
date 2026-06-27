import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
  FinanceRecord,
  Expense,
  Pledge,
  PayrollRecord,
  Requisition,
  TransactionType,
  ExpenseType,
  RequisitionStatus,
} from '../types';
import { formatCurrency } from './utils';

// ─── Data Fetchers (church-scoped) ───────────────────────────────────────────

async function fetchAllIncome(churchId: string): Promise<FinanceRecord[]> {
  const snap = await getDocs(collection(db, 'churches', churchId, 'finance'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FinanceRecord));
}

async function fetchAllExpenses(churchId: string): Promise<Expense[]> {
  const snap = await getDocs(collection(db, 'churches', churchId, 'expenses'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
}

async function fetchAllPledges(churchId: string): Promise<Pledge[]> {
  const snap = await getDocs(collection(db, 'churches', churchId, 'pledges'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Pledge));
}

async function fetchAllPayroll(churchId: string): Promise<PayrollRecord[]> {
  const snap = await getDocs(collection(db, 'churches', churchId, 'payroll'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollRecord));
}

async function fetchAllRequisitions(churchId: string): Promise<Requisition[]> {
  const snap = await getDocs(collection(db, 'churches', churchId, 'requisitions'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Requisition));
}

// ─── Period Detection ─────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
};

interface Period {
  label: string;
  filter: (dateStr: string) => boolean;
}

function detectPeriod(q: string): Period {
  // Specific year e.g. "2024"
  const yearMatch = q.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const yr = yearMatch[1];
    return { label: `in ${yr}`, filter: d => d.startsWith(yr) };
  }

  // "last year" / "previous year"
  if (/last year|previous year/.test(q)) {
    const yr = String(new Date().getFullYear() - 1);
    return { label: `in ${yr}`, filter: d => d.startsWith(yr) };
  }

  // "this year" / "current year"
  if (/this year|current year/.test(q)) {
    const yr = String(new Date().getFullYear());
    return { label: `in ${yr}`, filter: d => d.startsWith(yr) };
  }

  // "last month" / "previous month"
  if (/last month|previous month/.test(q)) {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const ym = d.toISOString().slice(0, 7);
    return { label: `in ${formatMonthLabel(ym)}`, filter: d => d.startsWith(ym) };
  }

  // Specific month name (uses current year)
  for (const [name, num] of Object.entries(MONTH_NAMES)) {
    if (q.includes(name)) {
      const yr = String(new Date().getFullYear());
      const ym = `${yr}-${num}`;
      return {
        label: `in ${name.charAt(0).toUpperCase() + name.slice(1)} ${yr}`,
        filter: d => d.startsWith(ym),
      };
    }
  }

  // "this month" / "current month" / "month" alone → default to current month
  if (/this month|current month|this week/.test(q)) {
    const ym = new Date().toISOString().slice(0, 7);
    return { label: `in ${formatMonthLabel(ym)}`, filter: d => d.startsWith(ym) };
  }

  // "today"
  if (q.includes('today')) {
    const today = new Date().toISOString().slice(0, 10);
    return { label: 'today', filter: d => d.startsWith(today) };
  }

  // No period keyword → all time
  return { label: 'overall (all time)', filter: () => true };
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' });
}

// ─── Answer Shape ─────────────────────────────────────────────────────────────

export interface QALine {
  label: string;
  value: string;
  highlight?: boolean;
  sub?: boolean;
}

export interface QAAnswer {
  question: string;
  summary: string;
  lines: QALine[];
  reportData?: Record<string, string | number>[];
  reportFilename?: string;
  error?: string;
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

export async function answerFinanceQuestion(rawQuestion: string, churchId: string): Promise<QAAnswer> {
  const q = rawQuestion.toLowerCase().trim();

  // ── 1. TREASURY / BALANCE ──────────────────────────────────────────────────
  if (
    /treasury|how much (money|funds|cash) do we have|available (balance|funds|money)|current balance|what.?s (our|the) balance|how much is in/.test(q)
  ) {
    const [income, expenses] = await Promise.all([fetchAllIncome(churchId), fetchAllExpenses(churchId)]);
    const totalIncome = income.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const balance = totalIncome - totalExpenses;

    // Tithe / Offering / Donation breakdown
    const byType: Record<string, number> = {};
    income.forEach(r => { byType[r.type] = (byType[r.type] || 0) + r.amount; });

    return {
      question: rawQuestion,
      summary: `Current treasury balance is ${formatCurrency(balance)}`,
      lines: [
        { label: 'Total Income Ever Received', value: formatCurrency(totalIncome) },
        { label: 'Total Expenses Ever Paid', value: formatCurrency(totalExpenses) },
        { label: 'Available Treasury Balance', value: formatCurrency(balance), highlight: true },
        ...Object.entries(byType).map(([type, amount]) => ({
          label: `  └ Income from ${type}`,
          value: formatCurrency(amount),
          sub: true,
        })),
      ],
    };
  }

  // ── 2. TITHE ──────────────────────────────────────────────────────────────
  if (/tithe/.test(q)) {
    const period = detectPeriod(q);
    const income = await fetchAllIncome(churchId);
    const tithes = income.filter(r => r.type === TransactionType.TITHE && period.filter(r.date));
    const total = tithes.reduce((s, r) => s + r.amount, 0);

    return {
      question: rawQuestion,
      summary: `Total tithe ${period.label}: ${formatCurrency(total)}`,
      lines: [
        { label: `Tithe ${period.label}`, value: formatCurrency(total), highlight: true },
        { label: 'Number of Tithe Records', value: String(tithes.length) },
        ...(tithes.length > 0 ? [
          { label: 'Highest Single Tithe', value: formatCurrency(Math.max(...tithes.map(r => r.amount))) },
          { label: 'Average Tithe', value: formatCurrency(Math.round(total / tithes.length)) },
        ] : []),
      ],
      reportData: tithes.map(r => ({
        Date: r.date,
        Member: r.memberName || 'Anonymous',
        Amount: r.amount,
        Service: r.serviceName || '-',
        Category: r.category || '-',
      })),
      reportFilename: `Tithe_Report_${period.label.replace(/\s+/g, '_')}.xlsx`,
    };
  }

  // ── 3. OFFERING ───────────────────────────────────────────────────────────
  if (/offering/.test(q)) {
    const period = detectPeriod(q);
    const income = await fetchAllIncome(churchId);
    const offerings = income.filter(r => r.type === TransactionType.OFFERING && period.filter(r.date));
    const total = offerings.reduce((s, r) => s + r.amount, 0);

    return {
      question: rawQuestion,
      summary: `Total offering ${period.label}: ${formatCurrency(total)}`,
      lines: [
        { label: `Offering ${period.label}`, value: formatCurrency(total), highlight: true },
        { label: 'Number of Offering Records', value: String(offerings.length) },
        ...(offerings.length > 0 ? [
          { label: 'Highest Single Offering', value: formatCurrency(Math.max(...offerings.map(r => r.amount))) },
          { label: 'Average Offering', value: formatCurrency(Math.round(total / offerings.length)) },
        ] : []),
      ],
      reportData: offerings.map(r => ({
        Date: r.date,
        Member: r.memberName || 'Anonymous',
        Amount: r.amount,
        Service: r.serviceName || '-',
      })),
      reportFilename: `Offering_Report_${period.label.replace(/\s+/g, '_')}.xlsx`,
    };
  }

  // ── 4. DONATION ───────────────────────────────────────────────────────────
  if (/donation|donate/.test(q)) {
    const period = detectPeriod(q);
    const income = await fetchAllIncome(churchId);
    const donations = income.filter(r => r.type === TransactionType.DONATION && period.filter(r.date));
    const total = donations.reduce((s, r) => s + r.amount, 0);

    return {
      question: rawQuestion,
      summary: `Total donations ${period.label}: ${formatCurrency(total)}`,
      lines: [
        { label: `Donations ${period.label}`, value: formatCurrency(total), highlight: true },
        { label: 'Number of Donation Records', value: String(donations.length) },
      ],
      reportData: donations.map(r => ({
        Date: r.date,
        Member: r.memberName || 'Anonymous',
        Amount: r.amount,
        Category: r.category || '-',
        Description: r.description || '-',
      })),
      reportFilename: `Donation_Report_${period.label.replace(/\s+/g, '_')}.xlsx`,
    };
  }

  // ── 5. INCOME / CONTRIBUTIONS (general) ───────────────────────────────────
  if (
    /total income|how much (have we|did we) (receive|collect)|income (this|last|in)|contribution|how much came in|total collection|how much money (came|received)/.test(q)
  ) {
    const period = detectPeriod(q);
    const income = await fetchAllIncome(churchId);
    const filtered = income.filter(r => period.filter(r.date));
    const total = filtered.reduce((s, r) => s + r.amount, 0);

    const byType: Record<string, number> = {};
    filtered.forEach(r => { byType[r.type] = (byType[r.type] || 0) + r.amount; });

    return {
      question: rawQuestion,
      summary: `Total income ${period.label}: ${formatCurrency(total)}`,
      lines: [
        { label: `Total Income ${period.label}`, value: formatCurrency(total), highlight: true },
        { label: 'Total Records', value: String(filtered.length) },
        ...Object.entries(byType)
          .sort((a, b) => b[1] - a[1])
          .map(([type, amount]) => ({
            label: `  └ ${type}`,
            value: formatCurrency(amount),
            sub: true,
          })),
      ],
      reportData: filtered.map(r => ({
        Date: r.date,
        Type: r.type,
        Member: r.memberName || 'Anonymous',
        Amount: r.amount,
        Service: r.serviceName || '-',
        Category: r.category || '-',
      })),
      reportFilename: `Income_Report_${period.label.replace(/\s+/g, '_')}.xlsx`,
    };
  }

  // ── 6. PAYROLL / SALARY ───────────────────────────────────────────────────
  if (/payroll|salari|employee pay|staff pay|how much (do we pay|are we paying)/.test(q)) {
    const period = detectPeriod(q);
    const payroll = await fetchAllPayroll(churchId);
    const filtered = payroll.filter(p => period.filter(p.paymentDate));

    const totalDue = filtered.reduce((s, p) => s + p.totalSalary, 0);
    const totalPaid = filtered.reduce((s, p) => s + p.paidAmount, 0);
    const totalBalance = filtered.reduce((s, p) => s + p.balance, 0);
    const counts = { Paid: 0, Partial: 0, Pending: 0 };
    filtered.forEach(p => { counts[p.status as keyof typeof counts] = (counts[p.status as keyof typeof counts] || 0) + 1; });

    return {
      question: rawQuestion,
      summary: `Payroll ${period.label}: ${formatCurrency(totalPaid)} paid out of ${formatCurrency(totalDue)} due`,
      lines: [
        { label: `Total Salary Due ${period.label}`, value: formatCurrency(totalDue) },
        { label: 'Total Amount Paid', value: formatCurrency(totalPaid), highlight: true },
        { label: 'Outstanding Balance', value: formatCurrency(totalBalance) },
        { label: 'Fully Paid Records', value: String(counts.Paid) },
        { label: 'Partial Payment Records', value: String(counts.Partial) },
        { label: 'Pending Records', value: String(counts.Pending) },
      ],
      reportData: filtered.map(p => ({
        Month: p.month,
        Employee: p.employeeName,
        'Total Salary': p.totalSalary,
        'Paid Amount': p.paidAmount,
        Balance: p.balance,
        Status: p.status,
        'Payment Method': p.paymentMethod,
        'Payment Date': p.paymentDate,
      })),
      reportFilename: `Payroll_Report_${period.label.replace(/\s+/g, '_')}.xlsx`,
    };
  }

  // ── 7. EXPENSES (with optional specific type) ──────────────────────────────
  if (
    /expense|how much (have we|did we) spend|spending|expenditure|how much we (spent|paid out)|daily (cost|expense)/.test(q)
  ) {
    const period = detectPeriod(q);
    const expenses = await fetchAllExpenses(churchId);

    // Check for specific expense type
    const expenseTypeMap: Record<string, ExpenseType> = {
      salary: ExpenseType.SALARY, salaries: ExpenseType.SALARY,
      requisition: ExpenseType.REQUISITION,
      utilities: ExpenseType.UTILITIES, utility: ExpenseType.UTILITIES,
      maintenance: ExpenseType.MAINTENANCE,
      supplies: ExpenseType.SUPPLIES,
      transport: ExpenseType.TRANSPORT,
      fuel: ExpenseType.FUEL,
      communication: ExpenseType.COMMUNICATION,
      cleaning: ExpenseType.CLEANING,
      security: ExpenseType.SECURITY,
      hospitality: ExpenseType.HOSPITALITY,
    };

    let specificType: ExpenseType | null = null;
    for (const [kw, type] of Object.entries(expenseTypeMap)) {
      if (q.includes(kw)) { specificType = type; break; }
    }

    const filtered = expenses.filter(e =>
      period.filter(e.date) && (specificType ? e.type === specificType : true)
    );
    const total = filtered.reduce((s, e) => s + e.amount, 0);

    const lines: QALine[] = [];
    lines.push({
      label: specificType
        ? `${specificType} Expenses ${period.label}`
        : `Total Expenses ${period.label}`,
      value: formatCurrency(total),
      highlight: true,
    });
    lines.push({ label: 'Number of Records', value: String(filtered.length) });

    if (!specificType) {
      const byType: Record<string, number> = {};
      filtered.forEach(e => { byType[e.type] = (byType[e.type] || 0) + e.amount; });
      Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, amount]) => {
          lines.push({ label: `  └ ${type}`, value: formatCurrency(amount), sub: true });
        });
    }

    return {
      question: rawQuestion,
      summary: specificType
        ? `${specificType} expenses ${period.label}: ${formatCurrency(total)}`
        : `Total expenses ${period.label}: ${formatCurrency(total)}`,
      lines,
      reportData: filtered.map(e => ({
        Date: e.date,
        Type: e.type,
        Category: e.category,
        Description: e.description,
        Amount: e.amount,
      })),
      reportFilename: `Expenses_Report_${(specificType || 'All').replace(/\s+/g, '_')}_${period.label.replace(/\s+/g, '_')}.xlsx`,
    };
  }

  // ── 8. PLEDGES ────────────────────────────────────────────────────────────
  if (/pledge/.test(q)) {
    const pledges = await fetchAllPledges(churchId);
    const fulfilled = pledges.filter(p => p.status === 'Fulfilled');
    const pending = pledges.filter(p => p.status === 'Pending');
    const totalAmount = pledges.reduce((s, p) => s + p.amount, 0);
    const fulfilledAmt = fulfilled.reduce((s, p) => s + p.amount, 0);
    const pendingAmt = pending.reduce((s, p) => s + p.amount, 0);

    // Project breakdown
    const byProject: Record<string, number> = {};
    pledges.forEach(p => { byProject[p.project] = (byProject[p.project] || 0) + p.amount; });

    return {
      question: rawQuestion,
      summary: `Total pledges: ${pledges.length} records worth ${formatCurrency(totalAmount)}`,
      lines: [
        { label: 'Total Pledge Records', value: String(pledges.length) },
        { label: 'Total Pledge Amount', value: formatCurrency(totalAmount), highlight: true },
        { label: `Fulfilled (${fulfilled.length} records)`, value: formatCurrency(fulfilledAmt) },
        { label: `Pending (${pending.length} records)`, value: formatCurrency(pendingAmt) },
        ...Object.entries(byProject)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([project, amount]) => ({
            label: `  └ ${project}`,
            value: formatCurrency(amount),
            sub: true,
          })),
      ],
      reportData: pledges.map(p => ({
        Date: p.date,
        Member: p.memberName,
        Project: p.project,
        Amount: p.amount,
        Status: p.status,
      })),
      reportFilename: 'Pledges_Report.xlsx',
    };
  }

  // ── 9. REQUISITIONS ───────────────────────────────────────────────────────
  if (/requisition/.test(q)) {
    const reqs = await fetchAllRequisitions(churchId);
    const pending = reqs.filter(r => r.status === RequisitionStatus.PENDING);
    const approved = reqs.filter(r => r.status === RequisitionStatus.APPROVED);
    const declined = reqs.filter(r => r.status === RequisitionStatus.DECLINED);
    const getCost = (r: Requisition) => r.total ?? r.cost ?? r.estimatedCost ?? 0;
    const approvedCost = approved.reduce((s, r) => s + getCost(r), 0);
    const pendingCost = pending.reduce((s, r) => s + getCost(r), 0);

    return {
      question: rawQuestion,
      summary: `Requisitions: ${reqs.length} total | ${pending.length} pending | ${approved.length} approved`,
      lines: [
        { label: 'Total Requisitions', value: String(reqs.length) },
        { label: `Pending (${pending.length})`, value: formatCurrency(pendingCost) },
        { label: `Approved (${approved.length})`, value: formatCurrency(approvedCost), highlight: true },
        { label: `Declined (${declined.length})`, value: '—' },
      ],
      reportData: reqs.map(r => ({
        Department: r.department,
        Item: r.itemName || r.items || '-',
        'Requested By': r.requestedBy,
        Cost: getCost(r),
        Status: r.status,
      })),
      reportFilename: 'Requisitions_Report.xlsx',
    };
  }

  // ── 10. FULL SUMMARY / REPORT / OVERVIEW ──────────────────────────────────
  if (/summary|report|overview|financial (status|picture)|how are we doing/.test(q)) {
    const period = detectPeriod(q);
    const [income, expenses, pledges, payroll] = await Promise.all([
      fetchAllIncome(churchId), fetchAllExpenses(churchId), fetchAllPledges(churchId), fetchAllPayroll(churchId),
    ]);

    const filtIncome = income.filter(r => period.filter(r.date));
    const filtExpenses = expenses.filter(e => period.filter(e.date));
    const filtPayroll = payroll.filter(p => period.filter(p.paymentDate));

    const totalIncome = filtIncome.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = filtExpenses.reduce((s, e) => s + e.amount, 0);
    const balance = totalIncome - totalExpenses;
    const totalPledged = pledges.reduce((s, p) => s + p.amount, 0);
    const fulfilledPledged = pledges.filter(p => p.status === 'Fulfilled').reduce((s, p) => s + p.amount, 0);
    const totalPayroll = filtPayroll.reduce((s, p) => s + p.paidAmount, 0);

    const byIncomeType: Record<string, number> = {};
    filtIncome.forEach(r => { byIncomeType[r.type] = (byIncomeType[r.type] || 0) + r.amount; });

    return {
      question: rawQuestion,
      summary: `Financial overview ${period.label}: Net balance ${formatCurrency(balance)}`,
      lines: [
        { label: `Period`, value: period.label },
        { label: 'Total Income', value: formatCurrency(totalIncome) },
        ...Object.entries(byIncomeType).map(([t, a]) => ({
          label: `  └ ${t}`, value: formatCurrency(a), sub: true,
        })),
        { label: 'Total Expenses', value: formatCurrency(totalExpenses) },
        { label: 'Payroll Paid Out', value: formatCurrency(totalPayroll), sub: true },
        { label: 'Net Balance', value: formatCurrency(balance), highlight: true },
        { label: 'Total Pledges (all time)', value: formatCurrency(totalPledged) },
        { label: 'Fulfilled Pledges', value: formatCurrency(fulfilledPledged), sub: true },
      ],
    };
  }

  // ── FALLBACK ──────────────────────────────────────────────────────────────
  return {
    question: rawQuestion,
    summary: "I'm not sure I understood that question.",
    lines: [],
    error:
      "Try asking about: treasury balance · income · expenses · tithe · offering · donation · payroll · pledges · requisitions · financial summary",
  };
}
