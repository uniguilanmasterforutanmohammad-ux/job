import { Injectable, Logger } from '@nestjs/common';
import { hash, verify } from 'argon2';
import type { AuthenticatedUser } from '@repo/shared';
import { resolveModuleDependencies } from '@repo/shared';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { uniqueTenantSlug } from '../../common/utils/slug.js';
import { PrismaService } from '../../database/prisma.service.js';
import { IndustryRegistryService } from '../industries/industry-registry.service.js';
import { OtpService } from './otp.service.js';
import { TokenService, type TokenPair } from './token.service.js';
import type {
  PasswordLoginDto,
  RegisterTenantDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/auth.schemas.js';

export type LoginResult = {
  tokens: TokenPair;
  user: AuthenticatedUser & { tenantName: string; tenantSlug: string };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly industries: IndustryRegistryService,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    await this.otp.request(dto.phone, dto.purpose);
    return { message: 'کد یکبار مصرف ارسال شد' };
  }

  /** Mobile OTP login (CORE-01, APP-01). */
  async verifyOtpLogin(
    dto: VerifyOtpDto,
    context: { userAgent?: string; ip?: string },
  ): Promise<LoginResult> {
    await this.otp.verify(dto.phone, dto.code, 'LOGIN');
    const member = await this.findMemberForLogin(dto.phone, dto.tenantSlug);

    const user = await this.buildAuthenticatedUser(member.id);

    await this.prisma.client.member.update({
      where: { id: member.id },
      data: { phoneVerified: true, lastLoginAt: new Date() },
    });

    const tokens = await this.tokens.issue(user, context);
    return { tokens, user: { ...user, tenantName: member.tenant.name, tenantSlug: member.tenant.slug } };
  }

  async passwordLogin(
    dto: PasswordLoginDto,
    context: { userAgent?: string; ip?: string },
  ): Promise<LoginResult> {
    const member = await this.findMemberForLogin(dto.phone, dto.tenantSlug);
    if (!member.passwordHash) {
      throw DomainException.badRequest('برای این شماره رمز عبور تنظیم نشده است', 'NO_PASSWORD');
    }
    const ok = await verify(member.passwordHash, dto.password);
    if (!ok) throw DomainException.badRequest('رمز عبور نادرست است', 'INVALID_PASSWORD');

    const user = await this.buildAuthenticatedUser(member.id);
    await this.prisma.client.member.update({
      where: { id: member.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.tokens.issue(user, context);
    return { tokens, user: { ...user, tenantName: member.tenant.name, tenantSlug: member.tenant.slug } };
  }

  /**
   * Self-service tenant onboarding (PRD §2 فعال‌سازی). Creates the tenant,
   * owner, default roles/branch and enables the industry's default modules
   * with their dependencies resolved.
   */
  async registerTenant(dto: RegisterTenantDto, context: { userAgent?: string; ip?: string }) {
    await this.otp.verify(dto.phone, dto.otpCode, 'LOGIN');

    // The platform admin can close registration per industry from /admin.
    await this.industries.assertRegistrationEnabled(dto.industry);

    const slug = await this.uniqueSlug(dto.businessName);

    // Defaults come from the editable registry, not the static PRD map.
    const modules = resolveModuleDependencies(await this.industries.defaultModules(dto.industry));

    const result = await this.prisma.client.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name: dto.businessName,
          industry: (dto.industry as never) ?? 'SPORTS_COACHING',
          phone: dto.phone,
          email: dto.email,
        },
      });

      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          key: 'owner',
          name: 'مالک',
          isSystem: true,
          permissions: ['*'],
        },
      });

      const branch = await tx.branch.create({
        data: { tenantId: tenant.id, code: 'MAIN', name: 'شعبه مرکزی' },
      });

      const owner = await tx.member.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          roleId: ownerRole.id,
          systemRole: 'OWNER',
          fullName: dto.ownerName,
          phone: dto.phone,
          email: dto.email,
          passwordHash: await hash(dto.password),
          phoneVerified: true,
        },
      });

      await tx.tenantModule.createMany({
        data: modules.map((key) => ({ tenantId: tenant.id, key, isEnabled: true })),
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          status: 'TRIAL',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          seats: 3,
        },
      });

      return { tenant, owner };
    });

    const user = await this.buildAuthenticatedUser(result.owner.id);
    const tokens = await this.tokens.issue(user, context);

    this.logger.log(`Tenant registered: ${result.tenant.slug}`);

    return {
      tokens,
      user: { ...user, tenantName: result.tenant.name, tenantSlug: result.tenant.slug },
      enabledModules: modules,
    };
  }

  async refresh(refreshToken: string, user: AuthenticatedUser): Promise<TokenPair> {
    const tokens = await this.tokens.rotate(refreshToken, user);
    if (!tokens) throw DomainException.forbidden('نشست منقضی شده است. دوباره وارد شوید.');
    return tokens;
  }

  async logout(refreshToken?: string): Promise<{ message: string }> {
    if (refreshToken) await this.tokens.revoke(refreshToken);
    return { message: 'خروج انجام شد' };
  }

  async me(memberId: string) {
    const member = await this.prisma.client.member.findUnique({
      where: { id: memberId },
      include: { tenant: true, role: true, branch: true },
    });
    if (!member) throw DomainException.notFound('کاربر');

    const modules = await this.prisma.client.tenantModule.findMany({
      where: { tenantId: member.tenantId, isEnabled: true },
      select: { key: true },
    });

    return {
      member: {
        id: member.id,
        fullName: member.fullName,
        phone: member.phone,
        email: member.email,
        systemRole: member.systemRole,
        avatarUrl: member.avatarUrl,
      },
      tenant: {
        id: member.tenant.id,
        name: member.tenant.name,
        slug: member.tenant.slug,
        industry: member.tenant.industry,
        currency: member.tenant.currency,
        calendar: member.tenant.calendar,
        locale: member.tenant.locale,
      },
      branch: member.branch
        ? { id: member.branch.id, name: member.branch.name }
        : null,
      role: member.role
        ? { key: member.role.key, name: member.role.name, permissions: member.role.permissions }
        : null,
      enabledModules: modules.map((m) => m.key),
    };
  }

  private async buildAuthenticatedUser(memberId: string): Promise<AuthenticatedUser> {
    const member = await this.prisma.client.member.findUnique({
      where: { id: memberId },
      include: { role: true, tenant: true },
    });
    if (!member || !member.isActive) throw DomainException.forbidden('حساب کاربری فعال نیست');

    return {
      memberId: member.id,
      tenantId: member.tenantId,
      branchId: member.branchId,
      systemRole: member.systemRole,
      permissions: member.role?.permissions ?? [],
      fullName: member.fullName,
      phone: member.phone,
    };
  }

  private async findMemberForLogin(phone: string, tenantSlug?: string) {
    const member = await this.prisma.client.member.findFirst({
      where: {
        phone,
        deletedAt: null,
        ...(tenantSlug ? { tenant: { slug: tenantSlug } } : {}),
      },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!member) {
      throw DomainException.notFound(
        tenantSlug ? 'کاربری با این شماره در این کسب‌وکار یافت نشد' : 'کاربری با این شماره یافت نشد',
      );
    }
    if (!member.isActive) throw DomainException.forbidden('حساب کاربری غیرفعال است');
    return member;
  }

  private async uniqueSlug(businessName: string): Promise<string> {
    return uniqueTenantSlug(businessName, async (slug) => {
      const found = await this.prisma.client.tenant.findUnique({ where: { slug } });
      return Boolean(found);
    });
  }
}
