export enum MembershipStatus {
  ACTIVE = 'Active',
  LEFT = 'Left Church',
  DIED = 'Died',
}

export enum UserRole {
  ADMIN = 'Admin',
  PASTOR = 'Pastor',
  TREASURER = 'Treasurer',
  SECRETARY = 'Secretary',
  DPT_LEADER = 'Department Leader',
  MEMBER = 'Member',
}

export interface Residence {
  division: string;
  parish: string;
  village: string;
}

export interface Zone {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Cell {
  id: string;
  name: string;
  zoneId: string;
  zoneName: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  sex: 'Male' | 'Female';
  maritalStatus: 'Single' | 'Married' | 'Widowed' | 'Divorced';
  dateOfBirth: string;
  tribe: string;
  residence: Residence;
  membershipStatus: MembershipStatus;
  categories: string[]; // choir, usher, youth, etc.
  zone?: string; // Zone ID
  zoneName?: string; // Zone name for display
  cell?: string; // Cell ID
  cellName?: string; // Cell name for display
  isLeader?: boolean; // Is this person a leader
  leaderType?: 'Cell' | 'Zone'; // Type of leader (Cell Leader or Zonal Leader)
  joinedAt: string;
  createdAt: string;
  photoUrl?: string;
  qrCode?: string;
  updatedAt?: any;
}

export interface Attendance {
  id: string;
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

export enum RequisitionStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  DECLINED = 'Declined'
}

export interface Requisition {
  id?: string;
  department: string;
  requestedBy: string;
  requesterId: string;
  items?: string; // Old format
  itemName?: string; // New format from member portal
  estimatedCost?: number; // Old format
  cost?: number; // New format
  quantity?: number; // New format
  total?: number; // New format - calculated
  purpose?: string; // Old format
  stockable?: boolean; // New format
  requestDate?: string; // New format
  status: RequisitionStatus;
  approverId?: string;
  approverName?: string;
  notes?: string;
  createdAt: any;
  updatedAt: any;
}

export interface ChurchEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  type: 'Service' | 'Program' | 'Meeting' | 'Special';
  image?: string;
}

export interface PrayerRequest {
  id: string;
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

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  memberId?: string; // Link to member profile if it's a member login
}

export interface Broadcast {
  id?: string;
  title: string;
  message: string;
  sentBy: string;
  sentAt: any;
  targetCount: number;
}

export interface Pledge {
  id?: string;
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
  name: string;
  assetId?: string; // For number plates, product IDs, etc.
  category: string;
  condition: 'Good' | 'Fair' | 'Bad';
  location: string;
  value: number;
  purchaseDate: string;
  serialNumber?: string;
  proofUrl?: string; // URL for proof of property (receipt/document)
}

export interface Employee {
  id?: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  salary: number;
  status: 'Active' | 'On Leave' | 'Terminated';
  joinedDate: string;
  isDepartmentHead: boolean;
  bankDetails?: string;
  tinNumber?: string;
  createdAt: any;
}

export interface PayrollRecord {
  id?: string;
  employeeId: string;
  employeeName: string;
  totalSalary: number;
  paidAmount: number;
  balance: number;
  month: string; // YYYY-MM
  paymentDate: string;
  status: 'Pending' | 'Partial' | 'Paid';
  paymentMethod: string;
  recordedBy: string;
  createdAt: any;
}

export interface GeneralAttendance {
  id?: string;
  serviceDate: string;
  serviceName: string;
  adultCount: number;
  childrenCount: number;
  firstTimers: number;
  summary?: string;
  recordedBy: string;
  createdAt: any;
}
