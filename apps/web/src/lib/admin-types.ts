import type { ModuleKey } from '@repo/shared';

export type PlatformRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT';

export type PlatformOperator = {
  platformMemberId: string;
  fullName: string;
  phone: string;
  role: PlatformRole;
  twoFactorEnabled: boolean;
};

export type PlatformLoginResult = {
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  operator: PlatformOperator | null;
  twoFactorRequired?: boolean;
  challengeToken?: string;
};

export type PlatformAccount = PlatformOperator & {
  email: string | null;
  twoFactorEnabled: boolean;
  twoFactorConfirmedAt: string | null;
};

export type TwoFactorSetup = {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
};

export type AdminTenantSummary = {
  id: string;
  slug: string;
  name: string;
  industry: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  phone: string | null;
  email: string | null;
  currency: string;
  createdAt: string;
  deletedAt: string | null;
  subscription: {
    status: string;
    plan: { code: string; name: string } | null;
  } | null;
  _count: { members: number; branches: number; customers: number };
};

export type AdminTenantDetail = AdminTenantSummary & {
  legalName: string | null;
  nationalId: string | null;
  economicCode: string | null;
  address: string | null;
  logoUrl: string | null;
  timezone: string;
  calendar: 'JALALI' | 'GREGORIAN';
  locale: string;
  invoicePrefix: string;
  taxRate: string;
  settings: Record<string, unknown>;
  branches: Array<{
    id: string;
    name: string;
    code: string | null;
    city: string | null;
    isActive: boolean;
  }>;
  modules: Array<{
    id: string;
    key: ModuleKey;
    isEnabled: boolean;
    enabledAt: string;
    disabledAt: string | null;
  }>;
  subscription:
    | (NonNullable<AdminTenantSummary['subscription']> & {
        id: string;
        planId: string | null;
        seats: number;
        currentPeriodEnd: string;
      })
    | null;
  roles: Array<{ id: string; key: string; name: string; permissions: string[] }>;
  _count: {
    members: number;
    customers: number;
    appointments: number;
    invoices: number;
    branches: number;
    orders: number;
  };
};

export type AdminModuleEntry = {
  key: ModuleKey;
  label: string;
  dependencies: ModuleKey[];
  dependents: ModuleKey[];
  isEnabled: boolean;
  enabledAt: string | null;
  disabledAt: string | null;
  missingDependencies: ModuleKey[];
};

export type AdminTenantModules = {
  tenantId: string;
  modules: AdminModuleEntry[];
  enabledCount: number;
  totalCount: number;
};

export type AdminMember = {
  id: string;
  tenantId: string;
  branchId: string | null;
  roleId: string | null;
  systemRole: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: { id: string; key: string; name: string } | null;
  branch: { id: string; name: string; code: string | null } | null;
};

export type AdminPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  modules: ModuleKey[];
  limits: Record<string, number>;
  isActive: boolean;
  _count: { subscriptions: number };
};

export type AdminTeamMember = {
  id: string;
  phone: string;
  fullName: string;
  email: string | null;
  role: PlatformRole;
  status: 'ACTIVE' | 'SUSPENDED';
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type AdminAuditEntry = {
  id: string;
  platformMemberId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  tenantId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  platformMember: { id: string; fullName: string; phone?: string; role: string } | null;
};

export type AdminStats = {
  tenants: number;
  activeTenants: number;
  suspended: number;
  members: number;
  customers: number;
  modulesEnabled: number;
  byIndustry: Array<{ industry: string; count: number }>;
  recentTenants: AdminTenantSummary[];
};
