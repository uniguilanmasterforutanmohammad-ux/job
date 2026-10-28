// TaskForMyAgent — تنظیم/تغییر رمز عبور توسط خود کاربر (شاگرد/زبان‌آموز و کارکنان)
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { hash, verify } from 'argon2';
import { AuthService } from './auth.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { OtpService } from './otp.service.js';
import type { TokenService } from './token.service.js';
import type { IndustryRegistryService } from '../industries/industry-registry.service.js';

function build() {
  const prisma = {
    client: {
      member: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({ id: 'm-1' }),
      },
    },
  };
  const tokens = { revokeAllForMember: vi.fn().mockResolvedValue(undefined) };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    {} as unknown as OtpService,
    tokens as unknown as TokenService,
    {} as unknown as IndustryRegistryService,
  );
  return { service, prisma, tokens };
}

describe('AuthService.changePassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets a first password for an OTP-only end-user without asking for the old one', async () => {
    const { service, prisma, tokens } = build();
    prisma.client.member.findFirst.mockResolvedValue({ id: 'm-1', passwordHash: null });

    const result = await service.changePassword('m-1', { newPassword: 'NewPass@123' });

    expect(result.message).toContain('تنظیم شد');
    const [{ data }] = prisma.client.member.update.mock.calls[0] as [
      { data: { passwordHash: string } },
    ];
    expect(data.passwordHash).not.toContain('NewPass@123');
    await expect(verify(data.passwordHash, 'NewPass@123')).resolves.toBe(true);
    expect(tokens.revokeAllForMember).toHaveBeenCalledWith('m-1');
  });

  it('requires the current password when one is already set', async () => {
    const { service, prisma } = build();
    prisma.client.member.findFirst.mockResolvedValue({
      id: 'm-1',
      passwordHash: await hash('OldPass@123'),
    });

    await expect(service.changePassword('m-1', { newPassword: 'NewPass@123' })).rejects.toMatchObject(
      { response: { code: 'CURRENT_PASSWORD_REQUIRED' } },
    );
    expect(prisma.client.member.update).not.toHaveBeenCalled();
  });

  it('rejects a wrong current password', async () => {
    const { service, prisma } = build();
    prisma.client.member.findFirst.mockResolvedValue({
      id: 'm-1',
      passwordHash: await hash('OldPass@123'),
    });

    await expect(
      service.changePassword('m-1', { currentPassword: 'Wrong@1234', newPassword: 'NewPass@123' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_PASSWORD' } });
    expect(prisma.client.member.update).not.toHaveBeenCalled();
  });

  it('refuses to reuse the current password', async () => {
    const { service, prisma } = build();
    prisma.client.member.findFirst.mockResolvedValue({
      id: 'm-1',
      passwordHash: await hash('OldPass@123'),
    });

    await expect(
      service.changePassword('m-1', { currentPassword: 'OldPass@123', newPassword: 'OldPass@123' }),
    ).rejects.toMatchObject({ response: { code: 'SAME_PASSWORD' } });
    expect(prisma.client.member.update).not.toHaveBeenCalled();
  });

  it('rotates the password and kills the old refresh tokens', async () => {
    const { service, prisma, tokens } = build();
    prisma.client.member.findFirst.mockResolvedValue({
      id: 'm-1',
      passwordHash: await hash('OldPass@123'),
    });

    const result = await service.changePassword('m-1', {
      currentPassword: 'OldPass@123',
      newPassword: 'NewPass@123',
    });

    expect(result.message).toContain('تغییر کرد');
    const [{ data }] = prisma.client.member.update.mock.calls[0] as [
      { data: { passwordHash: string } },
    ];
    await expect(verify(data.passwordHash, 'NewPass@123')).resolves.toBe(true);
    expect(tokens.revokeAllForMember).toHaveBeenCalledWith('m-1');
  });

  it('404s for a member that no longer exists', async () => {
    const { service } = build();
    await expect(service.changePassword('ghost', { newPassword: 'NewPass@123' })).rejects.toMatchObject(
      { response: { code: 'NOT_FOUND' } },
    );
  });
});
