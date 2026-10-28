import { Injectable, Logger } from '@nestjs/common';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { OtpService, maskPhone } from '../auth/otp.service.js';
import type {
  CreateBackupDto,
  CreateMemberDto,
  CreateRoleDto,
  DisableTwoFactorDto,
  EnableTwoFactorDto,
  NotificationPrefsDto,
  UpdateMemberDto,
} from './dto/tenant-ext.schemas.js';

@Injectable()
export class TenantsExtService {
  private readonly logger = new Logger(TenantsExtService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
  ) {}

  // ----- CORE-08 notifications -----

  async getNotificationPrefs(tenantId: string, memberId: string) {
    const member = await this.prisma.client.member.findFirst({
      where: { id: memberId, tenantId },
    });
    if (!member) throw DomainException.notFound('کاربر');
    return (member.notificationPrefs ?? {}) as Record<string, unknown>;
  }

  async setNotificationPrefs(tenantId: string, memberId: string, dto: NotificationPrefsDto) {
    const member = await this.prisma.client.member.findFirst({ where: { id: memberId, tenantId } });
    if (!member) throw DomainException.notFound('کاربر');
    return this.prisma.client.member.update({
      where: { id: memberId },
      data: { notificationPrefs: dto.events as never },
    });
  }

  /** CORE-08 — resolve enabled channels for an event, with sane defaults. */
  async resolveChannels(tenantId: string, memberId: string, event: string): Promise<string[]> {
    const member = await this.prisma.client.member.findFirst({
      where: { id: memberId, tenantId },
      select: { notificationPrefs: true },
    });
    const prefs = (member?.notificationPrefs ?? {}) as Record<string, string[]>;
    return prefs[event] ?? ['IN_APP'];
  }

  // ----- CORE-01 two-factor -----

