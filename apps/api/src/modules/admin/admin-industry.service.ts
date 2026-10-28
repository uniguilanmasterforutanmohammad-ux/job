import { Injectable } from '@nestjs/common';
import type { ModuleKey } from '@repo/shared';
import { IndustryRegistryService, type IndustryEntry } from '../industries/industry-registry.service.js';
import { AdminAuditService, type AuditContext } from './admin-audit.service.js';
import type { PlatformPrincipal } from './admin.constants.js';
import type {
  AdminIndustryCreateDto,
  AdminIndustryModulesDto,
  AdminIndustryRegistrationDto,
  AdminIndustryUpdateDto,
} from './dto/admin.schemas.js';

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

  /** Registers a new industry/job with an arbitrary title. */
  async create(
    actor: PlatformPrincipal,
    dto: AdminIndustryCreateDto,
    context: AuditContext = {},
  ): Promise<IndustryEntry> {
    const created = await this.registry.create(dto);

    await this.audit.record(
      actor,
      {
        action: 'industry.create',
        entity: 'industry',
        entityId: created.key,
        after: {
          label: created.label,
          endUserNoun: created.endUserNoun,
          isRegistrationEnabled: created.isRegistrationEnabled,
          defaultModules: created.defaultModules,
        },
      },
      context,
    );
    return created;
  }

  /** Renames an industry or edits its metadata. */
  async update(
    actor: PlatformPrincipal,
    industry: string,
    dto: AdminIndustryUpdateDto,
    context: AuditContext = {},
  ): Promise<IndustryEntry> {
    const before = await this.registry.get(industry);
    const after = await this.registry.update(industry, dto);

    await this.audit.record(
      actor,
      {
        action: 'industry.update',
        entity: 'industry',
        entityId: industry,
        before: {
          label: before.label,
          endUserNoun: before.endUserNoun,
          branchNoun: before.branchNoun,
          sortOrder: before.sortOrder,
          isRegistrationEnabled: before.isRegistrationEnabled,
        },
        after: {
          label: after.label,
          endUserNoun: after.endUserNoun,
          branchNoun: after.branchNoun,
          sortOrder: after.sortOrder,
          isRegistrationEnabled: after.isRegistrationEnabled,
        },
      },
      context,
    );
    return after;
  }

  /** Deletes a custom industry (system verticals are protected). */
  async remove(
    actor: PlatformPrincipal,
    industry: string,
    context: AuditContext = {},
  ): Promise<IndustryEntry> {
    const removed = await this.registry.remove(industry);

    await this.audit.record(
      actor,
      {
        action: 'industry.delete',
        entity: 'industry',
        entityId: industry,
        before: { label: removed.label, defaultModules: removed.defaultModules },
      },
      context,
    );
    return removed;
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
