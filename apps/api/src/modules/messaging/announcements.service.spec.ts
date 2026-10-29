// TaskForMyAgent — ماژول بله: هم‌سان‌سازی اطلاعیه‌های سایت با گروه بیام‌رسان
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnouncementsService } from './announcements.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { BaleService } from '../bale/bale.service.js';

function prismaMock() {
  const client = {
    announcement: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'ann-1', publishedAt: new Date('2026-10-29T00:00:00Z'), ...data }),
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'ann-1', ...data }),
      ),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn(),
    },
    message: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    customer: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const prisma = {
    client: {
      ...client,
      $transaction: vi.fn((arg: unknown) =>
        typeof arg === 'function' ? (arg as (tx: unknown) => Promise<unknown>)(client) : Promise.all(arg as Promise<unknown>[]),
      ),
    },
  };
  return { prisma: prisma as unknown as PrismaService, client };
}

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let client: ReturnType<typeof prismaMock>['client'];
  let bale: { mirror: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const mock = prismaMock();
    client = mock.client;
    bale = { mirror: vi.fn().mockResolvedValue({ status: 'SENT', messageId: '77' }) };
    service = new AnnouncementsService(mock.prisma, bale as unknown as BaleService);
  });

  it('creates one in-app notice per customer and mirrors once to Bale', async () => {
    client.customer.findMany.mockResolvedValue([
      { id: 'c1', phone: '09120000001', email: null },
      { id: 'c2', phone: '09120000002', email: 'a@b.c' },
    ]);

    const result = await service.publish(
      't1',
      {
        title: 'تعطیلی باشگاه',
        body: 'یکشنبه تعطیل است',
        audience: 'ALL',
        mirrorToBale: true,
        eventDate: new Date('2026-11-02T00:00:00.000Z'),
      },
      'member-1',
    );

    expect(client.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recipients: 2, audience: 'ALL' }) }),
    );
    const rows = client.message.createMany.mock.calls[0][0].data as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      tenantId: 't1',
      customerId: 'c1',
      channel: 'IN_APP',
      status: 'SENT',
      subject: 'تعطیلی باشگاه',
      meta: expect.objectContaining({ event: 'announcement', announcementId: 'ann-1' }),
    });
    expect(bale.mirror).toHaveBeenCalledTimes(1);
    expect(bale.mirror).toHaveBeenCalledWith('t1', 'announcement', expect.objectContaining({ title: 'تعطیلی باشگاه' }));
    expect(client.announcement.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ baleStatus: 'SENT', baleMessageId: '77' }) }),
    );
    expect(result.bale.status).toBe('SENT');
  });

  it('does not call Bale when the owner unticks the mirror option', async () => {
    client.customer.findMany.mockResolvedValue([{ id: 'c1', phone: null, email: null }]);

    const result = await service.publish('t1', {
      title: 'خبر',
      body: 'متن خبر',
      audience: 'ALL',
      mirrorToBale: false,
    });

    expect(bale.mirror).not.toHaveBeenCalled();
    expect(result.bale).toEqual({ status: 'SKIPPED', reason: 'disabled_by_user' });
  });

  it('rejects a selected audience with no valid recipients', async () => {
    client.customer.findMany.mockResolvedValue([]);

    await expect(
      service.publish('t1', {
        title: 'فقط چند نفر',
        body: 'متن',
        audience: 'SELECTED',
        customerIds: ['11111111-1111-1111-1111-111111111111'],
        mirrorToBale: true,
      }),
    ).rejects.toThrow(/هیچ گیرنده/);
    expect(client.announcement.create).not.toHaveBeenCalled();
  });

  it('resends an existing announcement to Bale', async () => {
    client.announcement.findFirst.mockResolvedValue({
      id: 'ann-1',
      tenantId: 't1',
      title: 'تعطیلی',
      body: 'متن',
      eventDate: null,
    });

    const result = await service.resendToBale('t1', 'ann-1');

    expect(bale.mirror).toHaveBeenCalledWith('t1', 'announcement', { title: 'تعطیلی', body: 'متن', eventDate: null });
    expect(result.status).toBe('SENT');
  });
});
