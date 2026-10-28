import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AttendanceExtraService } from './attendance-extra.service.js';
import type { PrismaService } from '../../database/prisma.service.js';

const absenceRow = {
  id: 'ar1',
  tenantId: 't1',
  customerId: 'c1',
  absenceDate: new Date('2026-10-20'),
  reason: 'بیماری',
  note: 'تب داشتم',
  status: 'PENDING',
};

function build() {
  const attendance = {
    findFirst: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
  };
  const absenceRequest = {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn().mockResolvedValue({ ...absenceRow, status: 'APPROVED' }),
  };
  const tx = { absenceRequest, attendance };
  const prisma = {
    client: {
      absenceRequest: {
        ...absenceRequest,
        findMany: vi.fn().mockResolvedValue([absenceRow]),
      },
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    },
  };
  const service = new AttendanceExtraService(prisma as unknown as PrismaService);
  return { service, prisma, tx };
}

describe('AttendanceExtraService.listAbsenceRequests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns requests scoped to the tenant with the customer joined', async () => {
    const { service, prisma } = build();
    const result = await service.listAbsenceRequests('t1', { status: 'PENDING' });
    expect(prisma.client.absenceRequest.findMany).toHaveBeenCalledOnce();
    const args = prisma.client.absenceRequest.findMany.mock.calls[0][0];
    expect(args.where.tenantId).toBe('t1');
    expect(args.where.status).toBe('PENDING');
    expect(result).toHaveLength(1);
  });
});

describe('AttendanceExtraService.reviewAbsenceRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a request that is not pending', async () => {
    const { service, prisma } = build();
    prisma.client.absenceRequest.findFirst.mockResolvedValue({
      ...absenceRow,
      status: 'APPROVED',
    });
    await expect(
      service.reviewAbsenceRequest('t1', 'm1', 'ar1', { decision: 'APPROVED' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('404s when the request is not in the tenant', async () => {
    const { service, prisma } = build();
    prisma.client.absenceRequest.findFirst.mockResolvedValue(null);
    await expect(
      service.reviewAbsenceRequest('t1', 'm1', 'nope', { decision: 'REJECTED' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('records an EXCUSED attendance when approved', async () => {
    const { service, prisma, tx } = build();
    prisma.client.absenceRequest.findFirst.mockResolvedValue(absenceRow);

    const result = await service.reviewAbsenceRequest('t1', 'm1', 'ar1', {
      decision: 'APPROVED',
      reviewNote: 'بهبودی سریع',
    });

    expect(tx.absenceRequest.update).toHaveBeenCalledOnce();
    expect(tx.attendance.findFirst).toHaveBeenCalledOnce();
    expect(tx.attendance.create).toHaveBeenCalledOnce();
    const created = tx.attendance.create.mock.calls[0][0].data;
    expect(created.status).toBe('EXCUSED');
    expect(created.customerId).toBe('c1');
    expect(created.note).toContain('موجه');
    // The excused record must land on the requested day, stored as UTC
    // midnight (PostgreSQL `date` column).
    expect(created.date).toEqual(absenceRow.absenceDate);
    expect(result.status).toBe('APPROVED');
  });

  it('updates an existing attendance row instead of duplicating it', async () => {
    const { service, prisma, tx } = build();
    prisma.client.absenceRequest.findFirst.mockResolvedValue(absenceRow);
    tx.attendance.findFirst.mockResolvedValue({ id: 'a9' });

    await service.reviewAbsenceRequest('t1', 'm1', 'ar1', { decision: 'APPROVED' });

    expect(tx.attendance.update).toHaveBeenCalledOnce();
    expect(tx.attendance.update.mock.calls[0][0].where.id).toBe('a9');
    expect(tx.attendance.create).not.toHaveBeenCalled();
  });

  it('does not touch attendance when rejected', async () => {
    const { service, prisma, tx } = build();
    prisma.client.absenceRequest.findFirst.mockResolvedValue(absenceRow);

    await service.reviewAbsenceRequest('t1', 'm1', 'ar1', {
      decision: 'REJECTED',
      reviewNote: 'دلیل کافی نبود',
    });

    expect(tx.absenceRequest.update).toHaveBeenCalledOnce();
    expect(tx.attendance.create).not.toHaveBeenCalled();
    expect(tx.attendance.update).not.toHaveBeenCalled();
  });
});
