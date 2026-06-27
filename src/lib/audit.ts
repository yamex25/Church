/**
 * Audit trail utility — writes a record to churches/{churchId}/auditLogs
 * every time a significant action is performed.
 *
 * Usage:
 *   await logAudit(churchId, user, {
 *     module: 'requisitions',
 *     action: 'requisition.admin_reviewed',
 *     entityType: 'requisition',
 *     entityId: req.id,
 *     details: `Admin reviewed requisition from ${req.department}`,
 *   });
 */

import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { AppUser } from '../types';

export interface AuditEntry {
  module: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(
  churchId: string,
  user: AppUser,
  entry: AuditEntry,
): Promise<void> {
  try {
    await addDoc(collection(db, 'churches', churchId, 'auditLogs'), {
      churchId,
      timestamp: new Date().toISOString(),
      userId: user.uid,
      username: user.username ?? null,
      displayName: user.displayName,
      email: user.email,
      department: user.department ?? null,
      role: user.role,
      module: entry.module,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      details: entry.details,
      metadata: entry.metadata ?? null,
    });
  } catch (e) {
    // Audit logging must never crash the app
    console.warn('Audit log write failed:', e);
  }
}

// ─── Canonical action strings ──────────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  // Members
  MEMBER_CREATED:          'member.created',
  MEMBER_UPDATED:          'member.updated',
  MEMBER_DELETED:          'member.deleted',
  MEMBER_ACCOUNT_DISABLED: 'member.account_disabled',
  MEMBER_ACCOUNT_ENABLED:  'member.account_enabled',
  MEMBER_PASSWORD_RESET:   'member.password_reset',

  // Requisitions
  REQUISITION_SUBMITTED:       'requisition.submitted',
  REQUISITION_UNDER_REVIEW:    'requisition.under_review',
  REQUISITION_ADMIN_APPROVED:  'requisition.admin_approved',
  REQUISITION_FINANCE_APPROVED:'requisition.finance_approved',
  REQUISITION_DECLINED:        'requisition.declined',

  // Finance
  FINANCE_INCOME_RECORDED:  'finance.income_recorded',
  FINANCE_EXPENSE_RECORDED: 'finance.expense_recorded',
  FINANCE_PAYMENT_APPROVED: 'finance.payment_approved',

  // Payroll
  PAYROLL_PROCESSED:  'payroll.processed',
  PAYROLL_APPROVED:   'payroll.approved',
  SALARY_PAID:        'payroll.salary_paid',

  // Users & Admin
  USER_CREATED:    'user.created',
  USER_ROLE_CHANGED:'user.role_changed',
  USER_DISABLED:   'user.disabled',
  USER_ENABLED:    'user.enabled',

  // Events
  EVENT_CREATED:  'event.created',
  EVENT_CANCELLED:'event.cancelled',
} as const;
