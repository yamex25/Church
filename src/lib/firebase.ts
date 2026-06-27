import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { Expense, FinanceRecord, ExpenseType } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Connectivity Test
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase connection verified');
    return true;
  } catch (error) {
    console.error('Firebase connection check failed:', error);
    return false;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ─── Church-scoped expense/finance helpers ────────────────────────────────────
// These functions require a churchId so all data stays within the church tenant.

function expensesRef(churchId: string) {
  return collection(db, 'churches', churchId, 'expenses');
}

function financeRef(churchId: string) {
  return collection(db, 'churches', churchId, 'finance');
}

export async function recordExpense(
  churchId: string,
  expense: Omit<Expense, 'id' | 'createdAt' | 'churchId'>,
) {
  try {
    const newExpense = { ...expense, churchId, createdAt: new Date().toISOString() };
    const docRef = await addDoc(expensesRef(churchId), newExpense);
    return { id: docRef.id, ...newExpense };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `churches/${churchId}/expenses`);
  }
}

export async function getExpensesByDateRange(
  churchId: string,
  startDate: string,
  endDate: string,
) {
  try {
    const q = query(
      expensesRef(churchId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `churches/${churchId}/expenses`);
  }
}

export async function getExpensesByType(churchId: string, type: ExpenseType) {
  try {
    const q = query(expensesRef(churchId), where('type', '==', type));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `churches/${churchId}/expenses`);
  }
}

export async function getAllExpenses(churchId: string) {
  try {
    const snapshot = await getDocs(expensesRef(churchId));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `churches/${churchId}/expenses`);
  }
}

export async function getAllIncome(churchId: string) {
  try {
    const snapshot = await getDocs(financeRef(churchId));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FinanceRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `churches/${churchId}/finance`);
  }
}

export async function calculateBalance(churchId: string) {
  try {
    const [expenses, income] = await Promise.all([
      getAllExpenses(churchId),
      getAllIncome(churchId),
    ]);
    const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0;
    const totalIncome = income?.reduce((sum, r) => sum + r.amount, 0) ?? 0;
    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `churches/${churchId}/balance`);
  }
}
