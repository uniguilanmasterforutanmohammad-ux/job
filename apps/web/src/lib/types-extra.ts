/** Types for the phase-3 completions (FIN wallet/refunds/discounts/links, MSG chat, portal). */

export type WalletHistory = {
  balance: number;
  transactions: Array<{
    id: string;
    type: 'CREDIT' | 'DEBIT' | 'GIFT' | 'REFUND';
    amount: string;
    balanceAfter: string;
    reason: string | null;
    createdAt: string;
  }>;
};

export type Refund = {
  id: string;
  invoiceId: string | null;
  amount: string;
  reason: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  toWallet: boolean;
  createdAt: string;
  invoice?: { number: string } | null;
};

export type DiscountCode = {
  id: string;
  code: string;
  percent: string | null;
  amount: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
};

export type PaymentLink = {
  id: string;
  token: string;
  url: string;
  qrData: string;
  amount: string;
  title: string | null;
  status: 'ACTIVE' | 'PAID' | 'EXPIRED' | 'CANCELED';
  visitedCount: number;
  createdAt: string;
};

export type DebtorReport = {
  data: Array<{
    customerId: string;
    fullName: string;
    phone: string | null;
    debt: number;
    invoices: number;
  }>;
  totalDebt: number;
  count: number;
};

export type ChatThread = {
  customerId: string;
  fullName: string;
  phone: string | null;
  lastMessageAt: string;
  lastBody: string | null;
  unread: number;
};

export type ChatMessage = {
  id: string;
  customerId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string | null;
  fileKey: string | null;
  readAt: string | null;
  createdAt: string;
};

export type SmsCampaign = {
  id: string;
  title: string;
  body: string;
  segment: Record<string, unknown>;
  totalTargets: number;
  sentCount: number;
  skippedCount: number;
  status: string;
  createdAt: string;
};

export type ShareCard = {
  format: 'svg';
  width: number;
  height: number;
  svg: string;
  dataUri: string;
};

export type CustomerHistory = {
  customer: { id: string; fullName: string; phone: string | null };
  summary: { totalPaid: number; outstanding: number; appointments: number };
  timeline: Array<{
    type: string;
    at: string;
    title: string;
    amount?: number;
    status?: string;
    refId: string;
  }>;
};

export type AvailabilityResult = {
  date: string;
  hours: { open?: string; close?: string };
  duration: number;
  slots: Array<{ start: string; end: string }>;
};

export type PortalProfile = {
  tenant: {
    slug: string;
    name: string;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
  };
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    price: string;
  }>;
};

export type PortalLoyalty = { walletBalance: number; points: number; tier: string };

// ----- End-user (student) dashboard -----

export type CustomerClub = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  industry: string;
  logoUrl: string | null;
  memberId: string;
  customerId: string | null;
  fullName: string;
  branch: { id: string; name: string; city: string | null } | null;
  isActive: boolean;
  primaryLinked: boolean;
};

export type CustomerLoginResult = {
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  clubs: CustomerClub[];
  user: {
    memberId: string;
    customerId: string;
    fullName: string;
    phone: string | null;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
  };
};

export type CustomerAttendanceRecord = {
  id: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'CANCELED';
  method: string;
  date: string;
  checkInAt: string | null;
  note: string | null;
};

export type CustomerAttendance = {
  present: number;
  total: number;
  ratio: number;
  records: CustomerAttendanceRecord[];
};

export type CustomerCheckInTarget = {
  id: string;
  code: string;
  label: string | null;
  branchId: string | null;
  expiresAt: string;
};

export type AbsenceRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

export type AbsenceRequest = {
  id: string;
  customerId: string;
  absenceDate: string;
  reason: string;
  note: string | null;
  status: AbsenceRequestStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  customer?: { id: string; fullName: string; phone: string | null } | null;
};
