import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ModuleAccessService } from './module-access.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { RedisService } from '../../redis/redis.service.js';

type Mocks = {
  service: ModuleAccessService;
  prisma: { client: { tenantModule: { findMany: ReturnType<typeof vi.fn> } } };
  redis: {
    getJson: ReturnType<typeof vi.fn>;
    setJson: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
  };
};

function build(): Mocks {
  const prisma = {
    client: { tenantModule: { findMany: vi.fn() } },
  };
  const redis = {
    getJson: vi.fn(),
    setJson: vi.fn(),
    del: vi.fn(),
  };
  const service = new ModuleAccessService(
    prisma as unknown as PrismaService,
    redis as unknown as RedisService,
  );
  return { service, prisma, redis };
}

describe('ModuleAccessService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reads enabled modules from the DB and caches the result', async () => {
    const { service, prisma, redis } = build();
    redis.getJson.mockResolvedValue(null);
    prisma.client.tenantModule.findMany.mockResolvedValue([{ key: 'CRM' }, { key: 'FIN' }]);

    const result = await service.enabledModules('t1');

    expect([...result].sort()).toEqual(['CRM', 'FIN']);
    expect(prisma.client.tenantModule.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', isEnabled: true },
      select: { key: true },
    });
    expect(redis.setJson).toHaveBeenCalledWith('module-access:t1', ['CRM', 'FIN'], 60);
  });

  it('serves from cache without hitting the DB', async () => {
    const { service, prisma, redis } = build();
    redis.getJson.mockResolvedValue(['CRM']);

    const result = await service.enabledModules('t1');

    expect([...result]).toEqual(['CRM']);
    expect(prisma.client.tenantModule.findMany).not.toHaveBeenCalled();
  });

  it('isEnabled reflects the cached set', async () => {
    const { service, redis } = build();
    redis.getJson.mockResolvedValue(['SCH']);
    await expect(service.isEnabled('t1', 'SCH')).resolves.toBe(true);
    await expect(service.isEnabled('t1', 'FIN')).resolves.toBe(false);
  });

  it('invalidate deletes the tenant cache key', async () => {
    const { service, redis } = build();
    await service.invalidate('t9');
    expect(redis.del).toHaveBeenCalledWith('module-access:t9');
  });

  it('invalidate swallows Redis errors so a cache outage cannot break writes', async () => {
    const { service, redis } = build();
    redis.del.mockRejectedValue(new Error('redis down'));
    await expect(service.invalidate('t9')).resolves.toBeUndefined();
  });
});
