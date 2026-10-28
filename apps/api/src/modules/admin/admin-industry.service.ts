import { Injectable } from '@nestjs/common';
import type { ModuleKey } from '@repo/shared';
import { IndustryRegistryService, type IndustryEntry } from '../industries/industry-registry.service.js';
import { AdminAuditService, type AuditContext } from './admin-audit.service.js';
import type { PlatformPrincipal } from './admin.constants.js';
import type { AdminIndustryModulesDto, AdminIndustryRegistrationDto } from './dto/admin.schemas.js';

/**
 * Admin-facing view of the industry registry: every PRD §17 industry with its
 * registration flag and editable default module set.
 */
@Injectable()
export class AdminIndustryService {
  constructor(
    private readonly registry: IndustryRegistryService,
    private readonly audit: AdminAuditService,
  ) {}

  list(): Promise<IndustryEntry[]> {
    return this.registry.list();
  }

  /** Activates/deactivates self-service registration for an industry. */
  async setRegistration(
    actor: PlatformPrincipal,
    industry: string,
    dto: AdminIndustryRegistrationDto,
    context: AuditContext = {},
  ) {
    const { before, after } = await this.registry.setRegistration(
      industry,
      dto.isRegistrationEnabled,
    );

    await this.audit.record(
      actor,
      {
        action: 'industry.registration_toggle',
        entity: 'industry',
        entityId: industry,
        before: { isRegistrationEnabled: before.isRegistrationEnabled },
        after: { isRegistrationEnabled: after.isRegistrationEnabled, reason: dto.reason ?? null },
      },
      context,
    );
    return after;
  }

  /** Replaces the default module set of an industry. */
  async setModules(
    actor: PlatformPrincipal,
    industry: string,
    dto: AdminIndustryModulesDto,
    context: AuditContext = {},
  ) {
    const { before, after } = await this.registry.setModules(industry, dto.keys as ModuleKey[]);

    await this.audit.record(
      actor,
      {
        action: 'industry.modules_update',
        entity: 'industry',
        entityId: industry,
        before: { defaultModules: before.defaultModules },
        after: { defaultModules: after.defaultModules },
      },
      context,
    );
    return after;
  }
}
