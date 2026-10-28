// TaskForMyAgent — چند عضویتی کاربر نهایی (زبان‌آموز + شاگرد باشگاه) و تغییر کسب‌وکار فعال در پنل
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppService } from './app.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { OtpService } from '../auth/otp.service.js';
import type { TokenService } from '../auth/token.service.js';
import type { PaymentsService } from '../payments/payments.service.js';
import type { MessagingService } from '../messaging/messaging.service.js';
import type { AttendanceQrService } from '../attendance/attendance-qr.service.js';

const PHONE = '09120000099';
const CONTEXT = { userAgent: 'vitest', ip: '127.0.0.1' };

function build() {
  const tx = {
    role: { upsert: vi.fn().mockResolvedValue({ id: 'role-end-user' }) },
    member: { create: vi.fn(), update: vi.fn() },
    customer: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn(), upsert: vi.fn() },
  };
  const client: Record<string, unknown> = {
    member: {
      // 1st call: the signed-in member (looked up by id). 2nd call: the member
      // row of the target club inside `resolveOrCreatePortalUser`.
      findFirst: vi
        .fn()
        .mockResolvedValueOnce({ phone: PHONE })
        .mockResolvedValue({
          id: 'm-gym',
          fullName: 'بیتا',
          phone: PHONE,
          branchId: null,
          customer: { id: 'c-gym', fullName: 'بیتا', deletedAt: null },
        }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'm-lang',
          tenantId: 't-lang',
          phone: PHONE,
          fullName: 'بیتا',
          isActive: true,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          tenant: {
            id: 't-lang',
            name: 'زبان‌آموزان تنکا',
            slug: 'biz-lang',
            industry: 'LANGUAGE_SCHOOL',
            logoUrl: null,
          },
          branch: { id: 'b1', name: 'آموزشگاه یک', city: null },
          customer: { id: 'c-lang', fullName: 'بیتا', isActive: true },
        },
        {
          id: 'm-gym',
          tenantId: 't-gym',
          phone: PHONE,
          fullName: 'بیتا',
          isActive: true,
          createdAt: new Date('2026-02-03T00:00:00.000Z'),
          tenant: {
            id: 't-gym',
            name: 'باشگاه موج',
            slug: 'biz-gym',
            industry: 'SPORTS_COACHING',
            logoUrl: null,
          },
          branch: null,
          customer: { id: 'c-gym', fullName: 'بیتا', isActive: true },
        },
      ]),
    },
    customer: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn().mockImplementation((cb: (t: unknown) => unknown) => cb(tx)),
  };
  const prisma = { client };
  const tokens = { issue: vi.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }) };

  const service = new AppService(
    prisma as unknown as PrismaService,
    { verify: vi.fn() } as unknown as OtpService,
    tokens as unknown as TokenService,
    {} as unknown as PaymentsService,
    {} as unknown as MessagingService,
    {} as unknown as AttendanceQrService,
  );
  return { service, prisma, tx, tokens };
}

describe('AppService.switchClub — multi-club پورتال', () => {
  beforeEach(() => vi.clearAllMocks());

  it('issues a token scoped to the chosen club', async () => {
    const { service, tokens } = build();

    const result = await service.switchClub('m-lang', { tenantId: 't-gym' }, CONTEXT);

    expect(tokens.issue).toHaveBeenCalledTimes(1);
    const [payload] = tokens.issue.mock.calls[0] as [Record<string, unknown>];
    expect(payload).toMatchObject({
      tenantId: 't-gym',
      systemRole: 'END_USER',
      permissions: ['app:read', 'app:write'],
    });
    expect(result.user.tenantId).toBe('t-gym');
    expect(result.user.tenantName).toBe('باشگاه موج');
    expect(result.clubs.map((club) => club.tenantId)).toEqual(['t-lang', 't-gym']);
    // The profile shows when each membership started.
    expect(result.clubs.map((club) => club.joinedAt)).toEqual([
      '2026-01-02T00:00:00.000Z',
      '2026-02-03T00:00:00.000Z',
    ]);
  });

  it('rejects a business the phone is not a member of', async () => {
    const { service, tokens } = build();

    await expect(service.switchClub('m-lang', { tenantId: 't-other' }, CONTEXT)).rejects.toThrow(
      /عضو نیست/,
    );
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('refuses when the member has no phone to match memberships with', async () => {
    const { service, prisma, tokens } = build();
    (prisma.client.member as { findFirst: ReturnType<typeof vi.fn> }).findFirst.mockResolvedValue({
      phone: null,
    });

    await expect(service.switchClub('m-lang', { tenantId: 't-gym' }, CONTEXT)).rejects.toThrow();
    expect(tokens.issue).not.toHaveBeenCalled();
  });
});
