/**
 * Canonical list of all admin dashboard modules and action-level permissions.
 * Super Admins and Platform Owners always have all access.
 */

// ─── Module definitions ───────────────────────────────────────────────────────

export interface ModuleDef {
  id: string;
  label: string;
  path: string;
  description: string;
}

export const MODULE_DEFS: ModuleDef[] = [
  { id: 'dashboard',      label: 'Dashboard',        path: '/admin',                  description: 'Overview, stats and quick-access cards' },
  { id: 'members',        label: 'Members',           path: '/admin/members',          description: 'Church membership registry and profiles' },
  { id: 'home_cell',      label: 'Home Cell',         path: '/admin/home-cell',        description: 'Zones, cells and home-cell groups' },
  { id: 'attendance',     label: 'Attendance',        path: '/admin/attendance',       description: 'Service attendance tracking and reports' },
  { id: 'finance',        label: 'Finance',           path: '/admin/finance',          description: 'Tithes, offerings, income and transactions' },
  { id: 'daily_expenses', label: 'Daily Expenses',    path: '/admin/daily-expenses',   description: 'Day-to-day expense recording' },
  { id: 'hr',             label: 'HR & Payroll',      path: '/admin/hr',               description: 'Staff contracts, payroll and departments' },
  { id: 'events',         label: 'Events',            path: '/admin/events',           description: 'Church services, programs and meetings' },
  { id: 'prayer',         label: 'Prayer Requests',   path: '/admin/prayer-requests',  description: 'Prayer requests and testimonies' },
  { id: 'requisitions',   label: 'Requisitions',      path: '/admin/requisitions',     description: 'Department resource requisitions' },
  { id: 'communications', label: 'Communications',    path: '/admin/communications',   description: 'Broadcasts and bulk announcements' },
  { id: 'pledges',        label: 'Project Pledges',   path: '/admin/pledges',          description: 'Project pledge tracking and fulfilment' },
  { id: 'visitors',       label: 'Visitor Care',      path: '/admin/visitors',         description: 'New visitor management and follow-up' },
  { id: 'assets',         label: 'Assets',            path: '/admin/assets',           description: 'Church asset and inventory tracking' },
  { id: 'ask',            label: 'Ask a Question',    path: '/admin/ask',              description: 'AI-powered church data query assistant' },
  { id: 'users',          label: 'User Management',   path: '/admin/users',            description: 'Create and manage admin user accounts' },
  { id: 'audit',          label: 'Audit Trail',       path: '/admin/audit',            description: 'System-wide action history and accountability' },
];

export type ModuleId = typeof MODULE_DEFS[number]['id'];
export const ALL_MODULE_IDS: ModuleId[] = MODULE_DEFS.map(m => m.id as ModuleId);

// ─── Action-level permission definitions ──────────────────────────────────────
// Fine-grained permissions within modules. Super Admin/Platform Owner bypass all.

export interface ActionDef {
  id: string;
  label: string;
  description: string;
  moduleId: string;
  category?: string;
}

