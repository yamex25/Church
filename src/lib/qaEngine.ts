/**
 * Multi-module rule-based Q&A engine.
 * Handles Finance, Attendance, Members, Assets, HR/Payroll, Pledges, Requisitions.
 */

import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
  FinanceRecord, Expense, Pledge, PayrollRecord, Requisition,
  TransactionType, ExpenseType, RequisitionStatus,
  GeneralAttendance, Member, Asset, Employee, MembershipStatus,
} from '../types';
import { formatCurrency } from './utils';
import { parsePeriod } from './dateParser';

// ─── Module registry ──────────────────────────────────────────────────────────

export type ModuleType =
  | 'finance' | 'attendance' | 'members' | 'assets'
  | 'payroll' | 'pledges' | 'requisitions';

export const MODULE_META: Record<
  ModuleType,
  { label: string; icon: string; examples: string[] }
> = {
  finance: {
    label: 'Finance', icon: '💰',
    examples: [
      'How much money do we have in treasury?',
      'What is our total income this month?',
      'How much have we spent this year?',
      'What is our tithe for June 2026?',
      'Give me a financial summary this month',
    ],
  },
  attendance: {
    label: 'Attendance', icon: '📊',
    examples: [
      'How many people came last Sunday?',
      'Attendance on 22nd June 2026?',
      'Total attendance this month?',
      'How many first timers came this month?',
      'Show me the last 5 services',
    ],
  },
  members: {
    label: 'Members', icon: '👥',
    examples: [
      'How many active members do we have?',
      'How many new members joined this year?',
      'Total registered membership?',
      'How many members are in the choir?',
    ],
  },
  assets: {
    label: 'Assets', icon: '📦',
    examples: [
      'How many assets do we have?',
      'What is the total value of our assets?',
      'How many assets are in good condition?',
      'List our vehicles and equipment',
    ],
  },
  payroll: {
    label: 'HR & Payroll', icon: '👔',
    examples: [
      'How many employees do we have?',
      'What is our total payroll this month?',
      'How much do we pay in salaries?',
      'Show me payroll status for June 2026',
    ],
  },
  pledges: {
    label: 'Pledges', icon: '🎯',
    examples: [
      'What is the status of our pledges?',
      'How many pledges are still pending?',
      'Total pledge amount for all projects?',
      'How much has been fulfilled?',
    ],
  },
  requisitions: {
    label: 'Requisitions', icon: '📋',
    examples: [
      'How many requisitions are pending?',
      'Total cost of approved requisitions?',
      'Show me pending department requests',
      'How many requests were declined?',
    ],
  },
};

// ─── Answer types ─────────────────────────────────────────────────────────────

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

// ─── Keyword intent detection (sync — runs while typing) ─────────────────────

const DETECT_PATTERNS: Record<ModuleType, RegExp> = {
  finance:      /tithe|offering|donation|income|expense|treasury|balance|fund|contribution|collection|revenue|spending|spent|received|finance|financial|money|how much did we|how much have we|how much do we|bank|cash|fees?/,
  attendance:   /attend|came to|come to church|present at|service|congregation|turnout|first timer|how many people came|how many came|how many showed up|how many were in|how full|worshipper|service count/,
  members:      /\bmember\b|registr|congregation size|joined|church size|church membership|church population|how many (brothers|sisters|people are)/,
  assets:       /\basset\b|inventory|equipment|vehicle|furniture|property|worth|how many item|what do we own|church property|own|resources/,
  payroll:      /\bsalary\b|\bsalaries\b|\bpayroll\b|employee|staff|wages|workers?|how many (employ|staff|worker)/,
  pledges:      /\bpledge\b|commitment|project fund|how much.*pledged/,
  requisitions: /\brequisition\b|department request|pending approval|pending request/,
};

const ENTITY_DETECT: { re: RegExp; label: string }[] = [
  { re: /\btithe\b/,                                   label: 'Tithe' },
  { re: /\boffering\b/,                                label: 'Offering' },
  { re: /\bdonation\b/,                                label: 'Donation' },
  { re: /\bexpense\b|\bspend\b|\bspent\b/,             label: 'Expenses' },
  { re: /\bsalary\b|\bpayroll\b|\bsalaries\b/,        label: 'Payroll' },
  { re: /\bpledge\b/,                                  label: 'Pledges' },
  { re: /\btreasury\b|\bbalance\b/,                    label: 'Treasury' },
  { re: /\bincome\b|\bcontribution\b|\bcollection\b/,  label: 'Income' },
  { re: /\battend/,                                    label: 'Attendance' },
  { re: /\bmember\b/,                                  label: 'Members' },
  { re: /\basset\b/,                                   label: 'Assets' },
  { re: /\brequisition\b/,                             label: 'Requisitions' },
  { re: /\bemployee\b|\bstaff\b/,                      label: 'Employees' },
  { re: /\bfuel\b/,                                    label: 'Fuel' },
  { re: /\butility\b|\butilities\b/,                   label: 'Utilities' },
  { re: /\bmaintenance\b/,                             label: 'Maintenance' },
];

export interface QueryIntent {
  module: ModuleType | null;
  entity: string | null;
  periodLabel: string | null;
  chips: { label: string; type: 'date' | 'module' | 'entity' }[];
}

