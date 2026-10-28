import { describe, expect, it, vi, beforeEach } from 'vitest';
// TaskForMyAgent #3/#4 — حاضری با QR/لینک و از پنل شاگرد + ثبت روز تقویمی درست
// (جزئیات در docs/AGENT_RULES.md)
import { AttendanceQrService } from './attendance-qr.service.js';
import { todayDateOnly } from '../../common/dto/date-only.dto.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { RedisService } from '../../redis/redis.service.js';
import type { OtpService } from '../auth/otp.service.js';

function build() {
  const prisma = {
    client: {
      branch: { findFirst: vi.fn().mockResolvedValue({ id: 'b1' }) },
      service: { findFirst: vi.fn().mockResolvedValue({ id: 's1' }) },
      tenant: { findUnique: vi.fn().mockResolvedValue({ name: 'T', slug: 't' }) },
      customer: {
        findFirst: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 'c1', memberId: null }),
      },
      attendance: { create: vi.fn().mockResolvedValue({ id: 'a1' }), findMany: vi.fn() },
      attendanceQrSession: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    },
  };
  const redis = {
    getJson: vi.fn().mockResolvedValue(null),
    setJson: vi.fn().mockResolvedValue(undefined),
  };
  const otp = { request: vi.fn(), verify: vi.fn() };
  const service = new AttendanceQrService(
    prisma as unknown as PrismaService,
    redis as unknown as RedisService,
    otp as unknown as OtpService,
  );
  return { service, prisma, redis, otp };
}

const now = new Date();

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    tenantId: 't1',
    branchId: null,
    serviceId: null,
    appointmentId: null,
    label: 'تمرین',
    code: 'ABC234',
    secret: 'test-secret',
    rotateSeconds: 45,
    radiusMeters: 150,
    requireOtp: true,
    status: 'OPEN',
    openedByMemberId: 'm1',
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    closedAt: null,
    createdAt: now,
    ...overrides,
  };
}

describe('AttendanceQrService.openSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a session with a short code, secret and QR data URL', async () => {
    const { service, prisma } = build();
    prisma.client.attendanceQrSession.create.mockResolvedValue(sessionRow());

    const result = await service.openSession('t1', 'm1', {
      rotateSeconds: 45,
      radiusMeters: 150,
      requireOtp: true,
      ttlMinutes: 120,
    });

    const created = prisma.client.attendanceQrSession.create.mock.calls[0][0].data;
    expect(created.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(created.secret.length).toBeGreaterThan(16);
    expect(created.status).toBeUndefined(); // defaults to OPEN in the DB
    expect(result.code).toBe('ABC234');
    expect(result.qrDataUrl?.startsWith('data:image/png;base64,')).toBe(true);
    expect(result.token).toBeTruthy();
    expect(result.tokenExpiresInSeconds).toBeGreaterThan(0);
    expect(result.tokenExpiresInSeconds).toBeLessThanOrEqual(45);
    expect(result.checkInUrl).toContain('/attendance/scan/ABC234');
  });
});

describe('AttendanceQrService public lookup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the tenant and session metadata for an open code', async () => {
    const { service, prisma } = build();
    prisma.client.attendanceQrSession.findFirst.mockResolvedValue(sessionRow());

    const result = await service.lookupByCode('ABC234');
    expect(result.code).toBe('ABC234');
    expect(result.tenant?.name).toBe('T');
    expect(result.tokenValid).toBeNull();
  });

  it('rejects a closed session', async () => {
    const { service, prisma } = build();
    prisma.client.attendanceQrSession.findFirst.mockResolvedValue(sessionRow({ status: 'CLOSED' }));
    await expect(service.lookupByCode('ABC234')).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an expired session', async () => {
    const { service, prisma } = build();
    prisma.client.attendanceQrSession.findFirst.mockResolvedValue(
      sessionRow({ expiresAt: new Date(now.getTime() - 1000) }),
    );
    await expect(service.lookupByCode('ABC234')).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an unknown code', async () => {
    const { service, prisma } = build();
    prisma.client.attendanceQrSession.findFirst.mockResolvedValue(null);
    await expect(service.lookupByCode('ZZZZZZ')).rejects.toMatchObject({ status: 404 });
  });
});

