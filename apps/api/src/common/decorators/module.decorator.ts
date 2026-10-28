import { SetMetadata } from '@nestjs/common';
import type { ModuleKey } from '@repo/shared';

export const REQUIRED_MODULES_KEY = 'requiredModules';

/**
 * Declares which product module(s) a route belongs to. A tenant without the
 * module enabled receives 403 from `ModuleAccessGuard` — even if the user's role
 * grants the underlying permission.
 */
export const RequireModule = (...modules: ModuleKey[]) =>
  SetMetadata(REQUIRED_MODULES_KEY, modules);

export const MODULE_OPTIONAL_KEY = 'moduleOptional';
/** Exempts a route from module gating (e.g. /auth/me, module marketplace). */
export const ModuleOptional = () => SetMetadata(MODULE_OPTIONAL_KEY, true);
