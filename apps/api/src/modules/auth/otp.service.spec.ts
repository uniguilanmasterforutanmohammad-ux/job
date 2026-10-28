import { describe, expect, it, vi, beforeEach } from 'vitest';
import { hash } from 'argon2';
import { OtpService, maskPhone } from './otp.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { RedisService } from '../../redis/redis.service.js';
import type { ConfigService } from '@nestjs/config';
import type { SmsService } from '../notifications/sms.service.js';

const otpCfg = { ttlSeconds: 120, length: 6, maxAttempts: 5, devBypassCode: undefined };

function build() {
  const prisma = {
    client: {
      otpCode: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: 'o1' }),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    },
  };
  const redis = {
    incrementWithTtl: vi.fn().mockResolvedValue(1),
  };
  const config = { get: vi.fn(() => otpCfg) };
  const sms = { sendOtp: vi.fn().mockResolvedValue(undefined) };
  const service = new OtpService(
    prisma as unknown as PrismaService,
    redis as unknown as RedisService,
    config as unknown as ConfigService,
    sms as unknown as SmsService,
  );
  return { service, prisma, redis, sms };
}

describe('maskPhone', () => {
  it('keeps the first 4 and last 3 digits', () => {
    expect(maskPhone('09121111111')).toBe('0912***111');
  });
  it('masks short values entirely', () => {
    expect(maskPhone('123')).toBe('***');
  });
});

describe('OtpService.request', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a hashed, expiring OTP and sends it', async () => {
    const { service, prisma, sms } = build();
    const result = await service.request('09121111111', 'LOGIN');

    expect(result).toEqual({ expiresInSeconds: 120 });
    expect(prisma.client.otpCode.create).toHaveBeenCalledOnce();
    const created = prisma.client.otpCode.create.mock.calls[0][0].data;
    expect(created.maxAttempts).toBe(5);
    expect(created.expiresAt).toBeInstanceOf(Date);
    expect(typeof created.codeHash).toBe('string');
    expect(sms.sendOtp).toHaveBeenCalledOnce();
  });

  it('throttles after 5 requests in the window', async () => {
    const { service, redis } = build();
    redis.incrementWithTtl.mockResolvedValue(6);
    await expect(service.request('09121111111', 'LOGIN')).rejects.toMatchObject({
      response: { code: 'RATE_LIMITED' },
    });
  });
});

describe('OtpService.verify', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when no pending code exists', async () => {
    const { service, prisma } = build();
    prisma.client.otpCode.findFirst.mockResolvedValue(null);
    await expect(service.verify('0912', '123456', 'LOGIN')).rejects.toMatchObject({
      response: { code: 'OTP_NOT_FOUND' },
    });
  });

  it('rejects an expired code', async () => {
    const { service, prisma } = build();
    prisma.client.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      codeHash: 'x',
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.verify('0912', '123456', 'LOGIN')).rejects.toMatchObject({
      response: { code: 'OTP_EXPIRED' },
    });
  });

  it('rejects when attempts are exhausted', async () => {
    const { service, prisma } = build();
    prisma.client.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      codeHash: 'x',
      attempts: 5,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 1000),
    });
    await expect(service.verify('0912', '123456', 'LOGIN')).rejects.toMatchObject({
      status: 429,
    });
  });

  it('increments the attempt counter on a wrong code', async () => {
    const { service, prisma } = build();
    prisma.client.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      codeHash: await hash('123456'),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.verify('0912', '000000', 'LOGIN')).rejects.toMatchObject({
      response: { code: 'OTP_INVALID' },
    });
    expect(prisma.client.otpCode.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { attempts: { increment: 1 } },
    });
  });

  it('consumes a correct code', async () => {
    const { service, prisma } = build();
    prisma.client.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      codeHash: await hash('123456'),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.verify('0912', '123456', 'LOGIN')).resolves.toBeUndefined();
    expect(prisma.client.otpCode.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { consumedAt: expect.any(Date) },
    });
  });
});
