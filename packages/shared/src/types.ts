export type AuthenticatedUser = {
  memberId: string;
  tenantId: string;
  branchId?: string | null;
  systemRole: string;
  permissions: string[];
  fullName: string;
  phone?: string | null;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ApiErrorBody = {
  statusCode: number;
  message: string;
  error?: string;
  details?: unknown;
  path?: string;
  timestamp?: string;
};
