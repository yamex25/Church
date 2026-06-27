export enum MembershipStatus {
  ACTIVE = 'Active',
  LEFT = 'Left Church',
  DIED = 'Died',
}

export enum UserRole {
  PLATFORM_OWNER = 'PLATFORM_OWNER', // highest — sees all churches
  SUPER_ADMIN    = 'SUPER_ADMIN',    // church creator — full control of one church
  ADMIN          = 'ADMIN',          // admin user inside a church
  DEPARTMENT_HEAD= 'DEPARTMENT_HEAD',
  MEMBER         = 'MEMBER',
}

export type ChurchStatus = 'active' | 'suspended';
export type SubscriptionStatus = 'active' | 'expired' | 'suspended';

export interface Church {
  id: string;
  name: string;
  nameLower: string;
  address?: string;
  phone?: string;
  email?: string;
  emailLower?: string;
  logoUrl?: string;
  churchCode: string;
  status?: ChurchStatus;
  // Subscription — populated when activation code is used
  subscriptionPlan?: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionStartDate?: string;
  subscriptionExpiryDate?: string;
  activationCodeId?: string;
  // Per-church module access overrides (set by Platform Owner, supersedes plan)
  moduleOverrides?: ChurchModuleOverrides | null;
  createdAt: string;
  createdBy: string;
}

/** Per-church module overrides — applied on top of the subscription plan. */
export interface ChurchModuleOverrides {
  add?: string[];    // modules granted BEYOND what the plan includes
  remove?: string[]; // modules removed FROM what the plan includes
}

/** Stored in `subscriptionPlanModules/{planId}` — managed by Platform Owner. */
export interface SubscriptionPlanModules {
  planId: string;
  planName: string;
  modules: string[];  // array of MODULE_DEFS ids
  updatedAt: string;
  updatedBy: string;
}

export type ActivationCodeStatus = 'unused' | 'used' | 'expired' | 'revoked';

export interface ActivationCode {
  id: string;
  code: string;
  plan: string;           // 'starter' | 'standard' | 'premium' | 'enterprise'
  planName: string;       // human-readable label
  durationMonths: number;
  status: ActivationCodeStatus;
  generatedAt: string;
  generatedBy: string;
  notes?: string;         // customer name / payment reference
  // Populated on activation
  activatedAt?: string;
  expiresAt?: string;
  churchId?: string;
  churchName?: string;
}

// ─── Subscription plans & durations (shared between platform + setup pages) ───

export const SUBSCRIPTION_PLANS = [
  {
    id: 'basic',      name: 'Basic',
    price: 15,          priceLabel: '$15 / month',
    priceUGX: 56000,    priceUGXLabel: 'UGX 56,000 / month',
    description: 'Up to 50 members',
    features: ['Member Management', 'Attendance Tracking', 'Events', 'Prayer Requests', 'Home Cell'],
    color: 'bg-slate-100 text-slate-700',
    badge: 'bg-slate-600 text-white',
  },
  {
    id: 'standard',   name: 'Standard',
    price: 30,          priceLabel: '$30 / month',
    priceUGX: 112000,   priceUGXLabel: 'UGX 112,000 / month',
    description: 'Up to 200 members',
    features: ['All Basic features', 'Finance Module', 'HR & Payroll', 'Communications', 'Requisitions', 'Visitor Care'],
    color: 'bg-blue-100 text-blue-700',
    badge: 'bg-church-blue text-white',
  },
  {
    id: 'premium',    name: 'Premium',
    price: 50,          priceLabel: '$50 / month',
    priceUGX: 188000,   priceUGXLabel: 'UGX 188,000 / month',
    description: 'Up to 500 members',
    features: ['All Standard features', 'Asset Management', 'Project Pledges', 'AI Assistant', 'Advanced Analytics'],
    color: 'bg-violet-100 text-violet-700',
    badge: 'bg-violet-600 text-white',
  },
  {
    id: 'enterprise', name: 'Enterprise',
    price: 80,          priceLabel: '$80 / month',
    priceUGX: 300000,   priceUGXLabel: 'UGX 300,000 / month',
    description: 'Unlimited members',
    features: ['All Premium features', 'Custom Integrations', 'Dedicated Support', 'Priority SLA', 'API Access'],
    color: 'bg-yellow-100 text-church-black',
    badge: 'bg-church-yellow text-church-black',
  },
] as const;

export const SUBSCRIPTION_DURATIONS = [
  { months: 1,  label: '1 Month' },
  { months: 3,  label: '3 Months' },
  { months: 6,  label: '6 Months' },
  { months: 12, label: '1 Year' },
] as const;