export const ACTION_DEFS: ActionDef[] = [

  // ── Member Management ──────────────────────────────────────────────────────
  { id: 'members:view',            label: 'View Members',            description: 'Read member profiles and list',              moduleId: 'members',      category: 'Members' },
  { id: 'members:create',          label: 'Create Members',          description: 'Add new member records',                     moduleId: 'members',      category: 'Members' },
  { id: 'members:edit',            label: 'Edit Members',            description: 'Modify existing member profiles',            moduleId: 'members',      category: 'Members' },
  { id: 'members:delete',          label: 'Delete Members',          description: 'Remove member records',                      moduleId: 'members',      category: 'Members' },
  { id: 'members:manage_accounts', label: 'Manage Portal Accounts',  description: 'Disable, enable, reset member passwords',    moduleId: 'members',      category: 'Members' },

  // ── Finance ───────────────────────────────────────────────────────────────
  { id: 'finance:view',             label: 'View Finance Records',    description: 'Read income and expense records',            moduleId: 'finance',      category: 'Finance' },
  { id: 'finance:record_income',    label: 'Record Income',           description: 'Add tithes, offerings and donations',        moduleId: 'finance',      category: 'Finance' },
  { id: 'finance:record_expense',   label: 'Record Expenses',         description: 'Add expense entries',                        moduleId: 'finance',      category: 'Finance' },
  { id: 'finance:delete',           label: 'Delete Finance Records',  description: 'Remove income and expense entries',           moduleId: 'finance',      category: 'Finance' },
  { id: 'finance:approve_payment',  label: 'Approve Payments',        description: 'Authorise and process payment transactions',  moduleId: 'finance',      category: 'Finance' },
  { id: 'finance:view_reports',     label: 'View Financial Reports',  description: 'Access financial summaries and reports',      moduleId: 'finance',      category: 'Finance' },

  // ── HR & Payroll ──────────────────────────────────────────────────────────
  { id: 'hr:view',                  label: 'View HR Records',         description: 'Read employee contracts and profiles',        moduleId: 'hr',           category: 'HR' },
  { id: 'hr:manage_employees',      label: 'Manage Employees',        description: 'Create and edit employee records',            moduleId: 'hr',           category: 'HR' },
  { id: 'hr:payroll_view',          label: 'View Payroll',            description: 'Read payroll records and salary information', moduleId: 'hr',           category: 'Payroll' },
  { id: 'hr:payroll_process',       label: 'Process Payroll',         description: 'Create payroll entries and mark payments',    moduleId: 'hr',           category: 'Payroll' },
  { id: 'hr:payroll_approve',       label: 'Approve Salary Payments', description: 'Authorise and approve salary disbursements',  moduleId: 'hr',           category: 'Payroll' },

  // ── Requisitions ──────────────────────────────────────────────────────────
  { id: 'requisitions:submit',         label: 'Submit Requisitions',        description: 'Create and submit new requisitions',               moduleId: 'requisitions', category: 'Requisitions' },
  { id: 'requisitions:admin_review',   label: 'Review Requisitions (Admin)',description: 'Review, comment and recommend requisitions',        moduleId: 'requisitions', category: 'Requisitions' },
  { id: 'requisitions:finance_approve',label: 'Approve Requisitions (Finance)', description: 'Give final financial approval, record expense', moduleId: 'requisitions', category: 'Requisitions' },
  { id: 'requisitions:decline',        label: 'Decline Requisitions',       description: 'Reject requisitions at any stage',                  moduleId: 'requisitions', category: 'Requisitions' },
  { id: 'requisitions:view_all',       label: 'View All Requisitions',      description: 'See requisitions from all departments',             moduleId: 'requisitions', category: 'Requisitions' },

  // ── Events ────────────────────────────────────────────────────────────────
  { id: 'events:manage',   label: 'Manage Events',   description: 'Create, edit and cancel events',    moduleId: 'events',        category: 'Events' },

  // ── Communications ────────────────────────────────────────────────────────
  { id: 'communications:send',    label: 'Send Broadcasts',    description: 'Send mass announcements to members', moduleId: 'communications', category: 'Communications' },

  // ── User Management ───────────────────────────────────────────────────────
  { id: 'users:view',    label: 'View Users',    description: 'List admin users and their permissions', moduleId: 'users', category: 'Users' },
  { id: 'users:create',  label: 'Create Users',  description: 'Add new admin user accounts',            moduleId: 'users', category: 'Users' },
  { id: 'users:edit',    label: 'Edit Users',    description: 'Modify user roles and permissions',      moduleId: 'users', category: 'Users' },
  { id: 'users:disable', label: 'Disable Users', description: 'Deactivate admin accounts',              moduleId: 'users', category: 'Users' },
];

export type ActionId = typeof ACTION_DEFS[number]['id'];

// ─── Department-based permission presets ──────────────────────────────────────
// When a user is assigned to a department, suggest these action permissions.

