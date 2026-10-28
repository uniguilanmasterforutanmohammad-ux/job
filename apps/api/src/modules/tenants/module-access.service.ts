import { Injectable, Logger } from '@nestjs/common';
import { MODULE_KEYS, type ModuleKey } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';

const CACHE_PREFIX = 'module-access:';
const CACHE_TTL_SECONDS = 60;

/**
 * Answers "is module X enabled for tenant Y?" with a short Redis cache so that
 * toggling modules in the admin panel takes effect within seconds without
 * hitting PostgreSQL on every request.
 */
@Injectable()
export class ModuleAccessService {
  private readonly logger = new Logger(ModuleAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Returns the set of enabled module keys for a tenant. */
  async enabledModules(tenantId: string): Promise<Set<ModuleKey>> {
    const cacheKey = `${CACHE_PREFIX}${tenantId}`;
    const cached = await this.redis.getJson<string[]>(cacheKey);
    if (cached) return new Set(cached as ModuleKey[]);

    const rows = await this.prisma.client.tenantModule.findMany({
      where: { tenantId, isEnabled: true },
      select: { key: true },
    });
    const keys = rows.map((row) => row.key as ModuleKey);
    await this.redis.setJson(cacheKey, keys, CACHE_TTL_SECONDS);
    return new Set(keys);
  }

  async isEnabled(tenantId: string, key: ModuleKey): Promise<boolean> {
    return (await this.enabledModules(tenantId)).has(key);
  }

  /** Invalidates a tenant's cached module set (call after any toggle). */
  async invalidate(tenantId: string): Promise<void> {
    try {
      await this.redis.del(`${CACHE_PREFIX}${tenantId}`);
    } catch (error) {
      this.logger.warn(`Module cache invalidation failed: ${(error as Error).message}`);
    }
  }
}

export const KNOWN_MODULE_KEYS = new Set<string>(MODULE_KEYS);
