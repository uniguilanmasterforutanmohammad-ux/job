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

export function hasPermission(granted: string[], required: string): boolean {
  if (granted.includes(PERMISSIONS.ALL)) return true;
  return granted.includes(required);
}