export const DEPARTMENT_ACTION_PRESETS: Record<string, ActionId[]> = {
  finance: [
    'finance:view', 'finance:record_income', 'finance:record_expense',
    'finance:approve_payment', 'finance:view_reports',
    'hr:payroll_view', 'hr:payroll_process', 'hr:payroll_approve',
    'requisitions:finance_approve', 'requisitions:decline', 'requisitions:view_all',
  ],
  accounts: [
    'finance:view', 'finance:record_income', 'finance:record_expense',
    'finance:approve_payment', 'finance:view_reports',
    'hr:payroll_view', 'hr:payroll_process', 'hr:payroll_approve',
    'requisitions:finance_approve', 'requisitions:decline', 'requisitions:view_all',
  ],
  administration: [
    'members:view', 'members:create', 'members:edit',
    'requisitions:submit', 'requisitions:admin_review', 'requisitions:decline', 'requisitions:view_all',
    'events:manage', 'communications:send',
  ],
  hr: [
    'members:view', 'hr:view', 'hr:manage_employees',
    'hr:payroll_view',
    'requisitions:submit',
  ],
  procurement: [
    'requisitions:submit', 'requisitions:admin_review', 'requisitions:view_all',
    'assets:manage',
  ],
};

// ─── Default plan → module mappings (used when Firestore doc hasn't been set) ──

export const DEFAULT_PLAN_MODULES: Record<string, string[]> = {
  basic: [
    'dashboard', 'members', 'home_cell', 'attendance',
    'events', 'prayer', 'visitors',
  ],
  standard: [
    'dashboard', 'members', 'home_cell', 'attendance',
    'finance', 'daily_expenses', 'events', 'prayer',
    'requisitions', 'communications', 'visitors',
  ],
  premium: [
    'dashboard', 'members', 'home_cell', 'attendance',
    'finance', 'daily_expenses', 'hr', 'events', 'prayer',
    'requisitions', 'communications', 'pledges', 'visitors', 'assets', 'ask',
  ],
  enterprise: [
    // All modules
    ...ALL_MODULE_IDS,
  ],
};

// ─── Module resolution ────────────────────────────────────────────────────────

/** Basic resolution: Super Admin sees all, null means all, array means exactly those. */
export function resolveModules(
  isSuperAdmin: boolean,
  allowedModules: string[] | null | undefined,
): Set<string> {
  if (isSuperAdmin) return new Set(ALL_MODULE_IDS);
  if (allowedModules == null) return new Set(ALL_MODULE_IDS);
  return new Set(allowedModules);
}

/**
 * Compute the EFFECTIVE module set for a church user, respecting this priority:
 *   1. Church-level overrides  (highest)
 *   2. Subscription plan rules
 *   3. System defaults          (lowest)
 *
 * @param planId          - The church's subscription plan id ('basic', 'standard', …)
 * @param planModules     - The module list for that plan (from Firestore or DEFAULT_PLAN_MODULES)
 * @param overrides       - Church-specific add/remove overrides
 * @param isSuperAdmin    - Whether the user is the church Super Admin
 * @param userModules     - Modules the Super Admin explicitly granted to this admin user
 *                          (null = all plan modules)
 */
export function resolveSubscriptionModules(opts: {
  planModules: string[];
  overrides?: { add?: string[]; remove?: string[] } | null;
  isSuperAdmin: boolean;
  userModules: string[] | null | undefined;
}): Set<string> {
  const { planModules, overrides, isSuperAdmin, userModules } = opts;

  // Step 1: Start with plan modules
  let effective = [...planModules];

  // Step 2: Apply church-level overrides
  if (overrides) {
    if (overrides.add?.length)    effective = [...new Set([...effective, ...overrides.add])];
    if (overrides.remove?.length) effective = effective.filter(m => !overrides.remove!.includes(m));
  }

  const ceiling = new Set(effective);

  // Step 3: For Super Admin — they see everything the church's plan allows
  if (isSuperAdmin) return ceiling;

  // Step 4: For regular admins — intersect with their personal grants
  const personal = userModules == null ? new Set(ALL_MODULE_IDS) : new Set(userModules);
  return new Set([...personal].filter(m => ceiling.has(m)));
}

/** Suggest actions for a given department name (case-insensitive). */
export function suggestActionsForDepartment(departmentName: string): ActionId[] {
  const key = departmentName.toLowerCase().trim();
  for (const [deptKey, actions] of Object.entries(DEPARTMENT_ACTION_PRESETS)) {
    if (key.includes(deptKey)) return actions;
  }
  return ['requisitions:submit'] as ActionId[]; // default minimum
}