export interface Residence {
  division: string;
  parish: string;
  village: string;
}

export interface Zone {
  id: string;
  name: string;
  code?: string;
  description?: string;
  churchId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Cell {
  id: string;
  name: string;
  code?: string;
  zoneId: string;
  zoneName: string;
  description?: string;
  churchId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Member {
  id: string;
  churchId: string;
  name: string;
  email: string;
  phone: string;
  sex: 'Male' | 'Female';
  maritalStatus: 'Single' | 'Married' | 'Widowed' | 'Divorced';
  dateOfBirth: string;
  tribe: string;
  residence: Residence;
  membershipStatus: MembershipStatus;
  categories: string[];
  zone?: string;
  zoneName?: string;
  cell?: string;
  cellName?: string;
  isLeader?: boolean;
  leaderType?: 'Cell' | 'Zone';
  joinedAt: string;
  createdAt: string;
  photoUrl?: string;
  qrCode?: string;
  updatedAt?: any;
}

export interface Attendance {
  id: string;
  churchId: string;
  memberId: string;
  serviceId: string;
  serviceName: string;
  timestamp: string;
  status: 'Present' | 'Absent' | 'Excused';
  recordedBy: string;
}

export enum TransactionType {
  TITHE = 'Tithe',
  OFFERING = 'Offering',
  DONATION = 'Donation',
  OTHER = 'Other',
}

export enum ExpenseType {
  SALARY = 'Salary',
  REQUISITION = 'Requisition',
  UTILITIES = 'Utilities',
  MAINTENANCE = 'Maintenance',
  SUPPLIES = 'Supplies',
  TRANSPORT = 'Transport',
  FUEL = 'Fuel',
  COMMUNICATION = 'Communication',
  CLEANING = 'Cleaning',
  SECURITY = 'Security',
  HOSPITALITY = 'Hospitality',
  OTHER = 'Other',
}

export interface Expense {
  id: string;
  churchId: string;
  type: ExpenseType;
  category: string;
  description: string;
  amount: number;
  date: string;
  relatedId?: string;
  recordedBy: string;
  createdAt: string;
}

export interface FinanceRecord {
  id: string;
  churchId: string;
  memberId?: string;
  memberName?: string;
  type: TransactionType | string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  description?: string;
  recordedBy: string;
  createdAt: string;
  serviceName?: string;
}

export interface RequisitionItem {
  name: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export enum RequisitionStatus {
  PENDING      = 'Pending',         // Submitted by HOD — awaiting admin review
  UNDER_REVIEW = 'Under Review',    // Admin has started reviewing
  ADMIN_APPROVED = 'Admin Approved',// Admin approved/recommended — waiting for finance
  APPROVED     = 'Approved',        // Finance final approval — expense recorded
  DECLINED     = 'Declined',        // Rejected at any stage
}

export interface Requisition {
  id?: string;
  churchId: string;
  department: string;
  requestedBy: string;
  requesterId: string;
  // Multi-item support (new)
  itemsList?: RequisitionItem[];

  // Legacy single-item fields (kept for backward compatibility)
  items?: string;
  itemName?: string;
  estimatedCost?: number;
  cost?: number;
  quantity?: number;
  total?: number;
  purpose?: string;
  stockable?: boolean;
  requestDate?: string;
  status: RequisitionStatus;

  // Stage 1 — Admin approval
  adminApproverId?: string;
  adminApproverName?: string;
  adminApprovedAt?: string;
  adminNotes?: string;

  // Stage 2 — Accountant final approval
  accountantApproverId?: string;
  accountantApproverName?: string;
  accountantApprovedAt?: string;
  accountantNotes?: string;

  // Decline tracking
  declinedById?: string;
  declinedByName?: string;
  declinedAt?: string;
  declineReason?: string;
  declineStage?: 'admin' | 'accountant';

  // Keep old fields for backward compatibility
  approverId?: string;
  approverName?: string;
  notes?: string;

  createdAt: any;
  updatedAt: any;
}

export interface ChurchEvent {
  id: string;
  churchId: string;
  title: string;
  description: string;
  date: string;
  time?: string;
  location: string;
  type: 'Service' | 'Program' | 'Meeting' | 'Special';
  image?: string;
  status?: 'active' | 'cancelled';
  attendees?: number;
}

export interface PrayerRequest {
  id: string;
  churchId: string;
  memberId: string;
  memberName: string;
  requestText: string;
  status: 'Pending' | 'Answered';
  isPrivate: boolean;
  visibility: 'Public' | 'Pastors' | 'Department';
  targetDepartment?: string;
  createdAt: string;
  updatedAt: string;
}

export type AccountStatus = 'active' | 'disabled' | 'pending';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  churchId: string;
  memberId?: string;
  photoURL?: string;
  // Module-level access control (set by Super Admin in Settings)
  allowedModules?: string[] | null; // null/undefined = all access; [] = no access
  groupIds?: string[];
  // Action-level permissions (e.g. 'members:create', 'members:disable')
  allowedActions?: string[];
  // Account lifecycle
  accountStatus?: AccountStatus;
  // Identity
  username?: string;
  authProvider?: 'google' | 'email' | 'username';
  lastLogin?: string;
  department?: string;   // which church department this user belongs to
}

// ─── Audit Trail ──────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  churchId: string;
  timestamp: string;
  userId: string;
  username?: string;
  displayName: string;
  email?: string;
  department?: string;
  role: string;
  module: string;       // which module the action happened in
  action: string;       // e.g. 'requisition.submitted', 'payroll.approved'
  entityType: string;   // e.g. 'requisition', 'payment', 'member'
  entityId?: string;
  details: string;      // human-readable description
  metadata?: Record<string, unknown>;
}

/**
 * A pending invitation for a new admin user.
 * Created by Super Admin before the person has signed in.
 * Consumed (accepted/rejected) by AuthContext on first sign-in.
 */
export interface PendingInvite {
  id: string;
  churchId: string;
  churchName: string;
  email: string;
  emailLower: string;
  role: UserRole;           // ADMIN | DEPARTMENT_HEAD
  allowedModules?: string[];
  allowedActions?: string[];
  invitedBy: string;        // uid of Super Admin
  invitedByName: string;
  invitedAt: string;
  status: 'pending' | 'accepted' | 'cancelled';
}

/** A permission group ties a set of admin modules to a set of users. */
export interface PermissionGroup {
  id: string;
  churchId: string;
  name: string;
  modules: string[];      // module IDs accessible to group members
  memberUids: string[];   // UIDs of users in this group
  departmentId?: string;  // set when auto-created from a department
  departmentName?: string;
  isAutoCreated?: boolean;
  createdAt: string;
  createdBy: string;
}

export interface Broadcast {
  id?: string;
  churchId: string;
  title: string;
  message: string;
  sentBy: string;
  sentAt: any;
  targetCount: number;
}

export interface Pledge {
  id?: string;
  churchId: string;
  memberId?: string;
  memberName: string;
  amount: number;
  project: string;
  projectId?: string;
  date: string;
  status: 'Pending' | 'Fulfilled';
  recordedBy: string;
  createdAt: any;
}

export interface Visitor {
  id?: string;
  churchId: string;
  name: string;
  phone: string;
  email?: string;
  sex: 'Male' | 'Female';
  maritalStatus: 'Single' | 'Married' | 'Widowed' | 'Divorced';
  dateOfBirth: string;
  tribe: string;
  residence: Residence;
  visitationDate: string;
  invitedBy?: string;
  currentChurch?: string;
  isBornAgain: boolean;
  prayerNeeds?: string;
  status: 'New' | 'Followed Up' | 'Member';
  convertedMemberId?: string;
  followUpBy?: string;
  createdAt: any;
}

export interface Asset {
  id?: string;
  churchId: string;
  name: string;
  assetId?: string;
  category: string;
  condition: 'Good' | 'Fair' | 'Bad';
  location: string;
  value: number;
  purchaseDate: string;
  serialNumber?: string;
  proofUrl?: string;
}

export interface Employee {
  id?: string;
  churchId: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  salary: number;
  status: 'Active' | 'On Leave' | 'Terminated';
  joinedDate: string;
  isDepartmentHead: boolean;
  isAccountant?: boolean;  // Finance dept: can do final approval of requisitions
  bankDetails?: string;
  tinNumber?: string;
  createdAt: any;
}

export interface PayrollRecord {
  id?: string;
  churchId: string;
  employeeId: string;
  employeeName: string;
  totalSalary: number;
  paidAmount: number;
  balance: number;
  month: string;
  paymentDate: string;
  status: 'Pending' | 'Partial' | 'Paid';
  paymentMethod: string;
  recordedBy: string;
  createdAt: any;
}

export interface GeneralAttendance {
  id?: string;
  churchId: string;
  serviceDate: string;
  serviceName: string;
  adultCount: number;
  childrenCount: number;
  firstTimers: number;
  summary?: string;
  recordedBy: string;
  createdAt: any;
}
