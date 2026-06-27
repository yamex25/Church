/**
 * Church-scoped Firestore helpers.
 * Every data collection lives under churches/{churchId}/...
 * Use these instead of bare collection(db, 'X') to enforce tenant isolation.
 */

import { db } from './firebase';
import { collection, doc, CollectionReference, DocumentReference, DocumentData } from 'firebase/firestore';

// All data collections that live under a church tenant
export type ChurchCollection =
  | 'members'
  | 'finance'
  | 'expenses'
  | 'prayerRequests'
  | 'requisitions'
  | 'pledges'
  | 'projects'
  | 'services'
  | 'financeTypes'
  | 'visitors'
  | 'broadcasts'
  | 'assets'
  | 'events'
  | 'attendance'
  | 'employees'
  | 'payroll'
  | 'departments'
  | 'configs'
  | 'zones'
  | 'cells'
  | 'testimonies';

/**
 * Returns a reference to a top-level church-scoped collection.
 * churches/{churchId}/{name}
 */
export function churchCol(
  churchId: string,
  name: ChurchCollection,
): CollectionReference<DocumentData> {
  return collection(db, 'churches', churchId, name);
}

/**
 * Returns a reference to a specific document inside a church collection.
 * churches/{churchId}/{name}/{docId}
 */
export function churchDoc(
  churchId: string,
  name: ChurchCollection,
  docId: string,
): DocumentReference<DocumentData> {
  return doc(db, 'churches', churchId, name, docId);
}

/**
 * Returns the church metadata document reference.
 * churches/{churchId}
 */
export function churchRef(churchId: string): DocumentReference<DocumentData> {
  return doc(db, 'churches', churchId);
}

/**
 * Returns the churches top-level collection reference.
 */
export function churchesCol(): CollectionReference<DocumentData> {
  return collection(db, 'churches');
}

/**
 * Returns the users top-level collection reference.
 * Users live at the top level (not scoped to a church) so their churchId
 * can be looked up on sign-in before we know which church they belong to.
 */
export function usersCol(): CollectionReference<DocumentData> {
  return collection(db, 'users');
}

/**
 * Returns a user document reference.
 */
export function userDoc(uid: string): DocumentReference<DocumentData> {
  return doc(db, 'users', uid);
}
