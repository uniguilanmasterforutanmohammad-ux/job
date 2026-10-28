import { Injectable } from '@nestjs/common';
import { hash } from 'argon2';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { PlatformMemberStatus, PlatformRole } from '@repo/db';
import { AdminAuditService, type AuditContext } from './admin-audit.service.js';
import type { PlatformPrincipal } from './admin.constants.js';
import { PlatformTokenService } from './platform-token.service.js';
import type {
  AdminCreatePlatformMemberDto,
  AdminUpdatePlatformMemberDto,
} from './dto/admin.schemas.js';

const TEAM_SELECT = {
  id: true,
  phone: true,
  fullName: true,
  email: true,
  role: true,
  status: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

/** CRUD for platform console operators (بنل ادمین کل). */
@Injectable()
export class AdminTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly tokens: PlatformTokenService,
  ) {}

  async list(dto: { page: number; pageSize: number; search?: string }) {
    const where = {
      deletedAt: null,
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
      this.prisma.client.platformMember.findMany({
        where,
        ...toSkipTake(dto),
        orderBy: { createdAt: 'asc' },
        select: TEAM_SELECT,
      }),
      this.prisma.client.platformMember.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  async create(
    actor: PlatformPrincipal,
    dto: AdminCreatePlatformMemberDto,
    context: AuditContext = {},
  ) {
    const clash = await this.prisma.client.platformMember.findUnique({
      where: { phone: dto.phone },
      select: { id: true },
    });
    if (clash) throw DomainException.conflict('مدیری با این شماره موبایل از قبل وجود دارد');

    const member = await this.prisma.client.platformMember.create({
      data: {
        phone: dto.phone,
        fullName: dto.fullName,
        email: dto.email ?? null,
        role: dto.role as PlatformRole,
        passwordHash: await hash(dto.password),
      },
      select: TEAM_SELECT,
    });

    await this.audit.record(
      actor,
      {
        action: 'platform_member.create',
        entity: 'platform_member',
        entityId: member.id,
        after: { phone: dto.phone, fullName: dto.fullName, role: dto.role },
      },
      context,
    );
    return member;
  }

  async update(
    actor: PlatformPrincipal,
    memberId: string,
    dto: AdminUpdatePlatformMemberDto,
    context: AuditContext = {},
  ) {
    const before = await this.prisma.client.platformMember.findUnique({
      where: { id: memberId },
      select: TEAM_SELECT,
    });
    if (!before) throw DomainException.notFound('حساب مدیریتی');
    this.assertNotSelfDemotion(actor, memberId, dto);

    const member = await this.prisma.client.platformMember.update({
      where: { id: memberId },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.role !== undefined ? { role: dto.role as PlatformRole } : {}),
        ...(dto.status !== undefined ? { status: dto.status as PlatformMemberStatus } : {}),
        // A SUPER_ADMIN may force-reset another operator's 2FA (lost device).
        ...(dto.twoFactorEnabled === false
          ? {
              twoFactorEnabled: false,
              twoFactorSecret: null,
              twoFactorPendingSecret: null,
              twoFactorConfirmedAt: null,
              twoFactorLastTimeStep: null,
            }
          : {}),
      },
      select: TEAM_SELECT,
    });

    // Suspending an operator must revoke their live sessions immediately.
    if (dto.status === 'SUSPENDED') {
      await this.tokens.revokeAllFor(memberId);
    }

    await this.audit.record(
      actor,
      {
        action: 'platform_member.update',
        entity: 'platform_member',
        entityId: memberId,
        before,
        after: dto,
      },
      context,
    );
    return member;
  }

  async remove(actor: PlatformPrincipal, memberId: string, context: AuditContext = {}) {
    if (actor.platformMemberId === memberId) {
      throw DomainException.badRequest('نمی‌توانید حساب خودتان را حذف کنید');
    }
    const before = await this.prisma.client.platformMember.findUnique({
      where: { id: memberId },
      select: TEAM_SELECT,
    });
    if (!before) throw DomainException.notFound('حساب مدیریتی');

    const remainingSuperAdmins = await this.prisma.client.platformMember.count({
      where: { role: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null, id: { not: memberId } },
    });
    if (before.role === 'SUPER_ADMIN' && remainingSuperAdmins === 0) {
      throw DomainException.conflict('باید حداقل یک مدیر ارشد فعال باقی بماند');
    }

    const member = await this.prisma.client.platformMember.update({
      where: { id: memberId },
      data: { deletedAt: new Date(), status: 'SUSPENDED' },
      select: TEAM_SELECT,
    });
    await this.tokens.revokeAllFor(memberId);

    await this.audit.record(
      actor,
      {
        action: 'platform_member.remove',
        entity: 'platform_member',
        entityId: memberId,
        before,
      },
      context,
    );
    return member;
  }

  async revokeSessions(
    actor: PlatformPrincipal,
    memberId: string,
    context: AuditContext = {},
  ) {
    await this.tokens.revokeAllFor(memberId);
    await this.audit.record(
      actor,
      { action: 'platform_member.revoke_sessions', entity: 'platform_member', entityId: memberId },
      context,
    );
    return { message: 'نشست‌های مدیر بسته شد' };
  }

  private assertNotSelfDemotion(
    actor: PlatformPrincipal,
    memberId: string,
    dto: AdminUpdatePlatformMemberDto,
  ): void {
    if (actor.platformMemberId !== memberId) return;
    if (dto.status && dto.status !== 'ACTIVE') {
      throw DomainException.badRequest('نمی‌توانید حساب خودتان را غیرفعال کنید');
    }
    if (dto.role && dto.role !== 'SUPER_ADMIN') {
      throw DomainException.badRequest('نمی‌توانید نقش خودتان را کاهش دهید');
    }
    if (dto.twoFactorEnabled === false) {
      throw DomainException.badRequest(
        'برای غیرفعال‌سازی ۲FA خود از صفحه «حساب من» و با تأیید کد استفاده کنید',
      );
    }
  }
}
