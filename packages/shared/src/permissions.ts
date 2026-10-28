/** Role-based permission keys (CORE-03). */
export const PERMISSIONS = {
  ALL: '*',
  TENANT_READ: 'tenant:read',
  TENANT_WRITE: 'tenant:write',
  MEMBER_READ: 'member:read',
  MEMBER_WRITE: 'member:write',
  ROLE_READ: 'role:read',
  ROLE_WRITE: 'role:write',
  CRM_READ: 'crm:read',
  CRM_WRITE: 'crm:write',
  SCH_READ: 'sch:read',
  SCH_WRITE: 'sch:write',
  FIN_READ: 'fin:read',
  FIN_WRITE: 'fin:write',
  ATT_READ: 'att:read',
  ATT_WRITE: 'att:write',
  MSG_READ: 'msg:read',
  MSG_WRITE: 'msg:write',
  SUB_READ: 'sub:read',
  SUB_WRITE: 'sub:write',
  CAMP_READ: 'camp:read',
  CAMP_WRITE: 'camp:write',
  INV_READ: 'inv:read',
  INV_WRITE: 'inv:write',
  HR_READ: 'hr:read',
  HR_WRITE: 'hr:write',
  MKT_READ: 'mkt:read',
  MKT_WRITE: 'mkt:write',
  SHOP_READ: 'shop:read',
  SHOP_WRITE: 'shop:write',
  DOC_READ: 'doc:read',
  DOC_WRITE: 'doc:write',
  APP_READ: 'app:read',
  APP_WRITE: 'app:write',
  RPT_READ: 'rpt:read',
  AUDIT_READ: 'audit:read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const SYSTEM_ROLES = [
  'OWNER',
  'MANAGER',
  'STAFF',
  'ACCOUNTANT',
  'RECEPTION',
  'END_USER',
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  OWNER: 'مالک',
  MANAGER: 'مدیر',
  STAFF: 'کارمند',
  ACCOUNTANT: 'حسابدار',
  RECEPTION: 'پذیرش',
  END_USER: 'کاربر نهایی',
};

/**
 * Tenant role key of every system role (CORE-03). A business is born with its
 * `owner` role only, so the panel links/creates the matching row with these keys
 * whenever it adds a user with a system role.
 */
export const SYSTEM_ROLE_KEYS: Record<SystemRole, string> = {
  OWNER: 'owner',
  MANAGER: 'manager',
  STAFF: 'staff',
  ACCOUNTANT: 'accountant',
  RECEPTION: 'reception',
  END_USER: 'end_user',
};

/**
 * Permissions of the tenant role behind each system role. The permission guard
 * reads the *role row*, so a user created with a system role but without a role
 * row would be able to do nothing at all — these are the defaults used to create
 * the missing role.
 */
export const SYSTEM_ROLE_DEFAULT_PERMISSIONS: Record<SystemRole, string[]> = {
  OWNER: [PERMISSIONS.ALL],
  MANAGER: [PERMISSIONS.ALL],
  STAFF: [
    PERMISSIONS.CRM_READ,
    PERMISSIONS.SCH_READ,
    PERMISSIONS.SCH_WRITE,
    PERMISSIONS.ATT_WRITE,
  ],
  ACCOUNTANT: [PERMISSIONS.FIN_READ, PERMISSIONS.FIN_WRITE, PERMISSIONS.RPT_READ],
  RECEPTION: [
    PERMISSIONS.CRM_READ,
    PERMISSIONS.CRM_WRITE,
    PERMISSIONS.SCH_READ,
    PERMISSIONS.SCH_WRITE,
  ],
  END_USER: [PERMISSIONS.APP_READ, PERMISSIONS.APP_WRITE],
};

export function hasPermission(granted: string[], required: string): boolean {
  if (granted.includes(PERMISSIONS.ALL)) return true;
  return granted.includes(required);
}
