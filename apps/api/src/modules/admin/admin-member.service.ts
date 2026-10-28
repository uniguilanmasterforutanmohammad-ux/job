import { Injectable, Logger } from '@nestjs/common';
import { hash } from 'argon2';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { SystemRole } from '@repo/db';
import { AdminAuditService, type AuditContext } from './admin-audit.service.js';
import type { PlatformPrincipal } from './admin.constants.js';
import type {
  AdminListMembersDto,
  AdminMemberStatusDto,
  AdminResetPasswordDto,
  AdminUpdateMemberDto,
} from './dto/admin.schemas.js';

const MEMBER_SELECT = {
  id: true,
  tenantId: true,
  branchId: true,
  roleId: true,
  systemRole: true,
  fullName: true,
  phone: true,
  email: true,
  avatarUrl: true,
  isActive: true,
  phoneVerified: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  deletedAt: true,
  role: { select: { id: true, key: true, name: true } },
  branch: { select: { id: true, name: true, code: true } },
} as const;

@Injectable()
export class AdminMemberService {
  private readonly logger = new Logger(AdminMemberService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(tenantId: string, dto: AdminListMembersDto) {
    await this.assertTenant(tenantId);
    const where = {
      tenantId,
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.systemRole ? { systemRole: dto.systemRole as SystemRole } : {}),
      ...(dto.search
        ? {
            OR: [
              { fullName: { contains: dto.search, mode: 'insensitive' as const } },
              { phone: { contains: dto.search } },
              { email: { contains: dto.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.member.findMany({
        where,
        ...toSkipTake(dto),
        orderBy: { createdAt: 'desc' },
        select: MEMBER_SELECT,
      }),
      this.prisma.client.member.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  async getOne(tenantId: string, memberId: string) {
    const member = await this.prisma.client.member.findFirst({
      where: { id: memberId, tenantId },
      select: { ...MEMBER_SELECT, meta: true, notificationPrefs: true },
    });
    if (!member) throw DomainException.notFound('کاربر کسب‌وکار');
    return member;
  }

  async update(
    actor: PlatformPrincipal,
    tenantId: string,
    memberId: string,
    dto: AdminUpdateMemberDto,
    context: AuditContext = {},
  ) {
    const before = await this.prisma.client.member.findFirst({
      where: { id: memberId, tenantId },
    });
    if (!before) throw DomainException.notFound('کاربر کسب‌وکار');

    // Guard referential integrity of optional relations.
    if (dto.branchId) await this.assertBranch(tenantId, dto.branchId);
    if (dto.roleId) await this.assertRole(tenantId, dto.roleId);

    // Changing the phone must not collide inside the tenant.
    if (dto.phone && dto.phone !== before.phone) {
      const clash = await this.prisma.client.member.findFirst({
        where: { tenantId, phone: dto.phone, id: { not: memberId } },
        select: { id: true },
      });
      if (clash) throw DomainException.conflict('کاربری با این شماره در این کسب‌وکار وجود دارد');
    }

    const updated = await this.prisma.client.member.update({
      where: { id: memberId },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.systemRole !== undefined ? { systemRole: dto.systemRole as SystemRole } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.twoFactorEnabled !== undefined
          ? { twoFactorEnabled: dto.twoFactorEnabled }
          : {}),
      },
      select: MEMBER_SELECT,
    });

    // Deactivating a member must immediately kill their sessions.
    if (dto.isActive === false) {
      await this.prisma.client.session.updateMany({
        where: { memberId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.record(
      actor,
      {
        action: 'member.update',
        entity: 'member',
        entityId: memberId,
        tenantId,
        before: {
          fullName: before.fullName,
          phone: before.phone,
          systemRole: before.systemRole,
          roleId: before.roleId,
          branchId: before.branchId,
          isActive: before.isActive,
        },
        after: dto,
      },
      context,
    );
    return updated;
  }

  async setActive(
    actor: PlatformPrincipal,
    tenantId: string,
    memberId: string,
    dto: AdminMemberStatusDto,
    context: AuditContext = {},
  ) {
    const before = await this.prisma.client.member.findFirst({
      where: { id: memberId, tenantId },
      select: { id: true, isActive: true, fullName: true },
    });
    if (!before) throw DomainException.notFound('کاربر کسب‌وکار');

    const updated = await this.prisma.client.member.update({
      where: { id: memberId },
      data: { isActive: dto.isActive },
      select: MEMBER_SELECT,
    });

    if (!dto.isActive) {
      await this.prisma.client.session.updateMany({
        where: { memberId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.record(
      actor,
      {
        action: dto.isActive ? 'member.activate' : 'member.deactivate',
        entity: 'member',
        entityId: memberId,
        tenantId,
        before: { isActive: before.isActive },
        after: { isActive: dto.isActive, reason: dto.reason ?? null },
      },
      context,
    );
    return updated;
  }

  async resetPassword(
    actor: PlatformPrincipal,
    tenantId: string,
    memberId: string,
    dto: AdminResetPasswordDto,
    context: AuditContext = {},
  ) {
    const member = await this.prisma.client.member.findFirst({
      where: { id: memberId, tenantId },
      select: { id: true, fullName: true },
    });
    if (!member) throw DomainException.notFound('کاربر کسب‌وکار');

    await this.prisma.client.member.update({
      where: { id: memberId },
      data: { passwordHash: await hash(dto.password) },
    });
    await this.prisma.client.session.updateMany({
      where: { memberId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.record(
      actor,
      {
        action: 'member.reset_password',
        entity: 'member',
        entityId: memberId,
        tenantId,
        after: { passwordHash: '[redacted]' },
      },
      context,
    );
    this.logger.log(`Admin reset password tenant=${tenantId} member=${memberId}`);
    return { message: 'رمز عبور بازنشانی شد و نشست‌های فعال بسته شدند' };
  }

  /** Revokes every active session for a member (force logout). */
  async revokeSessions(
    actor: PlatformPrincipal,
    tenantId: string,
    memberId: string,
    context: AuditContext = {},
  ) {
    const member = await this.prisma.client.member.findFirst({
      where: { id: memberId, tenantId },
      select: { id: true },
    });
    if (!member) throw DomainException.notFound('کاربر کسب‌وکار');

    const result = await this.prisma.client.session.updateMany({
      where: { memberId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.record(
      actor,
      {
        action: 'member.revoke_sessions',
        entity: 'member',
        entityId: memberId,
        tenantId,
        after: { revoked: result.count },
      },
      context,
    );
    return { revoked: result.count };
  }

  private async assertTenant(tenantId: string): Promise<void> {
    const found = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!found) throw DomainException.notFound('کسب‌وکار');
  }

  private async assertBranch(tenantId: string, branchId: string): Promise<void> {
    const found = await this.prisma.client.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!found) throw DomainException.notFound('شعبه');
  }

  private async assertRole(tenantId: string, roleId: string): Promise<void> {
    const found = await this.prisma.client.role.findFirst({
      where: { id: roleId, tenantId },
      select: { id: true },
    });
    if (!found) throw DomainException.notFound('نقش');
  }
}
