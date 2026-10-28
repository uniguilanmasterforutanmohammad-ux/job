import { Injectable } from '@nestjs/common';
import {
  defaultModulesForIndustry,
  MODULE_DEPENDENCIES,
  MODULE_KEYS,
  MODULE_LABELS,
  resolveModuleDependencies,
  type ModuleKey,
} from '@repo/shared';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AdminAuditService, type AuditContext } from './admin-audit.service.js';
import type { PlatformPrincipal } from './admin.constants.js';
import { ModuleAccessService } from '../tenants/module-access.service.js';
import { IndustryRegistryService } from '../industries/industry-registry.service.js';
import type {
  AdminModuleGrantDto,
  AdminModuleRevokeDto,
  AdminModuleToggleDto,
} from './dto/admin.schemas.js';

export type ModuleCatalogEntry = {
  key: ModuleKey;
  label: string;
  dependencies: ModuleKey[];
  dependents: ModuleKey[];
};

/**
 * Module catalog + per-tenant manual grant/revoke. The admin panel is a
 * "root override": it may enable any module regardless of the tenant's plan or
 * industry defaults, but dependencies are still resolved to keep data coherent.
 */
@Injectable()
export class AdminModuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly access: ModuleAccessService,
    private readonly industries: IndustryRegistryService,
  ) {}

  /** Static catalog with computed dependents, for the admin UI matrix. */
  catalog(): ModuleCatalogEntry[] {
    return MODULE_KEYS.map((key) => ({
      key,
      label: MODULE_LABELS[key],
      dependencies: MODULE_DEPENDENCIES[key],
      dependents: MODULE_KEYS.filter((other) => MODULE_DEPENDENCIES[other].includes(key)),
    }));
  }

  /**
   * Every known module for a tenant, with its enabled state + timestamps, plus
   * the industry default set so the admin UI can show "پیش‌فرض این صنف" and
   * offer to add the ones that are still missing.
   */
  async catalogForTenant(tenantId: string) {
    const tenant = await this.assertTenant(tenantId);
    const rows = await this.prisma.client.tenantModule.findMany({ where: { tenantId } });
    const stateByKey = new Map(rows.map((row) => [row.key as ModuleKey, row]));

    const modules = this.catalog().map((entry) => {
      const state = stateByKey.get(entry.key);
      return {
        ...entry,
        isEnabled: state?.isEnabled ?? false,
        enabledAt: state?.enabledAt ?? null,
        disabledAt: state?.disabledAt ?? null,
        // A module can be enabled but missing a required dependency (e.g. it was
        // disabled from the other side). Surface that so the UI can warn.
        missingDependencies: entry.dependencies.filter(
          (dep) => !(stateByKey.get(dep)?.isEnabled ?? false),
        ),
      };
    });

    const enabledKeys = new Set(
      modules.filter((module) => module.isEnabled).map((module) => module.key),
    );
    const defaultModules = await this.industries.defaultModules(tenant.industry);

    return {
      tenantId,
      industry: tenant.industry,
      defaultModules,
      modules,
      enabledCount: modules.filter((m) => m.isEnabled).length,
      totalCount: modules.length,
      missingDefaultModules: defaultModules.filter((key) => !enabledKeys.has(key)),
    };
  }

  /** Enables one or many modules, resolving (and enabling) dependencies. */
  async grant(
    actor: PlatformPrincipal,
    tenantId: string,
    dto: AdminModuleGrantDto,
    context: AuditContext = {},
  ) {
    await this.assertTenant(tenantId);
    const resolved = dto.withDependencies
      ? resolveModuleDependencies(dto.keys as ModuleKey[])
      : (dto.keys as ModuleKey[]);

    await this.prisma.client.$transaction(
      resolved.map((key) =>
        this.prisma.client.tenantModule.upsert({
          where: { tenantId_key: { tenantId, key } },
          update: { isEnabled: true, enabledAt: new Date(), disabledAt: null },
          create: { tenantId, key, isEnabled: true },
        }),
      ),
    );

    await this.audit.record(
      actor,
      {
        action: 'module.grant',
        entity: 'tenant_module',
        entityId: tenantId,
        tenantId,
        after: { requested: dto.keys, enabled: resolved },
      },
      context,
    );

    await this.access.invalidate(tenantId);
    return { enabled: resolved, requested: dto.keys };
  }

  /**
   * Disables a module. By default this also disables any module *depending* on
   * it (cascade) so we never leave a tenant with a broken dependency graph.
   */
  async revoke(
    actor: PlatformPrincipal,
    tenantId: string,
    dto: AdminModuleRevokeDto,
    context: AuditContext = {},
  ) {
    await this.assertTenant(tenantId);
    const key = dto.key as ModuleKey;

    const toDisable = new Set<ModuleKey>([key]);
    if (dto.cascade) {
      const enabledRows = await this.prisma.client.tenantModule.findMany({
        where: { tenantId, isEnabled: true },
        select: { key: true },
      });
      const enabled = new Set(enabledRows.map((row) => row.key as ModuleKey));
      const stack: ModuleKey[] = [key];
      while (stack.length) {
        const current = stack.pop()!;
        for (const candidate of enabled) {
          if (toDisable.has(candidate)) continue;
          if (MODULE_DEPENDENCIES[candidate].includes(current)) {
            toDisable.add(candidate);
            stack.push(candidate);
          }
        }
      }
    }

    const disabled = [...toDisable];
    await this.prisma.client.$transaction(
      disabled.map((moduleKey) =>
        this.prisma.client.tenantModule.upsert({
          where: { tenantId_key: { tenantId, key: moduleKey } },
          update: { isEnabled: false, disabledAt: new Date() },
          create: { tenantId, key: moduleKey, isEnabled: false, disabledAt: new Date() },
        }),
      ),
    );

    await this.audit.record(
      actor,
      {
        action: 'module.revoke',
        entity: 'tenant_module',
        entityId: tenantId,
        tenantId,
        after: { requested: key, disabled, cascade: dto.cascade },
      },
      context,
    );

    await this.access.invalidate(tenantId);
    return { disabled };
  }

  /** Sets an explicit on/off state (used by the toggle grid in the UI). */
  async toggle(
    actor: PlatformPrincipal,
    tenantId: string,
    dto: AdminModuleToggleDto,
    context: AuditContext = {},
  ) {
    return dto.isEnabled
      ? this.grant(actor, tenantId, { keys: [dto.key], withDependencies: true }, context)
      : this.revoke(actor, tenantId, { key: dto.key, cascade: false }, context);
  }

  private async assertTenant(tenantId: string) {
    const found = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, deletedAt: true, industry: true },
    });
    if (!found) throw DomainException.notFound('کسب‌وکار');
    return found;
  }
}