export function detectQueryIntent(
  text: string,
  hint?: ModuleType | null
): QueryIntent {
  if (!text || text.trim().length < 3) {
    return { module: hint ?? null, entity: null, periodLabel: null, chips: [] };
  }
  const q = text.toLowerCase();
  const period = parsePeriod(q);

  let module: ModuleType | null = hint ?? null;
  if (!module) {
    for (const [mod, re] of Object.entries(DETECT_PATTERNS) as [ModuleType, RegExp][]) {
      if (re.test(q)) { module = mod; break; }
    }
  }

  let entity: string | null = null;
  for (const { re, label } of ENTITY_DETECT) {
    if (re.test(q)) { entity = label; break; }
  }

  const chips: QueryIntent['chips'] = [];
  if (!period.isAllTime) chips.push({ label: period.label, type: 'date' });
  if (module) chips.push({ label: MODULE_META[module].label, type: 'module' });
  if (entity && entity !== (module ? MODULE_META[module].label : '')) {
    chips.push({ label: entity, type: 'entity' });
  }

  return { module, entity, periodLabel: period.isAllTime ? null : period.label, chips };
}

// ─── Firestore fetchers ───────────────────────────────────────────────────────

async function snap<T>(churchId: string, col: string): Promise<T[]> {
  const s = await getDocs(collection(db, 'churches', churchId, col));
  return s.docs.map(d => ({ id: d.id, ...d.data() } as T));
}

