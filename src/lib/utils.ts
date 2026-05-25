import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { utils, writeFile } from 'xlsx';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, startOfWeek, endOfWeek, format, parseISO } from 'date-fns';
import { Expense, FinanceRecord } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateAge(dob: string) {
  if (!dob) return 'N/A';
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function downloadExcel(data: any[], filename: string) {
  const worksheet = utils.json_to_sheet(data);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Data");
  writeFile(workbook, filename);
}

// Financial Aggregation Functions
export function aggregateIncomeByPeriod(
  records: FinanceRecord[],
  period: 'week' | 'month' | 'year',
  referenceDate: Date = new Date()
) {
  let startDate: Date, endDate: Date;

  if (period === 'month') {
    startDate = startOfMonth(referenceDate);
    endDate = endOfMonth(referenceDate);
  } else if (period === 'year') {
    startDate = startOfYear(referenceDate);
    endDate = endOfYear(referenceDate);
  } else {
    startDate = startOfWeek(referenceDate);
    endDate = endOfWeek(referenceDate);
  }

  return records
    .filter(record => {
      const recordDate = parseISO(record.date);
      return recordDate >= startDate && recordDate <= endDate;
    })
    .reduce((sum, record) => sum + record.amount, 0);
}

export function aggregateExpenseByPeriod(
  expenses: Expense[],
  period: 'week' | 'month' | 'year',
  referenceDate: Date = new Date()
) {
  let startDate: Date, endDate: Date;

  if (period === 'month') {
    startDate = startOfMonth(referenceDate);
    endDate = endOfMonth(referenceDate);
  } else if (period === 'year') {
    startDate = startOfYear(referenceDate);
    endDate = endOfYear(referenceDate);
  } else {
    startDate = startOfWeek(referenceDate);
    endDate = endOfWeek(referenceDate);
  }

  return expenses
    .filter(expense => {
      const expenseDate = parseISO(expense.date);
      return expenseDate >= startDate && expenseDate <= endDate;
    })
    .reduce((sum, expense) => sum + expense.amount, 0);
}

export interface ChartDataPoint {
  date: string;
  income: number;
  expense: number;
}

export function getChartData(
  income: FinanceRecord[],
  expenses: Expense[],
  startDate: string,
  endDate: string,
  granularity: 'daily' | 'weekly' | 'monthly' = 'daily'
): ChartDataPoint[] {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const dataMap: { [key: string]: { income: number; expense: number } } = {};

  // Initialize all dates
  let currentDate = new Date(start);
  while (currentDate <= end) {
    let key: string;
    if (granularity === 'monthly') {
      key = format(currentDate, 'yyyy-MM');
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (granularity === 'weekly') {
      key = format(startOfWeek(currentDate), 'yyyy-MM-dd');
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      key = format(currentDate, 'yyyy-MM-dd');
      currentDate.setDate(currentDate.getDate() + 1);
    }
    if (!dataMap[key]) {
      dataMap[key] = { income: 0, expense: 0 };
    }
  }

  // Aggregate income
  income.forEach(record => {
    const recordDate = parseISO(record.date);
    if (recordDate >= start && recordDate <= end) {
      let key: string;
      if (granularity === 'monthly') {
        key = format(recordDate, 'yyyy-MM');
      } else if (granularity === 'weekly') {
        key = format(startOfWeek(recordDate), 'yyyy-MM-dd');
      } else {
        key = format(recordDate, 'yyyy-MM-dd');
      }
      if (dataMap[key]) {
        dataMap[key].income += record.amount;
      }
    }
  });

  // Aggregate expenses
  expenses.forEach(expense => {
    const expenseDate = parseISO(expense.date);
    if (expenseDate >= start && expenseDate <= end) {
      let key: string;
      if (granularity === 'monthly') {
        key = format(expenseDate, 'yyyy-MM');
      } else if (granularity === 'weekly') {
        key = format(startOfWeek(expenseDate), 'yyyy-MM-dd');
      } else {
        key = format(expenseDate, 'yyyy-MM-dd');
      }
      if (dataMap[key]) {
        dataMap[key].expense += expense.amount;
      }
    }
  });

  return Object.keys(dataMap)
    .sort()
    .map(date => ({
      date,
      ...dataMap[date],
    }));
}

export function aggregateByExpenseType(
  expenses: Expense[]
): { type: string; amount: number }[] {
  const typeMap: { [key: string]: number } = {};

  expenses.forEach(expense => {
    if (!typeMap[expense.type]) {
      typeMap[expense.type] = 0;
    }
    typeMap[expense.type] += expense.amount;
  });

  return Object.keys(typeMap).map(type => ({
    type,
    amount: typeMap[type],
  }));
}
