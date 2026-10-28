// TaskForMyAgent — حذف مشتری نباید شماره موبایل را قفل کند (افزودن دوباره با همان شماره)
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CustomersService } from './customers.service.js';
import type { PrismaService } from '../../database/prisma.service.js';

const BASE_DTO = {
  fullName: 'نازنین رضایی',
  phone: '09120000001',
  tags: [],
  leadStage: 'LEAD' as const,
  type: 'INDIVIDUAL' as const,
};

function build() {
  const prisma = {
    client: {
      customer: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          id: 'new-1',
          ...data,
        })),
        update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          id: 'c-1',
          ...data,
        })),
      },
      branch: { findFirst: vi.fn().mockResolvedValue(null) },
    },
  };
  return { service: new CustomersService(prisma as unknown as PrismaService), prisma };
}

describe('CustomersService.create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a phone that belongs to a visible customer', async () => {
    const { service, prisma } = build();
    prisma.client.customer.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(service.create('t1', BASE_DTO)).rejects.toMatchObject({ status: 409 });
    expect(prisma.client.customer.create).not.toHaveBeenCalled();
  });

  it('only looks at visible (non-deleted) customers for the duplicate check', async () => {
    const { service, prisma } = build();
    await service.create('t1', BASE_DTO);

    expect(prisma.client.customer.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 't1', phone: '09120000001', deletedAt: null },
      select: { id: true },
    });
    expect(prisma.client.customer.create).toHaveBeenCalledOnce();
  });

  it('re-adds a person whose previous file was deleted', async () => {
    const { service, prisma } = build();
    // Deleted files no longer hold the phone, so the duplicate search is empty.
    prisma.client.customer.findFirst.mockResolvedValue(null);

    await expect(service.create('t1', BASE_DTO)).resolves.toMatchObject({ id: 'new-1' });
  });

  it('skips the duplicate check when no phone is given', async () => {
    const { service, prisma } = build();
    await service.create('t1', { ...BASE_DTO, phone: undefined });
    expect(prisma.client.customer.findFirst).not.toHaveBeenCalled();
  });
});

describe('CustomersService.remove', () => {
  beforeEach(() => vi.clearAllMocks());

  it('soft deletes and releases the phone number', async () => {
    const { service, prisma } = build();
    prisma.client.customer.findFirst.mockResolvedValue({
      id: 'c-1',
      phone: '09120000001',
      meta: { vip: true },
    });

    await expect(service.remove('t1', 'c-1')).resolves.toEqual({ message: 'مشتری حذف شد' });

    const [{ data }] = prisma.client.customer.update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data.deletedAt).toBeInstanceOf(Date);
    expect(data.isActive).toBe(false);
    expect(data.phone).toBeNull();
    expect(data.meta).toEqual({ vip: true, archivedPhone: '09120000001' });
  });

  it('keeps the archived number even when meta was empty', async () => {
    const { service, prisma } = build();
    prisma.client.customer.findFirst.mockResolvedValue({
      id: 'c-2',
      phone: '09120000002',
      meta: null,
    });

    await service.remove('t1', 'c-2');

    const [{ data }] = prisma.client.customer.update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data.meta).toEqual({ archivedPhone: '09120000002' });
  });

  it('refuses to delete a missing or already-deleted customer', async () => {
    const { service, prisma } = build();
    await expect(service.remove('t1', 'nope')).rejects.toMatchObject({ status: 404 });
    expect(prisma.client.customer.update).not.toHaveBeenCalled();
  });
});

// TaskForMyAgent — صنف زبان‌آموز و صنف‌های آموزشی باید «آموزشگاه» تعریف کنند (شعبهٔ کاربر نهایی)
describe('CustomersService branch assignment', () => {
  beforeEach(() => vi.clearAllMocks());

  const BRANCH_ID = '11111111-2222-4333-8444-555555555555';

  it('files a new end-user under the chosen location', async () => {
    const { service, prisma } = build();
    prisma.client.branch.findFirst.mockResolvedValue({ id: BRANCH_ID });

    await service.create('t1', { ...BASE_DTO, branchId: BRANCH_ID });

    expect(prisma.client.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ branchId: BRANCH_ID }),
    });
  });

  it('rejects a location id that belongs to another tenant', async () => {
    const { service, prisma } = build();
    prisma.client.branch.findFirst.mockResolvedValue(null);

    await expect(service.create('t1', { ...BASE_DTO, branchId: BRANCH_ID })).rejects.toMatchObject({
      response: { code: 'INVALID_BRANCH' },
    });
    expect(prisma.client.customer.create).not.toHaveBeenCalled();
  });

  it('only resolves a location when one was actually sent', async () => {
    const { service, prisma } = build();
    await service.create('t1', BASE_DTO);
    expect(prisma.client.branch.findFirst).not.toHaveBeenCalled();
  });
});
