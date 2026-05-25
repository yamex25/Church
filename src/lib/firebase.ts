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
  Timestamp,
} from 'firebase/firestore';
import { Expense, FinanceRecord, ExpenseType } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Connectivity Test (Disabled module-level to prevent unhandled rejections)
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase connection verified');
    return true;
  } catch (error) {
    console.error("Firebase connection check failed:", error);
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
  }
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
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Expense Management Functions
export async function recordExpense(expense: Omit<Expense, 'id' | 'createdAt'>) {
  try {
    const expenseRef = collection(db, 'expenses');
    const newExpense = {
      ...expense,
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(expenseRef, newExpense);
    return { id: docRef.id, ...newExpense };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'expenses');
  }
}

export async function getExpensesByDateRange(startDate: string, endDate: string) {
  try {
    const expenseRef = collection(db, 'expenses');
    const q = query(
      expenseRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'expenses');
  }
}

export async function getExpensesByType(type: ExpenseType) {
  try {
    const expenseRef = collection(db, 'expenses');
    const q = query(expenseRef, where('type', '==', type));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'expenses');
  }
}

export async function getAllExpenses() {
  try {
    const expenseRef = collection(db, 'expenses');
    const snapshot = await getDocs(expenseRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'expenses');
  }
}

export async function getAllIncome() {
  try {
    const financeRef = collection(db, 'finance');
    const snapshot = await getDocs(financeRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinanceRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'finance');
  }
}

export async function calculateBalance() {
  try {
    const expenses = await getAllExpenses();
    const income = await getAllIncome();

    const totalExpenses = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
    const totalIncome = income?.reduce((sum, rec) => sum + rec.amount, 0) || 0;

    return {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'balance-calculation');
  }
}