async function fetchIncome(churchId: string):       Promise<FinanceRecord[]>     { return snap(churchId, 'finance'); }
async function fetchExpenses(churchId: string):     Promise<Expense[]>           { return snap(churchId, 'expenses'); }
async function fetchPledges(churchId: string):      Promise<Pledge[]>            { return snap(churchId, 'pledges'); }
async function fetchPayroll(churchId: string):      Promise<PayrollRecord[]>     { return snap(churchId, 'payroll'); }
async function fetchRequisitions(churchId: string): Promise<Requisition[]>       { return snap(churchId, 'requisitions'); }
async function fetchAttendance(churchId: string):   Promise<GeneralAttendance[]> { return snap(churchId, 'attendance'); }
async function fetchMembers(churchId: string):      Promise<Member[]>            { return snap(churchId, 'members'); }
async function fetchAssets(churchId: string):       Promise<Asset[]>             { return snap(churchId, 'assets'); }
async function fetchEmployees(churchId: string):    Promise<Employee[]>          { return snap(churchId, 'employees'); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the question is asking about a specific named expense type */
function matchExpenseType(q: string): ExpenseType | null {
  const map: [string | RegExp, ExpenseType][] = [
    [/\bsalary\b|\bsalaries\b/,        ExpenseType.SALARY],
    [/\brequisition\b/,                 ExpenseType.REQUISITION],
    [/\butilities?\b/,                  ExpenseType.UTILITIES],
    [/\bmaintenance\b/,                 ExpenseType.MAINTENANCE],
    [/\bsupplies?\b/,                   ExpenseType.SUPPLIES],
    [/\btransport\b/,                   ExpenseType.TRANSPORT],
    [/\bfuel\b/,                        ExpenseType.FUEL],
    [/\bcommunication\b/,               ExpenseType.COMMUNICATION],
    [/\bcleaning\b/,                    ExpenseType.CLEANING],
    [/\bsecurity\b/,                    ExpenseType.SECURITY],
    [/\bhospitality\b/,                 ExpenseType.HOSPITALITY],
  ];
  for (const [pattern, type] of map) {
    if (typeof pattern === 'string' ? q.includes(pattern) : pattern.test(q)) return type;
  }
  return null;
}

/** Formats a payroll date field safely (handles string or object) */
function payrollDateStr(p: PayrollRecord): string {
  // Prefer month (YYYY-MM) since it's most reliable for period filtering
  if (p.month) return p.month;
  if (typeof p.paymentDate === 'string') return p.paymentDate.slice(0, 10);
  return '';
}

/** No records found message */
function noRecords(q: string, period: { label: string }, module: string): QAAnswer {
  return {
    question: q,
    summary: `No ${module} records found for ${period.label}`,
    lines: [],
    error: `There are no ${module.toLowerCase()} records matching "${period.label}". Try a different date or remove the date to see all records.`,
  };
}

// ─── Main Q&A dispatcher ─────────────────────────────────────────────────────

export async function answerQuestion(
  rawQuestion: string,
  moduleHint?: ModuleType | null,
  churchId?: string
): Promise<QAAnswer> {
  const q = rawQuestion.toLowerCase().trim();
  const period = parsePeriod(q);

  // ═══════════════════════════════════════════════════════════════
  // ATTENDANCE
  // ═══════════════════════════════════════════════════════════════
  const isAttendanceQ = moduleHint === 'attendance'
    || /attend|how many (people|persons|souls|members|folks) (came|were|attended|showed up)|how many came|how many showed up|how many were in church|present at (the )?service|service (attendance|count)|first timer|turnout|congregation (count|today|this|last)|how full was|how many worshipper|people in church|service head ?count|last service|recent service|church service/.test(q);

  if (isAttendanceQ) {
    const records = await fetchAttendance(churchId || '');

    // NO DATE GIVEN → show the most recent service (not a dump of everything)
    if (period.isAllTime) {
      const sorted = [...records].sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
      if (sorted.length === 0) {
        return { question: rawQuestion, summary: 'No attendance records found.', lines: [], error: 'No services have been recorded yet.' };
      }
      const latest = sorted[0];
      const latestTotal = latest.adultCount + latest.childrenCount;

      return {
        question: rawQuestion,
        summary: `Last recorded service: ${latest.serviceName} on ${latest.serviceDate} — ${latestTotal} people`,
        lines: [
          { label: 'Most Recent Service', value: latest.serviceName },
          { label: 'Date', value: latest.serviceDate },
          { label: 'Total Attendance', value: String(latestTotal), highlight: true },
          { label: 'Adults', value: String(latest.adultCount) },
          { label: 'Children', value: String(latest.childrenCount) },
          { label: 'First Time Visitors', value: String(latest.firstTimers) },
          ...(latest.summary ? [{ label: 'Notes', value: latest.summary }] : []),
          { label: '— Previous services —', value: '' },
          ...sorted.slice(1, 5).map(r => ({
            label: `${r.serviceName} (${r.serviceDate})`,
            value: `${r.adultCount + r.childrenCount} people`,
            sub: true,
          })),
        ],
        reportData: sorted.slice(0, 10).map(r => ({
          Date: r.serviceDate, Service: r.serviceName,
          Adults: r.adultCount, Children: r.childrenCount,
          'First Timers': r.firstTimers, Total: r.adultCount + r.childrenCount,
        })),
        reportFilename: 'Recent_Attendance.xlsx',
      };
    }

    // SPECIFIC DATE/PERIOD
    const filtered = records.filter(r => period.filter(r.serviceDate));
    if (filtered.length === 0) return noRecords(rawQuestion, period, 'Attendance');

    // SINGLE SERVICE → detailed single-record view
    if (filtered.length === 1) {
      const r = filtered[0];
      const total = r.adultCount + r.childrenCount;
      return {
        question: rawQuestion,
        summary: `${r.serviceName} on ${r.serviceDate}: ${total} people attended`,
        lines: [
          { label: 'Service', value: r.serviceName },
          { label: 'Date', value: r.serviceDate },
          { label: 'Total Attendance', value: String(total), highlight: true },
          { label: 'Adults', value: String(r.adultCount) },
          { label: 'Children', value: String(r.childrenCount) },
          { label: 'First Time Visitors', value: String(r.firstTimers) },
          ...(r.summary ? [{ label: 'Notes', value: r.summary }] : []),
        ],
        reportData: [{
          Date: r.serviceDate, Service: r.serviceName,
          Adults: r.adultCount, Children: r.childrenCount,
          'First Timers': r.firstTimers, Total: total,
        }],
        reportFilename: `Attendance_${period.label.replace(/[^a-z0-9]/gi, '_')}.xlsx`,
      };
    }

    // MULTIPLE SERVICES → aggregate with breakdown
    const total     = filtered.reduce((s, r) => s + r.adultCount + r.childrenCount, 0);
    const adults    = filtered.reduce((s, r) => s + r.adultCount, 0);
    const children  = filtered.reduce((s, r) => s + r.childrenCount, 0);
    const first     = filtered.reduce((s, r) => s + r.firstTimers, 0);
    const sorted    = [...filtered].sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));

    return {
      question: rawQuestion,
      summary: `Attendance for ${period.label}: ${total} people across ${filtered.length} service(s)`,
      lines: [
        { label: `Total Attendance — ${period.label}`, value: String(total), highlight: true },
        { label: 'Services Recorded', value: String(filtered.length) },
        { label: 'Adults', value: String(adults) },
        { label: 'Children', value: String(children) },
        { label: 'First Time Visitors', value: String(first) },
        ...sorted.slice(0, 8).map(r => ({
          label: `  └ ${r.serviceName} (${r.serviceDate})`,
          value: `${r.adultCount + r.childrenCount} people`,
          sub: true,
        })),
      ],
      reportData: sorted.map(r => ({
        Date: r.serviceDate, Service: r.serviceName,
        Adults: r.adultCount, Children: r.childrenCount,
        'First Timers': r.firstTimers, Total: r.adultCount + r.childrenCount,
      })),
      reportFilename: `Attendance_${period.label.replace(/[^a-z0-9]/gi, '_')}.xlsx`,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MEMBERS
  // ═══════════════════════════════════════════════════════════════
  const isMembersQ = moduleHint === 'members'
    || /\bhow many members\b|total members?|member count|active members?|new members?|how many people (are|in) (the church|our church|registered)|church membership|membership count|church size|total congregation|how many (brothers|sisters)|how many registered|registered members|church population|how many (people are|persons are) (in|registered)/.test(q);

  if (isMembersQ) {
    const members = await fetchMembers(churchId || '');
    const active  = members.filter(m => m.membershipStatus === MembershipStatus.ACTIVE);

    // New members in period
    if (/new member|join|joined|recent|added this/.test(q)) {
      const newM = members.filter(m => period.filter(m.joinedAt || m.createdAt || ''));
      return {
        question: rawQuestion,
        summary: `New members ${period.isAllTime ? '(all time)' : `— ${period.label}`}: ${newM.length}`,
        lines: [
          { label: `New Members${period.isAllTime ? ' (all time)' : ` — ${period.label}`}`, value: String(newM.length), highlight: true },
          { label: 'Total Active Members', value: String(active.length) },
          { label: 'Total Registered', value: String(members.length) },
        ],
        reportData: newM.map(m => ({
          Name: m.name, Phone: m.phone, Status: m.membershipStatus,
          Zone: m.zoneName || '-', Joined: m.joinedAt || m.createdAt || '-',
        })),
        reportFilename: `New_Members_${period.label.replace(/[^a-z0-9]/gi, '_')}.xlsx`,
      };
    }

    // Category-specific (choir, usher, youth, etc.)
    const categoryWords = ['choir', 'usher', 'youth', 'elder', 'deacon', 'women', 'men', 'leader'];
    const matchedCat = categoryWords.find(c => q.includes(c));
    if (matchedCat) {
      const catMembers = active.filter(m => (m.categories || []).some(c => c.toLowerCase().includes(matchedCat)));
      return {
        question: rawQuestion,
        summary: `Members in ${matchedCat}: ${catMembers.length}`,
        lines: [
          { label: `Active in ${matchedCat.charAt(0).toUpperCase() + matchedCat.slice(1)}`, value: String(catMembers.length), highlight: true },
          { label: 'Total Active Members', value: String(active.length) },
        ],
        reportData: catMembers.map(m => ({ Name: m.name, Phone: m.phone, Zone: m.zoneName || '-' })),
        reportFilename: `Members_${matchedCat}.xlsx`,
      };
    }

    // General member stats
    const byCategory: Record<string, number> = {};
    active.forEach(m => {
      (m.categories || []).forEach(c => { byCategory[c] = (byCategory[c] || 0) + 1; });
    });
    const byStatus: Record<string, number> = {};
    members.forEach(m => { byStatus[m.membershipStatus] = (byStatus[m.membershipStatus] || 0) + 1; });

    return {
      question: rawQuestion,
      summary: `Total active members: ${active.length} of ${members.length} registered`,
      lines: [
        { label: 'Total Registered', value: String(members.length) },
        { label: 'Active Members', value: String(active.length), highlight: true },
        { label: 'Left Church', value: String(byStatus['Left Church'] || 0) },
        { label: 'Deceased', value: String(byStatus['Died'] || 0) },
        ...Object.entries(byCategory)
          .sort((a, b) => b[1] - a[1]).slice(0, 6)
          .map(([cat, n]) => ({ label: `  └ ${cat}`, value: String(n), sub: true })),
      ],
      reportData: members.map(m => ({
        Name: m.name, Phone: m.phone, Status: m.membershipStatus,
        Zone: m.zoneName || '-', Cell: m.cellName || '-',
      })),
      reportFilename: 'Members_Report.xlsx',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ASSETS
  // ═══════════════════════════════════════════════════════════════
  const isAssetsQ = moduleHint === 'assets'
    || /\basset\b|inventory|how many (asset|item|equipment|vehicle|furniture|thing|propert)|total (asset|inventory|worth|value of)|what (asset|equipment|vehicle)|our property|church property|what do we own|church resource|how many (car|truck|computer|chair|table|instrument|building)/.test(q);

  if (isAssetsQ) {
    const assets     = await fetchAssets(churchId || '');
    const totalValue = assets.reduce((s, a) => s + (a.value || 0), 0);
    const byCategory: Record<string, { count: number; value: number }> = {};
    assets.forEach(a => {
      if (!byCategory[a.category]) byCategory[a.category] = { count: 0, value: 0 };
      byCategory[a.category].count++;
      byCategory[a.category].value += a.value || 0;
    });
    const cond = { Good: 0, Fair: 0, Bad: 0 };
    assets.forEach(a => { cond[a.condition as keyof typeof cond]++; });

    // Specific category query (vehicles, furniture, etc.)
    const assetCategories = ['vehicle', 'furniture', 'electronics', 'ict', 'instruments', 'construction', 'kitchen'];
    const matchedCat = assetCategories.find(c => q.includes(c));
    if (matchedCat) {
      const catAssets = assets.filter(a => a.category.toLowerCase().includes(matchedCat));
      const catValue  = catAssets.reduce((s, a) => s + (a.value || 0), 0);
      return {
        question: rawQuestion,
        summary: `${matchedCat.charAt(0).toUpperCase() + matchedCat.slice(1)} assets: ${catAssets.length} items worth ${formatCurrency(catValue)}`,
        lines: [
          { label: 'Count', value: String(catAssets.length), highlight: true },
          { label: 'Total Value', value: formatCurrency(catValue), highlight: true },
          ...catAssets.slice(0, 8).map(a => ({
            label: `  └ ${a.name}`, value: `${a.condition} — ${formatCurrency(a.value || 0)}`, sub: true,
          })),
        ],
        reportData: catAssets.map(a => ({
          Name: a.name, Category: a.category, Condition: a.condition,
          Location: a.location, Value: a.value || 0,
        })),
        reportFilename: `Assets_${matchedCat}.xlsx`,
      };
    }

    return {
      question: rawQuestion,
      summary: `Total assets: ${assets.length} items valued at ${formatCurrency(totalValue)}`,
      lines: [
        { label: 'Total Asset Count', value: String(assets.length), highlight: true },
        { label: 'Total Asset Value', value: formatCurrency(totalValue), highlight: true },
        { label: 'Good Condition', value: String(cond.Good) },
        { label: 'Fair Condition', value: String(cond.Fair) },
        { label: 'Poor Condition', value: String(cond.Bad) },
        ...Object.entries(byCategory)
          .sort((a, b) => b[1].value - a[1].value)
          .map(([cat, { count, value }]) => ({
            label: `  └ ${cat}`, value: `${count} item(s) — ${formatCurrency(value)}`, sub: true,
          })),
      ],
      reportData: assets.map(a => ({
        Name: a.name, Category: a.category, Condition: a.condition,
        Location: a.location, Value: a.value || 0, 'Purchase Date': a.purchaseDate,
      })),
      reportFilename: 'Assets_Report.xlsx',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // HR & PAYROLL
  // ═══════════════════════════════════════════════════════════════
  const isPayrollQ = moduleHint === 'payroll'
    || /\bpayroll\b|\bsalary\b|\bsalaries\b|employee pay|staff pay|how much (do we pay|are we paying)|wages|how many (employ|staff\b|worker)|staff count|employee count|total staff|number of (employee|staff)|how many people (work|are employed)|our staff|our employee|staff member/.test(q);

  if (isPayrollQ) {
    // EMPLOYEE COUNT / LIST query
    if (/how many (employ|staff\b|worker|people (work|are employed))|staff count|employee count|total (staff|employee|worker)|number of (staff|employ)|how many people work|our employees|list.*staff|list.*employ/.test(q)) {
      const employees = await fetchEmployees(churchId || '');
      const active     = employees.filter(e => e.status === 'Active');
      const onLeave    = employees.filter(e => e.status === 'On Leave');
      const terminated = employees.filter(e => e.status === 'Terminated');
      const byDept: Record<string, number> = {};
      active.forEach(e => { byDept[e.department] = (byDept[e.department] || 0) + 1; });

      return {
        question: rawQuestion,
        summary: `Total employees: ${employees.length} (${active.length} active)`,
        lines: [
          { label: 'Total Employees', value: String(employees.length), highlight: true },
          { label: 'Active', value: String(active.length) },
          { label: 'On Leave', value: String(onLeave.length) },
          { label: 'Terminated / Exited', value: String(terminated.length) },
          ...Object.entries(byDept)
            .sort((a, b) => b[1] - a[1])
            .map(([dept, n]) => ({ label: `  └ ${dept}`, value: String(n), sub: true })),
        ],
        reportData: employees.map(e => ({
          Name: e.name, Role: e.role, Department: e.department,
          Status: e.status, Salary: e.salary,
        })),
        reportFilename: 'Employees_Report.xlsx',
      };
    }

    // TOTAL SALARY BILL from employee records (expected monthly cost)
    if (/salary bill|monthly (pay|salary|wage)|total (monthly|annual) (salary|pay|wage)|how much.*a month|annual salary/.test(q)) {
      const employees = await fetchEmployees(churchId || '');
      const active    = employees.filter(e => e.status === 'Active');
      const monthly   = active.reduce((s, e) => s + (e.salary || 0), 0);
      const annual    = monthly * 12;
      return {
        question: rawQuestion,
        summary: `Monthly salary bill for ${active.length} active staff: ${formatCurrency(monthly)}`,
        lines: [
          { label: 'Active Employees', value: String(active.length) },
          { label: 'Monthly Salary Bill', value: formatCurrency(monthly), highlight: true },
          { label: 'Annual Salary Cost', value: formatCurrency(annual) },
        ],
        reportData: active.map(e => ({ Name: e.name, Department: e.department, 'Monthly Salary': e.salary })),
        reportFilename: 'Salary_Bill.xlsx',
      };
    }

    // PAYROLL RECORDS query — use month field for filtering (most reliable)
    const payroll  = await fetchPayroll(churchId || '');
    const filtered = payroll.filter(p => period.filter(payrollDateStr(p)));
    const totalDue  = filtered.reduce((s, p) => s + p.totalSalary, 0);
    const totalPaid = filtered.reduce((s, p) => s + p.paidAmount, 0);
    const totalOwed = filtered.reduce((s, p) => s + p.balance, 0);
    const counts    = { Paid: 0, Partial: 0, Pending: 0 };
    filtered.forEach(p => { counts[p.status as keyof typeof counts]++; });

    // No period specified → show most recent month's payroll
    if (period.isAllTime && filtered.length === 0) {
      const sorted = [...payroll].sort((a, b) => payrollDateStr(b).localeCompare(payrollDateStr(a)));
      const recentMonth = sorted[0] ? payrollDateStr(sorted[0]).slice(0, 7) : '';
      const recent = recentMonth ? payroll.filter(p => payrollDateStr(p).startsWith(recentMonth)) : [];
      const rDue  = recent.reduce((s, p) => s + p.totalSalary, 0);
      const rPaid = recent.reduce((s, p) => s + p.paidAmount, 0);
      const rOwed = recent.reduce((s, p) => s + p.balance, 0);
      return {
        question: rawQuestion,
        summary: `Most recent payroll (${recentMonth || 'no records'}): ${formatCurrency(rPaid)} paid`,
        lines: [
          { label: `Payroll Period`, value: recentMonth || 'N/A' },
          { label: 'Total Salary Due', value: formatCurrency(rDue) },
          { label: 'Amount Paid', value: formatCurrency(rPaid), highlight: true },
          { label: 'Outstanding Balance', value: formatCurrency(rOwed) },
          ...recent.map(p => ({ label: `  └ ${p.employeeName}`, value: `${p.status} — ${formatCurrency(p.paidAmount)}`, sub: true })),
        ],
        reportData: recent.map(p => ({
          Month: p.month, Employee: p.employeeName,
          'Total Salary': p.totalSalary, Paid: p.paidAmount,
          Balance: p.balance, Status: p.status,
        })),
        reportFilename: `Payroll_${recentMonth}.xlsx`,
      };
    }

    // Specific period payroll
    const periodLabel = period.isAllTime ? 'all time' : period.label;
    if (filtered.length === 0 && !period.isAllTime) return noRecords(rawQuestion, period, 'Payroll');

    const data = period.isAllTime ? payroll : filtered;
    const dDue  = data.reduce((s, p) => s + p.totalSalary, 0);
    const dPaid = data.reduce((s, p) => s + p.paidAmount, 0);
    const dOwed = data.reduce((s, p) => s + p.balance, 0);
    const dCounts = { Paid: 0, Partial: 0, Pending: 0 };
    data.forEach(p => { dCounts[p.status as keyof typeof dCounts]++; });

    return {
      question: rawQuestion,
      summary: `Payroll${period.isAllTime ? ' (all time)' : ` — ${periodLabel}`}: ${formatCurrency(dPaid)} paid, ${formatCurrency(dOwed)} outstanding`,
      lines: [
        { label: `Salary Due — ${periodLabel}`, value: formatCurrency(dDue) },
        { label: 'Amount Paid', value: formatCurrency(dPaid), highlight: true },
        { label: 'Outstanding Balance', value: formatCurrency(dOwed) },
        { label: 'Fully Paid', value: String(dCounts.Paid) },
        { label: 'Partial', value: String(dCounts.Partial) },
        { label: 'Pending', value: String(dCounts.Pending) },
        ...data.slice(0, 8).map(p => ({ label: `  └ ${p.employeeName} (${p.month})`, value: `${p.status} — ${formatCurrency(p.paidAmount)}`, sub: true })),
      ],
      reportData: data.map(p => ({
        Month: p.month, Employee: p.employeeName,
        'Total Salary': p.totalSalary, Paid: p.paidAmount,
        Balance: p.balance, Status: p.status,
        'Payment Method': p.paymentMethod, Date: p.paymentDate,
      })),
      reportFilename: `Payroll_${periodLabel.replace(/[^a-z0-9]/gi, '_')}.xlsx`,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PLEDGES
  // ═══════════════════════════════════════════════════════════════
  const isPledgeQ = moduleHint === 'pledges'
    || /\bpledge\b|how much (has been|have people) pledged|project commitment|project fund/.test(q);

  if (isPledgeQ) {
    const pledges   = await fetchPledges(churchId || '');
    const fulfilled = pledges.filter(p => p.status === 'Fulfilled');
    const pending   = pledges.filter(p => p.status === 'Pending');
    const total     = pledges.reduce((s, p) => s + p.amount, 0);
    const fulAmt    = fulfilled.reduce((s, p) => s + p.amount, 0);
    const penAmt    = pending.reduce((s, p) => s + p.amount, 0);
    const byProject: Record<string, { total: number; fulfilled: number }> = {};
    pledges.forEach(p => {
      if (!byProject[p.project]) byProject[p.project] = { total: 0, fulfilled: 0 };
      byProject[p.project].total += p.amount;
      if (p.status === 'Fulfilled') byProject[p.project].fulfilled += p.amount;
    });

    return {
      question: rawQuestion,
      summary: `Total pledges: ${pledges.length} records — ${formatCurrency(total)} pledged`,
      lines: [
        { label: 'Total Pledge Records', value: String(pledges.length) },
        { label: 'Total Pledged Amount', value: formatCurrency(total), highlight: true },
        { label: `Fulfilled (${fulfilled.length} records)`, value: formatCurrency(fulAmt) },
        { label: `Pending (${pending.length} records)`, value: formatCurrency(penAmt) },
        { label: 'Collection Rate', value: total > 0 ? `${Math.round((fulAmt / total) * 100)}%` : '0%' },
        ...Object.entries(byProject)
          .sort((a, b) => b[1].total - a[1].total).slice(0, 5)
          .map(([proj, { total: t, fulfilled: f }]) => ({
            label: `  └ ${proj}`, value: `${formatCurrency(f)} / ${formatCurrency(t)}`, sub: true,
          })),
      ],
      reportData: pledges.map(p => ({
        Date: p.date, Member: p.memberName, Project: p.project,
        Amount: p.amount, Status: p.status,
      })),
      reportFilename: 'Pledges_Report.xlsx',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // REQUISITIONS
  // ═══════════════════════════════════════════════════════════════
  const isReqQ = moduleHint === 'requisitions'
    || /\brequisition\b|department (request|need)|pending (approval|request)|approved request|what (request|need) is pending/.test(q);

  if (isReqQ) {
    const reqs    = await fetchRequisitions(churchId || '');
    const pending  = reqs.filter(r => r.status === RequisitionStatus.PENDING);
    const approved = reqs.filter(r => r.status === RequisitionStatus.APPROVED);
    const declined = reqs.filter(r => r.status === RequisitionStatus.DECLINED);
    const cost = (r: Requisition) => r.total ?? r.cost ?? r.estimatedCost ?? 0;
    const byDept: Record<string, number> = {};
    reqs.forEach(r => { byDept[r.department] = (byDept[r.department] || 0) + cost(r); });

    return {
      question: rawQuestion,
      summary: `Requisitions: ${reqs.length} total — ${pending.length} pending, ${approved.length} approved`,
      lines: [
        { label: 'Total Requisitions', value: String(reqs.length) },
        { label: `Pending (${pending.length})`, value: formatCurrency(pending.reduce((s, r) => s + cost(r), 0)) },
        { label: `Approved (${approved.length})`, value: formatCurrency(approved.reduce((s, r) => s + cost(r), 0)), highlight: true },
        { label: `Declined (${declined.length})`, value: '—' },
        ...Object.entries(byDept)
          .sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([dept, amt]) => ({ label: `  └ ${dept}`, value: formatCurrency(amt), sub: true })),
      ],
      reportData: reqs.map(r => ({
        Department: r.department, Item: r.itemName || r.items || '-',
        'Requested By': r.requestedBy, Cost: cost(r), Status: r.status,
      })),
      reportFilename: 'Requisitions_Report.xlsx',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FINANCE: Treasury / Balance
  // ═══════════════════════════════════════════════════════════════
  if (/treasury|how much (money|funds|cash) (do we have|is (there|available))|available (balance|fund|money)|current balance|what.?s (our|the) balance|how much (is in the|do we have in)|net balance|bank balance|our funds|church funds|how much cash|check.*(balance|fund)/.test(q)) {
    const [income, expenses] = await Promise.all([fetchIncome(churchId || ''), fetchExpenses(churchId || '')]);
    const totalIncome   = income.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const balance       = totalIncome - totalExpenses;
    const byType: Record<string, number> = {};
    income.forEach(r => { byType[r.type] = (byType[r.type] || 0) + r.amount; });

    return {
      question: rawQuestion,
      summary: `Current treasury balance: ${formatCurrency(balance)}`,
      lines: [
        { label: 'Total Income Received (all time)', value: formatCurrency(totalIncome) },
        { label: 'Total Expenses Paid (all time)', value: formatCurrency(totalExpenses) },
        { label: 'Available Treasury Balance', value: formatCurrency(balance), highlight: true },
        ...Object.entries(byType).map(([t, a]) => ({ label: `  └ ${t}`, value: formatCurrency(a), sub: true })),
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FINANCE: Tithe
  // ═══════════════════════════════════════════════════════════════
  if (/\btithe\b/.test(q)) {
    const income   = await fetchIncome(churchId || '');
    // Default to current month if no date given
    const activePeriod = period.isAllTime
      ? { ...parsePeriod('this month'), label: 'this month' }
      : period;
    const filtered = income.filter(r => r.type === TransactionType.TITHE && activePeriod.filter(r.date));
    const total    = filtered.reduce((s, r) => s + r.amount, 0);
    return {
      question: rawQuestion,
      summary: `Tithe — ${activePeriod.label}: ${formatCurrency(total)}`,
      lines: [
        { label: `Tithe — ${activePeriod.label}`, value: formatCurrency(total), highlight: true },
        { label: 'Number of Records', value: String(filtered.length) },
        ...(filtered.length > 0 ? [
          { label: 'Highest Single Tithe', value: formatCurrency(Math.max(...filtered.map(r => r.amount))) },
          { label: 'Average Tithe', value: formatCurrency(Math.round(total / filtered.length)) },
        ] : []),
      ],
      reportData: filtered.map(r => ({
        Date: r.date, Member: r.memberName || 'Anonymous',
        Amount: r.amount, Service: r.serviceName || '-',
      })),
      reportFilename: `Tithe_${activePeriod.label.replace(/[^a-z0-9]/gi, '_')}.xlsx`,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FINANCE: Offering
  // ═══════════════════════════════════════════════════════════════
  if (/\boffering\b/.test(q)) {
    const income   = await fetchIncome(churchId || '');
    const activePeriod = period.isAllTime ? { ...parsePeriod('this month'), label: 'this month' } : period;
    const filtered = income.filter(r => r.type === TransactionType.OFFERING && activePeriod.filter(r.date));
    const total    = filtered.reduce((s, r) => s + r.amount, 0);
    return {
      question: rawQuestion,
      summary: `Offering — ${activePeriod.label}: ${formatCurrency(total)}`,
      lines: [
        { label: `Offering — ${activePeriod.label}`, value: formatCurrency(total), highlight: true },
        { label: 'Number of Records', value: String(filtered.length) },
        ...(filtered.length > 0 ? [
          { label: 'Highest Single Offering', value: formatCurrency(Math.max(...filtered.map(r => r.amount))) },
          { label: 'Average Offering', value: formatCurrency(Math.round(total / filtered.length)) },
        ] : []),
      ],
      reportData: filtered.map(r => ({
        Date: r.date, Member: r.memberName || 'Anonymous',
        Amount: r.amount, Service: r.serviceName || '-',
      })),
      reportFilename: `Offering_${activePeriod.label.replace(/[^a-z0-9]/gi, '_')}.xlsx`,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FINANCE: Donation
  // ═══════════════════════════════════════════════════════════════
  if (/\bdonation\b|\bdonate\b/.test(q)) {
    const income   = await fetchIncome(churchId || '');
    const filtered = income.filter(r => r.type === TransactionType.DONATION && period.filter(r.date));
    const total    = filtered.reduce((s, r) => s + r.amount, 0);
    return {
      question: rawQuestion,
      summary: `Donations${period.isAllTime ? ' (all time)' : ` — ${period.label}`}: ${formatCurrency(total)}`,
      lines: [
        { label: `Donations${period.isAllTime ? '' : ` — ${period.label}`}`, value: formatCurrency(total), highlight: true },
        { label: 'Number of Records', value: String(filtered.length) },
      ],
      reportData: filtered.map(r => ({
        Date: r.date, Member: r.memberName || 'Anonymous',
        Amount: r.amount, Category: r.category || '-', Description: r.description || '-',
      })),
      reportFilename: `Donations_${period.label.replace(/[^a-z0-9]/gi, '_')}.xlsx`,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FINANCE: Expenses (with optional specific type)
  // ═══════════════════════════════════════════════════════════════
  if (
    /expense|how much (have we|did we) spend|spending|expenditure|how much (we spent|was spent|did we pay out)|daily cost|running cost|operational cost|overhead|what did we spend|money (we spent|that went out)|outflow/.test(q)
    || moduleHint === 'finance' && /spend|cost|pay/.test(q)
  ) {
    const expenses    = await fetchExpenses(churchId || '');
    const specificType = matchExpenseType(q);
    const activePeriod = period.isAllTime ? { ...parsePeriod('this month'), label: 'this month' } : period;

    const filtered = expenses.filter(e =>
      activePeriod.filter(e.date) && (specificType ? e.type === specificType : true)
    );
    const total = filtered.reduce((s, e) => s + e.amount, 0);

    const lines: QALine[] = [];
    const label = specificType
      ? `${specificType} Expenses — ${activePeriod.label}`
      : `Total Expenses — ${activePeriod.label}`;
    lines.push({ label, value: formatCurrency(total), highlight: true });
    lines.push({ label: 'Number of Records', value: String(filtered.length) });

    if (!specificType) {
      const byType: Record<string, number> = {};
      filtered.forEach(e => { byType[e.type] = (byType[e.type] || 0) + e.amount; });
      Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([t, a]) => lines.push({ label: `  └ ${t}`, value: formatCurrency(a), sub: true }));
    }

    return {
      question: rawQuestion,
      summary: specificType
        ? `${specificType} expenses — ${activePeriod.label}: ${formatCurrency(total)}`
        : `Total expenses — ${activePeriod.label}: ${formatCurrency(total)}`,
      lines,
      reportData: filtered.map(e => ({
        Date: e.date, Type: e.type, Category: e.category,
        Description: e.description, Amount: e.amount,
      })),
      reportFilename: `Expenses_${(specificType ?? 'All')}_${activePeriod.label.replace(/[^a-z0-9]/gi, '_')}.xlsx`,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FINANCE: Income / Contributions (general)
  // ═══════════════════════════════════════════════════════════════
  if (
    /total income|how much (have we|did we) (receive|collect|get|make)|income (this|last|in|for)|contribution|how much came in|total collection|how much money (came|received|did we receive|did we get)|what did we receive|what came in|revenue this|income report/.test(q)
    || (moduleHint === 'finance' && !/expense|spent|spend/.test(q))
  ) {
    const income   = await fetchIncome(churchId || '');
    const activePeriod = period.isAllTime ? { ...parsePeriod('this month'), label: 'this month' } : period;
    const filtered = income.filter(r => activePeriod.filter(r.date));
    const total    = filtered.reduce((s, r) => s + r.amount, 0);
    const byType: Record<string, number> = {};
    filtered.forEach(r => { byType[r.type] = (byType[r.type] || 0) + r.amount; });

    return {
      question: rawQuestion,
      summary: `Total income — ${activePeriod.label}: ${formatCurrency(total)}`,
      lines: [
        { label: `Total Income — ${activePeriod.label}`, value: formatCurrency(total), highlight: true },
        { label: 'Number of Records', value: String(filtered.length) },
        ...Object.entries(byType)
          .sort((a, b) => b[1] - a[1])
          .map(([t, a]) => ({ label: `  └ ${t}`, value: formatCurrency(a), sub: true })),
      ],
      reportData: filtered.map(r => ({
        Date: r.date, Type: r.type, Member: r.memberName || 'Anonymous',
        Amount: r.amount, Service: r.serviceName || '-',
      })),
      reportFilename: `Income_${activePeriod.label.replace(/[^a-z0-9]/gi, '_')}.xlsx`,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FINANCE: Full Summary / Overview
  // ═══════════════════════════════════════════════════════════════
  if (/summary|report|overview|financial (status|picture|health)|how are we doing financially|full (financial )?report|finance summary/.test(q)) {
    const activePeriod = period.isAllTime ? { ...parsePeriod('this month'), label: 'this month' } : period;
    const [income, expenses, pledges, payroll] = await Promise.all([
      fetchIncome(churchId || ''), fetchExpenses(churchId || ''), fetchPledges(churchId || ''), fetchPayroll(churchId || ''),
    ]);
    const fInc = income.filter(r => activePeriod.filter(r.date));
    const fExp = expenses.filter(e => activePeriod.filter(e.date));
    const fPay = payroll.filter(p => activePeriod.filter(payrollDateStr(p)));

    const totalInc = fInc.reduce((s, r) => s + r.amount, 0);
    const totalExp = fExp.reduce((s, e) => s + e.amount, 0);
    const balance  = totalInc - totalExp;
    const byType: Record<string, number> = {};
    fInc.forEach(r => { byType[r.type] = (byType[r.type] || 0) + r.amount; });

    return {
      question: rawQuestion,
      summary: `Financial overview — ${activePeriod.label}: Net balance ${formatCurrency(balance)}`,
      lines: [
        { label: 'Period', value: activePeriod.label },
        { label: 'Total Income', value: formatCurrency(totalInc) },
        ...Object.entries(byType).map(([t, a]) => ({ label: `  └ ${t}`, value: formatCurrency(a), sub: true })),
        { label: 'Total Expenses', value: formatCurrency(totalExp) },
        { label: '  └ Payroll Paid Out', value: formatCurrency(fPay.reduce((s, p) => s + p.paidAmount, 0)), sub: true },
        { label: 'Net Balance', value: formatCurrency(balance), highlight: true },
        { label: 'Total Pledges (all time)', value: formatCurrency(pledges.reduce((s, p) => s + p.amount, 0)) },
        { label: 'Fulfilled Pledges', value: formatCurrency(pledges.filter(p => p.status === 'Fulfilled').reduce((s, p) => s + p.amount, 0)), sub: true },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FALLBACK
  // ═══════════════════════════════════════════════════════════════
  return {
    question: rawQuestion,
    summary: "I'm not sure I understood that question.",
    lines: [],
    error: `Try asking about: treasury balance · income · tithe · offering · expenses · attendance · members · assets · payroll · employees · pledges · requisitions.\n\nYou can include dates like "this month", "last Sunday", "July 2026", or "22nd June 2026".`,
  };
}