  async enableTwoFactor(tenantId: string, memberId: string, dto: EnableTwoFactorDto) {
    const member = await this.prisma.client.member.findFirst({ where: { id: memberId, tenantId } });
    if (!member) throw DomainException.notFound('کاربر');
    const secret = dto.secret ?? `TOTP-${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
    const updated = await this.prisma.client.member.update({
      where: { id: memberId },
      data: { twoFactorEnabled: true, twoFactorSecret: secret },
    });
    this.logger.log(`2FA enabled tenant=${tenantId} member=${memberId}`);
    return { enabled: true, secret: updated.twoFactorSecret };
  }

  async disableTwoFactor(tenantId: string, memberId: string, dto: DisableTwoFactorDto) {
    const member = await this.prisma.client.member.findFirst({ where: { id: memberId, tenantId } });
    if (!member) throw DomainException.notFound('کاربر');
    if (!member.phone) throw DomainException.badRequest('برای غیرفعال‌سازی ۲FA شماره موبایل لازم است');
    await this.otp.verify(member.phone, dto.code, 'TWO_FACTOR');
    await this.prisma.client.member.update({
      where: { id: memberId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { enabled: false };
  }

  /** Sends a TWO_FACTOR OTP to the member's own phone. */
  async challengeTwoFactor(tenantId: string, memberId: string) {
    const member = await this.prisma.client.member.findFirst({ where: { id: memberId, tenantId } });
    if (!member?.phone) throw DomainException.badRequest('شماره موبایل ثبت نشده است');
    const result = await this.otp.request(member.phone, 'TWO_FACTOR');
    return { ...result, phone: maskPhone(member.phone) };
  }

  // ----- CORE-06 backups -----

  async createBackup(tenantId: string, dto: CreateBackupDto) {
    // Metadata-only record; payload generation is handled by the ops worker.
    const record = await this.prisma.client.backupRecord.create({
      data: {
        tenantId,
        kind: dto.kind,
        status: 'COMPLETED',
        location: `backups/${tenantId}/${new Date().toISOString()}.dump`,
        note: dto.note ?? null,
      },
    });
    this.logger.log(`Backup recorded tenant=${tenantId} kind=${dto.kind}`);
    return record;
  }

  async listBackups(tenantId: string, page = 1, pageSize = 20) {
    const where = { tenantId };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.backupRecord.findMany({
        where,
        ...toSkipTake({ page, pageSize }),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.backupRecord.count({ where }),
    ]);
    return { data, meta: buildMeta(total, { page, pageSize }) };
  }

  /** CORE-06 — prune records older than the 30-day retention window. */
  async pruneBackups(tenantId: string) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.client.backupRecord.deleteMany({
      where: { tenantId, createdAt: { lt: cutoff } },
    });
    return { pruned: result.count };
  }

  // ----- CORE-03 members -----

  async createMember(tenantId: string, dto: CreateMemberDto) {
    if (dto.phone) {
      const existing = await this.prisma.client.member.findUnique({
        where: { tenantId_phone: { tenantId, phone: dto.phone } },
      });
      if (existing) throw DomainException.conflict('کاربری با این شماره در این کسب‌وکار وجود دارد');
    }
    return this.prisma.client.member.create({
      data: {
        tenantId,
        fullName: dto.fullName,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        branchId: dto.branchId ?? null,
        roleId: dto.roleId ?? null,
        systemRole: dto.systemRole,
      },
      select: { id: true, fullName: true, phone: true, systemRole: true, isActive: true },
    });
  }

  async listMembers(tenantId: string, page = 1, pageSize = 20) {
    const where = { tenantId, deletedAt: null };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.member.findMany({
        where,
        ...toSkipTake({ page, pageSize }),
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          systemRole: true,
          isActive: true,
          twoFactorEnabled: true,
          lastLoginAt: true,
          role: { select: { id: true, key: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.member.count({ where }),
    ]);
    return { data, meta: buildMeta(total, { page, pageSize }) };
  }

  async updateMember(tenantId: string, memberId: string, dto: UpdateMemberDto) {
    const member = await this.prisma.client.member.findFirst({ where: { id: memberId, tenantId } });
    if (!member) throw DomainException.notFound('کاربر');
    return this.prisma.client.member.update({
      where: { id: memberId },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
        ...(dto.systemRole !== undefined ? { systemRole: dto.systemRole } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async removeMember(tenantId: string, memberId: string) {
    const member = await this.prisma.client.member.findFirst({ where: { id: memberId, tenantId } });
    if (!member) throw DomainException.notFound('کاربر');
    if (member.systemRole === 'OWNER') throw DomainException.forbidden('مالک قابل حذف نیست');
    await this.prisma.client.member.update({ where: { id: memberId }, data: { deletedAt: new Date(), isActive: false } });
    return { message: 'کاربر حذف شد' };
  }

  // ----- CORE-03 roles -----

  async createRole(tenantId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.client.role.findUnique({
      where: { tenantId_key: { tenantId, key: dto.key } },
    });
    if (existing) throw DomainException.conflict('نقشی با این کلید وجود دارد');
    return this.prisma.client.role.create({
      data: {
        tenantId,
        key: dto.key,
        name: dto.name,
        permissions: dto.permissions,
      },
    });
  }

  listRoles(tenantId: string) {
    return this.prisma.client.role.findMany({
      where: { tenantId },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateRole(tenantId: string, roleId: string, dto: Partial<CreateRoleDto>) {
    const role = await this.prisma.client.role.findFirst({ where: { id: roleId, tenantId } });
    if (!role) throw DomainException.notFound('نقش');
    if (role.isSystem) throw DomainException.forbidden('نقش سیستمی قابل ویرایش نیست');
    return this.prisma.client.role.update({
      where: { id: roleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.permissions !== undefined ? { permissions: dto.permissions } : {}),
      },
    });
  }

  async removeRole(tenantId: string, roleId: string) {
    const role = await this.prisma.client.role.findFirst({ where: { id: roleId, tenantId } });
    if (!role) throw DomainException.notFound('نقش');
    if (role.isSystem) throw DomainException.forbidden('نقش سیستمی قابل حذف نیست');
    const inUse = await this.prisma.client.member.count({ where: { roleId } });
    if (inUse > 0) throw DomainException.conflict('این نقش به کاربرانی تخصیص داده شده است');
    await this.prisma.client.role.delete({ where: { id: roleId } });
    return { message: 'نقش حذف شد' };
  }
}
