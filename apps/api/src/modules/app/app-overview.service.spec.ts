// TaskForMyAgent — خلاصهٔ همهٔ مجموعه‌های کاربر در پنل /me (حضور، شهریه، اطلاعیه، نوبت)
import { describe, expect, it, vi } from 'vitest';
import { AppService } from './app.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { OtpService } from '../auth/otp.service.js';
import type { TokenService } from '../auth/token.service.js';
import type { PaymentsService } from '../payments/payments.service.js';
import type { MessagingService } from '../messaging/messaging.service.js';
import type { AttendanceQrService } from '../attendance/attendance-qr.service.js';
import type { ShopService } from '../shop/shop.service.js';

const PHONE = '09120000088';

function membership(over: Record<string, unknown>) {
  return {
    id: `m-${over.tenantId as string}`,
    tenantId: 't',
    phone: PHONE,
    fullName: 'بیتا',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    branch: null,
    customer: { id: `c-${over.tenantId as string}`, fullName: 'بیتا', isActive: true },
    tenant: {
      id: 't',
      name: 'مجموعه',
      slug: 'biz',
      industry: 'SPORTS_COACHING',
      logoUrl: null,
    },
    ...over,
  };
}

function build(rows: unknown[]) {
  const client = {
    member: {
      findUnique: vi.fn().mockResolvedValue({ phone: PHONE }),
      findMany: vi.fn().mockResolvedValue(rows),
    },
    customer: { findMany: vi.fn().mockResolvedValue([]) },
    attendance: { groupBy: vi.fn().mockResolvedValue([]) },
    invoice: { findMany: vi.fn().mockResolvedValue([]) },
    installment: { findMany: vi.fn().mockResolvedValue([]) },
    message: { findMany: vi.fn().mockResolvedValue([]) },
    appointment: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const prisma = { client };
  const service = new AppService(
    prisma as unknown as PrismaService,
    {} as unknown as OtpService,
    {} as unknown as TokenService,
    {} as unknown as PaymentsService,
    {} as unknown as MessagingService,
    {} as unknown as AttendanceQrService,
    {} as unknown as ShopService,
  );
  return { service, client };
}

describe('AppService.myOverview — خلاصهٔ چند مجموعه در پنل کاربری', () => {
  it('keeps every club’s attendance, tuition, notices and appointment separate', async () => {
    const { service, client } = build([
      membership({ tenantId: 't-lang', customer: { id: 'c-lang', fullName: 'بیتا', isActive: true } }),
      membership({ tenantId: 't-gym', customer: { id: 'c-gym', fullName: 'بیتا', isActive: true } }),
    ]);
    client.attendance.groupBy.mockResolvedValue([
      { customerId: 'c-lang', status: 'PRESENT', _count: { _all: 3 } },
      { customerId: 'c-lang', status: 'ABSENT', _count: { _all: 1 } },
      { customerId: 'c-gym', status: 'LATE', _count: { _all: 1 } },
    ]);
    client.invoice.findMany.mockResolvedValue([
      { customerId: 'c-lang', total: 2000000, paidTotal: 500000, dueDate: new Date('2026-11-10') },
      { customerId: 'c-gym', total: 1000000, paidTotal: 1000000, dueDate: null },
    ]);
    client.installment.findMany.mockResolvedValue([
      { customerId: 'c-lang', amount: 300000, dueDate: new Date('2026-11-01') },
    ]);
    client.message.findMany.mockResolvedValue([
      {
        id: 'n-1',
        customerId: 'c-lang',
        subject: 'تعطیلی کلاس',
        body: 'کلاس فردا برگزار نمی‌شود',
        channel: 'SMS',
        createdAt: new Date('2026-10-29T09:00:00.000Z'),
        readAt: null,
      },
      {
        id: 'n-2',
        customerId: 'c-lang',
        subject: null,
        body: 'یادآوری شهریه',
        channel: 'SMS',
        createdAt: new Date('2026-10-20T09:00:00.000Z'),
        readAt: new Date('2026-10-21T09:00:00.000Z'),
      },
    ]);
    client.appointment.findMany.mockResolvedValue([
      { customerId: 'c-gym', startsAt: new Date('2026-11-05T10:00:00.000Z') },
    ]);

    const result = await service.myOverview('m-1');

    expect(result.clubs.map((club) => club.tenantId)).toEqual(['t-lang', 't-gym']);
    const lang = result.clubs[0];
    const gym = result.clubs[1];

    expect(lang.attendance).toEqual({ present: 3, total: 4, ratio: 75 });
    expect(lang.finance).toMatchObject({ outstanding: 1800000, invoices: 1, installments: 1 });
    expect(lang.finance.nextDueDate).toEqual(new Date('2026-11-01'));
    expect(lang.notices).toMatchObject({ total: 2, unread: 1 });
    expect(lang.notices.latest?.subject).toBe('تعطیلی کلاس');
    expect(lang.appointments).toMatchObject({ upcoming: 0, nextStartsAt: null });

    expect(gym.attendance).toEqual({ present: 1, total: 1, ratio: 100 });
    expect(gym.finance.outstanding).toBe(0);
    expect(gym.notices).toMatchObject({ total: 0, unread: 0, latest: null });
    expect(gym.appointments.nextStartsAt).toEqual(new Date('2026-11-05T10:00:00.000Z'));

    expect(result.totals).toMatchObject({
      clubs: 2,
      industries: 1,
      outstanding: 1800000,
      unreadNotices: 1,
      upcomingAppointments: 1,
    });
    expect(lang.joinedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns zeros for a membership that has no customer record in that club', async () => {
    const { service, client } = build([membership({ tenantId: 't-x', customer: null })]);

    const result = await service.myOverview('m-1');

    expect(result.clubs[0].attendance).toEqual({ present: 0, total: 0, ratio: 0 });
    expect(result.clubs[0].finance).toMatchObject({ outstanding: 0, nextDueDate: null });
    expect(result.clubs[0].notices).toMatchObject({ total: 0, unread: 0, latest: null });
    expect(result.totals.outstanding).toBe(0);
    // No customer id → nothing to aggregate, so no query is issued at all.
    expect(client.attendance.groupBy).not.toHaveBeenCalled();
  });

  it('handles a phone with no memberships', async () => {
    const { service } = build([]);

    const result = await service.myOverview('m-1');

    expect(result.clubs).toEqual([]);
    expect(result.totals).toEqual({
      clubs: 0,
      industries: 0,
      outstanding: 0,
      unreadNotices: 0,
      upcomingAppointments: 0,
    });
  });
});
