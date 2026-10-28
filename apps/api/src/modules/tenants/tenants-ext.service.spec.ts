// TaskForMyAgent — مدیریت بتواند یک کاربر را حذف کند (نقش کاربران پنل باید مجوز داشته باشد)
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TenantsExtService } from './tenants-ext.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { OtpService } from '../auth/otp.service.js';

function build() {
  const prisma = {
    client: {
      member: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue({ id: 'm1', systemRole: 'STAFF' }),
        create: vi.fn().mockImplementation(
          ({ data }: { data: Record<string, unknown> }) => ({
            id: 'm-new',
            fullName: data.fullName,
            phone: data.phone,
            systemRole: data.systemRole,
            isActive: true,
          }),
        ),
        update: vi.fn().mockImplementation(
          ({ data }: { data: Record<string, unknown> }) => ({ id: 'm1', ...data }),
        ),
      },
      role: { upsert: vi.fn().mockResolvedValue({ id: 'role-manager' }) },
    },
  };
  const service = new TenantsExtService(
    prisma as unknown as PrismaService,
    {} as unknown as OtpService,
  );
  return { service, prisma };
}

describe('TenantsExtService.createMember — نقش سیستمی', () => {
  beforeEach(() => vi.clearAllMocks());

  it('links the tenant role of the chosen system role', async () => {
    const { service, prisma } = build();

    await service.createMember('t1', {
      fullName: 'مدیر تست',
      phone: '09127770001',
      systemRole: 'MANAGER',
    });

    // The manager role of this tenant is created from the shared defaults…
    expect(prisma.client.role.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_key: { tenantId: 't1', key: 'manager' } },
        create: expect.objectContaining({
          key: 'manager',
          isSystem: true,
          permissions: ['*'],
        }),
      }),
    );
    // …so the new member really carries the permissions (crm:write → حذف مشتری).
    expect(prisma.client.member.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleId: 'role-manager', systemRole: 'MANAGER' }),
      }),
    );
  });

  it('keeps the coach out of crm:write', async () => {
    const { service, prisma } = build();

    await service.createMember('t1', { fullName: 'مربی تست', systemRole: 'STAFF' });

    const [{ create }] = prisma.client.role.upsert.mock.calls[0] as [
      { create: { permissions: string[] } },
    ];
    expect(create.permissions).not.toContain('crm:write');
    expect(create.permissions).toContain('att:write');
  });

  it('prefers an explicitly chosen role row over the system default', async () => {
    const { service, prisma } = build();

    await service.createMember('t1', {
      fullName: 'کاربر با نقش سفارشی',
      systemRole: 'STAFF',
      roleId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });

    expect(prisma.client.role.upsert).not.toHaveBeenCalled();
    expect(prisma.client.member.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }),
      }),
    );
  });

  it('refuses a duplicated phone inside the same business', async () => {
    const { service, prisma } = build();
    prisma.client.member.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.createMember('t1', { fullName: 'تکراری', phone: '09127770001', systemRole: 'STAFF' }),
    ).rejects.toMatchObject({ message: expect.stringContaining('وجود دارد') });
    expect(prisma.client.member.create).not.toHaveBeenCalled();
  });
});

describe('TenantsExtService.updateMember — تغییر نقش', () => {
  beforeEach(() => vi.clearAllMocks());

  it('moves the permissions when only the system role changes', async () => {
    const { service, prisma } = build();

    await service.updateMember('t1', 'm1', { systemRole: 'MANAGER' });

    expect(prisma.client.role.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId_key: { tenantId: 't1', key: 'manager' } } }),
    );
    expect(prisma.client.member.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { roleId: 'role-manager', systemRole: 'MANAGER' },
    });
  });

  it('leaves the role row alone when neither role field is sent', async () => {
    const { service, prisma } = build();

    await service.updateMember('t1', 'm1', { fullName: 'نام تازه' });

    expect(prisma.client.role.upsert).not.toHaveBeenCalled();
    expect(prisma.client.member.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { fullName: 'نام تازه' },
    });
  });
});
