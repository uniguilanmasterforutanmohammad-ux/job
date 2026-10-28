// TaskForMyAgent — حذف مشتری نباید شماره موبایل را قفل کند (زنده‌شدن مجدد پرونده در پورتال)
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppService } from './app.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { OtpService } from '../auth/otp.service.js';
import type { TokenService } from '../auth/token.service.js';
import type { PaymentsService } from '../payments/payments.service.js';
import type { MessagingService } from '../messaging/messaging.service.js';
import type { AttendanceQrService } from '../attendance/attendance-qr.service.js';

const TENANT = { id: 't1', name: 'زبان‌آموزان تنکا', slug: 'biz-test' };
const DTO = { phone: '09120000078', code: '123456', tenantSlug: 'biz-test' };
const CONTEXT = { userAgent: 'vitest', ip: '127.0.0.1' };

function build() {
  const tx = {
    role: {
      upsert: vi.fn().mockResolvedValue({ id: 'role-end-user' }),
    },
    member: {
      create: vi.fn().mockResolvedValue({
        id: 'm-new',
        fullName: 'کاربر',
        phone: DTO.phone,
        branchId: null,
      }),
      update: vi.fn().mockResolvedValue({ id: 'm-1' }),
    },
    customer: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
            id: where.id,
            ...data,
          }),
        ),
      upsert: vi.fn().mockResolvedValue({ id: 'c-new' }),
    },
  };

  const prisma = {
    client: {
      tenant: { findFirst: vi.fn().mockResolvedValue(TENANT) },
      member: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({ id: 'm-1' }),
      },
      // The staff-side file: when it already holds a real name, the portal
      // member must be born with it (see «inherits the name …» below).
      customer: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn().mockImplementation((cb: (t: unknown) => unknown) => cb(tx)),
    },
  };
  const otp = { verify: vi.fn().mockResolvedValue(undefined) };
  const tokens = { issue: vi.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }) };

  const service = new AppService(
    prisma as unknown as PrismaService,
    otp as unknown as OtpService,
    tokens as unknown as TokenService,
    {} as unknown as PaymentsService,
    {} as unknown as MessagingService,
    {} as unknown as AttendanceQrService,
  );
  return { service, prisma, tx, otp, tokens };
}

describe('AppService.verifyOtp — portal member provisioning', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reuses a visible file without opening a transaction', async () => {
    const { service, prisma } = build();
    prisma.client.member.findFirst.mockResolvedValue({
      id: 'm-1',
      fullName: 'بیتا',
      phone: DTO.phone,
      branchId: null,
      customer: { id: 'c-active', fullName: 'بیتا', deletedAt: null },
    });

    const result = await service.verifyOtp(DTO, CONTEXT);

    expect(result.user).toMatchObject({ memberId: 'm-1', customerId: 'c-active' });
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });

  it('revives a soft-deleted file instead of leaving the portal user file-less', async () => {
    const { service, prisma, tx } = build();
    prisma.client.member.findFirst.mockResolvedValue({
      id: 'm-1',
      fullName: 'بیتا',
      phone: DTO.phone,
      branchId: null,
      customer: { id: 'c-old', fullName: 'بیتا', deletedAt: new Date() },
    });
    // The member's archived file is found by memberId; nobody holds the phone.
    tx.customer.findFirst.mockResolvedValueOnce({ id: 'c-old', fullName: 'بیتا' });
    tx.customer.findFirst.mockResolvedValueOnce(null);

    const result = await service.verifyOtp(DTO, CONTEXT);

    expect(result.user.customerId).toBe('c-old');
    expect(tx.customer.update).toHaveBeenCalledWith({
      where: { id: 'c-old' },
      data: {
        memberId: 'm-1',
        deletedAt: null,
        isActive: true,
        fullName: 'بیتا',
        phone: DTO.phone,
      },
    });
  });

  it('does not steal a phone that another active file now occupies', async () => {
    const { service, prisma, tx } = build();
    prisma.client.member.findFirst.mockResolvedValue({
      id: 'm-1',
      fullName: 'بیتا',
      phone: DTO.phone,
      branchId: null,
      customer: { id: 'c-old', fullName: 'بیتا', deletedAt: new Date() },
    });
    tx.customer.findFirst.mockResolvedValueOnce({ id: 'c-old', fullName: 'بیتا' });
    tx.customer.findFirst.mockResolvedValueOnce({ id: 'c-other' });

    const result = await service.verifyOtp(DTO, CONTEXT);

    expect(result.user.customerId).toBe('c-old');
    const [{ data }] = tx.customer.update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data).not.toHaveProperty('phone');
    expect(data).toMatchObject({ deletedAt: null, isActive: true });
  });

  it('provisions a brand-new member and file on a first-ever portal login', async () => {
    const { service, prisma, tx } = build();
    tx.member.create.mockResolvedValue({
      id: 'm-new',
      fullName: 'کاربر',
      phone: DTO.phone,
      branchId: null,
    });
    tx.customer.findFirst.mockResolvedValue(null);

    const result = await service.verifyOtp(DTO, CONTEXT);

    expect(tx.member.create).toHaveBeenCalledOnce();
    expect(tx.customer.upsert).toHaveBeenCalledOnce();
    expect(result.user).toMatchObject({ memberId: 'm-new', customerId: 'c-new' });
  });

  it('inherits the name the business recorded before the first portal login', async () => {
    const { service, prisma, tx } = build();
    // The staff side registered «زبان‌آموز نمونه» with this phone, but nobody
    // has an END_USER member or a linked file yet.
    prisma.client.customer.findFirst.mockResolvedValue({ fullName: 'زبان‌آموز نمونه' });
    tx.customer.findFirst.mockResolvedValue(null);
    tx.member.create.mockResolvedValue({
      id: 'm-new',
      fullName: 'زبان‌آموز نمونه',
      phone: DTO.phone,
      branchId: null,
    });

    const result = await service.verifyOtp(DTO, CONTEXT);

    expect(tx.member.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fullName: 'زبان‌آموز نمونه' }) }),
    );
    expect(tx.customer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ fullName: 'زبان‌آموز نمونه' }),
      }),
    );
    expect(result.user.fullName).toBe('زبان‌آموز نمونه');
  });

  it('upgrades a placeholder member name to the real file name on login', async () => {
    const { service, prisma } = build();
    prisma.client.member.findFirst.mockResolvedValue({
      id: 'm-1',
      fullName: 'کاربر',
      phone: DTO.phone,
      branchId: null,
      customer: { id: 'c-active', fullName: 'بیتا', deletedAt: null },
    });

    const result = await service.verifyOtp(DTO, CONTEXT);

    expect(prisma.client.member.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { fullName: 'بیتا' },
    });
    expect(result.user).toMatchObject({ memberId: 'm-1', fullName: 'بیتا' });
  });
});
