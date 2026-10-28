export const PLATFORM_JWT_STRATEGY = 'jwt-platform';
export const PLATFORM_ACCESS_COOKIE = 'bp_platform_access';
export const PLATFORM_REFRESH_COOKIE = 'bp_platform_refresh';
export const PLATFORM_SCOPE = 'platform';
export const PLATFORM_ROLES_KEY = 'requiredPlatformRoles';

export const PLATFORM_ROLE_VALUES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] as const;
export type PlatformRoleValue = (typeof PLATFORM_ROLE_VALUES)[number];

/** Higher number = more authority. Used for coarse hierarchy checks. */
export const PLATFORM_ROLE_RANK: Record<PlatformRoleValue, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  SUPPORT: 1,
};

export type PlatformPrincipal = {
  platformMemberId: string;
  phone: string;
  fullName: string;
  role: PlatformRoleValue;
  /** Whether TOTP 2FA is confirmed for this operator. */
  twoFactorEnabled: boolean;
};

/** Error code surfaced when mandatory 2FA enrolment is still pending. */
export const TWO_FACTOR_SETUP_REQUIRED = 'TWO_FACTOR_SETUP_REQUIRED';
export const TWO_FACTOR_SETUP_REQUIRED_KEY = 'skipTwoFactorEnforcement';