describe('AttendanceQrService.checkIn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an invalid rotating token', async () => {
    const { service, prisma } = build();
    prisma.client.attendanceQrSession.findMany.mockResolvedValue([sessionRow()]);
    await expect(
      service.checkIn({ token: 'bogus', phone: '09120000000', otp: '123456' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('verifies the OTP and records a QR attendance', async () => {
    const { service, prisma, redis, otp } = build();
    prisma.client.attendanceQrSession.findMany.mockResolvedValue([sessionRow()]);
    prisma.client.customer.findFirst.mockResolvedValue({ id: 'c1', memberId: null });

    // Produce the correct current token via the same HMAC the service uses.
    const { createHmac } = await import('node:crypto');
    const bucket = Math.floor(Date.now() / 45_000);
    const token = createHmac('sha256', 'test-secret').update(String(bucket)).digest('base64url');

    const result = await service.checkIn({ token, phone: '09120000000', otp: '123456' });

    expect(otp.verify).toHaveBeenCalledWith('09120000000', '123456', 'LOGIN');
    expect(prisma.client.attendance.create).toHaveBeenCalledOnce();
    const data = prisma.client.attendance.create.mock.calls[0][0].data;
    expect(data.method).toBe('QR');
    expect(data.status).toBe('PRESENT');
    expect(data.sessionId).toBe('q1');
    expect(result.alreadyCheckedIn).toBe(false);
    expect(redis.setJson).toHaveBeenCalled();
  });

  it('is idempotent within the dedupe window', async () => {
    const { service, prisma, redis } = build();
    prisma.client.attendanceQrSession.findMany.mockResolvedValue([sessionRow()]);
    prisma.client.customer.findFirst.mockResolvedValue({ id: 'c1', memberId: null });
    redis.getJson.mockResolvedValue({ attendanceId: 'existing' });

    const { createHmac } = await import('node:crypto');
    const bucket = Math.floor(Date.now() / 45_000);
    const token = createHmac('sha256', 'test-secret').update(String(bucket)).digest('base64url');

    const result = await service.checkIn({ token, phone: '09120000000', otp: '123456' });
    expect(result).toEqual({ alreadyCheckedIn: true, attendanceId: 'existing' });
    expect(prisma.client.attendance.create).not.toHaveBeenCalled();
  });

  it('skips OTP when requireOtp is false', async () => {
    const { service, prisma, otp } = build();
    prisma.client.attendanceQrSession.findMany.mockResolvedValue([
      sessionRow({ requireOtp: false }),
    ]);
    prisma.client.customer.findFirst.mockResolvedValue({ id: 'c1', memberId: null });

    const { createHmac } = await import('node:crypto');
    const bucket = Math.floor(Date.now() / 45_000);
    const token = createHmac('sha256', 'test-secret').update(String(bucket)).digest('base64url');

    await service.checkIn({ token, phone: '09120000000', otp: '000000' });
    expect(otp.verify).not.toHaveBeenCalled();
    expect(prisma.client.attendance.create).toHaveBeenCalledOnce();
  });

  it('accepts a session code instead of a rotating token (shared-link check-in)', async () => {
    const { service, prisma, otp } = build();
    prisma.client.attendanceQrSession.findFirst.mockResolvedValue(sessionRow());
    prisma.client.customer.findFirst.mockResolvedValue({ id: 'c1', memberId: null });

    const result = await service.checkIn({ code: 'ABC234', phone: '09120000000', otp: '123456' });

    expect(otp.verify).toHaveBeenCalledWith('09120000000', '123456', 'LOGIN');
    expect(prisma.client.attendance.create).toHaveBeenCalledOnce();
    expect(result.alreadyCheckedIn).toBe(false);
  });
});

describe('AttendanceQrService.appCheckIn (panel)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records a panel check-in for an open session without an OTP', async () => {
    const { service, prisma, otp } = build();
    prisma.client.attendanceQrSession.findFirst.mockResolvedValue(sessionRow());

    const result = await service.appCheckIn('c1', 't1', { sessionId: 'q1' });

    expect(otp.verify).not.toHaveBeenCalled();
    const data = prisma.client.attendance.create.mock.calls[0][0].data;
    expect(data.customerId).toBe('c1');
    expect(data.tenantId).toBe('t1');
    expect(data.method).toBe('MANUAL');
    expect(data.note).toBe('panel');
    // `date` is a PostgreSQL `date` column: it must be UTC midnight of today's
    // local calendar day, not a local-midnight value (which Prisma would store
    // one day earlier east of UTC).
    expect(data.date).toEqual(todayDateOnly());
    expect(data.date.getUTCHours()).toBe(0);
    expect(data.date.getUTCDate()).toBe(new Date().getDate());
    expect(result.alreadyCheckedIn).toBe(false);
  });

  it('rejects a closed session', async () => {
    const { service, prisma } = build();
    prisma.client.attendanceQrSession.findFirst.mockResolvedValue(
      sessionRow({ status: 'CLOSED' }),
    );
    await expect(service.appCheckIn('c1', 't1', { code: 'ABC234' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rejects an unknown session', async () => {
    const { service, prisma } = build();
    prisma.client.attendanceQrSession.findFirst.mockResolvedValue(null);
    await expect(service.appCheckIn('c1', 't1', { sessionId: 'q9' })).rejects.toMatchObject({
      status: 404,
    });
  });
});
