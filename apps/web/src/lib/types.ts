import type { ModuleKey } from '@repo/shared';

export type SessionUser = {
  memberId: string;
  tenantId: string;
  branchId: string | null;
  systemRole: string;
  permissions: string[];
  fullName: string;
  phone?: string | null;
  tenantName: string;
  tenantSlug: string;
};

export type MeResponse = {
  member: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    systemRole: string;
    avatarUrl: string | null;
    /** False when the member has no password yet (OTP-only login). */
    hasPassword?: boolean;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    /** Industry key from the registry (system vertical or admin-created). */
    industry: string;
    currency: string;
    calendar: string;
    locale: string;
  };
  branch: { id: string; name: string } | null;
  role: { key: string; name: string; permissions: string[] } | null;
  enabledModules: ModuleKey[];
};

export type Customer = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  tags: string[];
  leadStage: 'LEAD' | 'NEGOTIATION' | 'WON' | 'LOST';
  createdAt: string;
  _count?: { appointments: number; invoices: number };
};

export type Paginated<T> = {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELED' | 'NO_SHOW' | 'WAITLIST';
  customer: { id: string; fullName: string; phone: string | null };
  service: { id: string; name: string } | null;
};

export type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
  isActive: boolean;
};

export type Invoice = {
  id: string;
  number: string;
  status: string;
  total: string;
  paidTotal: string;
  issueDate: string;
  dueDate: string | null;
  customer: { id: string; fullName: string; phone: string | null };
};

export type DashboardStats = {
  revenueToday: number;
  revenueMonth: number;
  appointmentsToday: number;
  appointmentsTomorrow: number;
  newCustomersMonth: number;
  totalCustomers: number;
  outstanding: number;
  enabledModules: ModuleKey[];
};

export type LoginResult = {
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  user: SessionUser;
};

// ----- New modules (Phase 2) -----

export type MembershipPlan = {
  id: string;
  name: string;
  kind: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'SESSION_PACK' | 'TIME_PACK' | 'VIP';
  price: string;
  sessionsCount: number | null;
  daysCount: number | null;
  isActive: boolean;
};

export type StudentSubscription = {
  id: string;
  customerId: string;
  planName: string;
  kind: string;
  price: string;
  status: 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'CANCELED';
  autoRenew: boolean;
  startsAt: string;
  endsAt: string | null;
  sessionsTotal: number | null;
  sessionsUsed: number;
};

export type Product = {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  unit: string;
  category: string | null;
  costPrice: string;
  salePrice: string;
  stock: string;
  minStock: string;
  barcode: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isPublic: boolean;
  lowStock?: boolean;
};

export type StockMovement = {
  id: string;
  productId: string;
  type: string;
  quantity: string;
  unitCost: string;
  createdAt: string;
};

export type StaffProfile = {
  id: string;
  fullName: string;
  phone: string | null;
  position: string | null;
  contractType: string | null;
  baseSalary: string;
  commissionRate: string;
  isActive: boolean;
};

export type LeaveRequest = {
  id: string;
  staffId: string;
  fromDate: string;
  toDate: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
};

export type PayrollEntry = {
  id: string;
  staffId: string;
  periodStart: string;
  periodEnd: string;
  baseSalary: string;
  commission: string;
  bonus: string;
  deductions: string;
  netPay: string;
  status: 'DRAFT' | 'FINALIZED' | 'PAID';
};

export type GiftCard = {
  id: string;
  code: string;
  balance: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELED';
  expiresAt: string | null;
};

export type Review = {
  id: string;
  customerId: string | null;
  rating: number;
  comment: string | null;
  isPublic: boolean;
  createdAt: string;
};

export type Order = {
  id: string;
  number: string;
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELED';
  items: Array<{ title: string; quantity: number; unitPrice: number; productId?: string }>;
  subtotal: string;
  shippingCost: string;
  total: string;
  trackingCode: string | null;
  createdAt: string;
};

export type ContractTemplate = {
  id: string;
  title: string;
  body: string;
  isActive: boolean;
};

export type Contract = {
  id: string;
  title: string;
  body: string;
  status: 'DRAFT' | 'SENT' | 'SIGNED' | 'EXPIRED' | 'CANCELED';
  amount: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type Campaign = {
  id: string;
  title: string;
  description: string | null;
  targetAmount: string;
  collected: string;
  minAmount: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELED';
  deadline: string | null;
  _count?: { contributions: number };
  progress?: { percent: number; contributors: number; spent: number; remaining: number };
};

export type Installment = {
  id: string;
  customerId: string;
  number: number;
  amount: string;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED';
  paidAt: string | null;
  lateFee: string;
};

export type Expense = {
  id: string;
  category: string;
  title: string;
  amount: string;
  spentAt: string;
  note: string | null;
};

export type CashSession = {
  id: string;
  openingFloat: string;
  expectedCash: string;
  countedCash: string | null;
  difference: string | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
};

export type WaitlistEntry = {
  id: string;
  customerId: string;
  serviceId: string | null;
  status: 'WAITING' | 'OFFERED' | 'CONVERTED' | 'CANCELED';
  note: string | null;
  createdAt: string;
};

export type RecurringSeries = {
  id: string;
  customerId: string;
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  weekday: number | null;
  timeOfDay: string | null;
  occurrences: number;
  startsFrom: string;
  isActive: boolean;
};

export type MemberSummary = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  systemRole: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  role: { id: string; key: string; name: string } | null;
};

export type Role = {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
  _count?: { members: number };
};

export type BackupRecord = {
  id: string;
  kind: string;
  status: string;
  location: string | null;
  note: string | null;
  createdAt: string;
};

export type Forecast = {
  basedOn: { period: string; historical: number };
  expectedSubscriptions: number;
  expectedBookings: number;
  forecast: number;
};

/** One location of the business (`GET /tenant/branches`) — «آموزشگاه»/«شعبه». */
export type BranchOption = {
  id: string;
  name: string;
  isActive: boolean;
  _count?: { members: number; customers: number };
};
