import { Injectable, Logger } from '@nestjs/common';
import { hash, verify } from 'argon2';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { OtpService, maskPhone } from '../auth/otp.service.js';
import { TotpService } from '../auth/totp.service.js';
import { toDataURL } from 'qrcode';
import {
  type PlatformPrincipal,
  type PlatformRoleValue,
} from './admin.constants.js';
import { AdminAuditService } from './admin-audit.service.js';
import { PlatformTokenService, type PlatformTokenPair } from './platform-token.service.js';
import type {
  PlatformOtpRequestDto,
  PlatformOtpVerifyDto,
  PlatformPasswordLoginDto,
  PlatformTotpCodeDto,
  PlatformTwoFactorVerifyDto,
} from './dto/admin.schemas.js';

export type PlatformLoginResult = {
  tokens: PlatformTokenPair;
  operator: PlatformPrincipal | null;
  /** Present and true when a second factor must be completed before tokens. */
  twoFactorRequired?: boolean;
  challengeToken?: string;
};

export type TwoFactorSetupResult = {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
};

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: PlatformTokenService,
    private readonly audit: AdminAuditService,
    private readonly totp: TotpService,
  ) {}

  /** Sends an OTP to a *known* platform operator phone only (no enumeration). */
  async requestOtp(dto: PlatformOtpRequestDto) {
    const operator = await this.prisma.client.platformMember.findFirst({
      where: { phone: dto.phone, deletedAt: null, status: 'ACTIVE' },
    });
    // Always respond success to avoid leaking which phones are operators.
    if (operator) {
      await this.otp.request(dto.phone, 'LOGIN');
    }
    return { message: 'در صورت وجود حساب مدیریتی، کد ارسال شد' };
  }

  async verifyOtpLogin(
    dto: PlatformOtpVerifyDto,
    context: { userAgent?: string; ip?: string } = {},
  ): Promise<PlatformLoginResult> {
    const operator = await this.requireOperator(dto.phone);
    await this.otp.verify(dto.phone, dto.code, 'LOGIN');
    return this.completeLogin(operator, context, 'platform.otp_login');
  }

  async passwordLogin(
    dto: PlatformPasswordLoginDto,
    context: { userAgent?: string; ip?: string } = {},
  ): Promise<PlatformLoginResult> {
    const operator = await this.requireOperator(dto.phone);
    if (!operator.passwordHash) {
      throw DomainException.badRequest('برای این حساب رمز عبور تنظیم نشده است', 'NO_PASSWORD');
    }
    const ok = await verify(operator.passwordHash, dto.password);
    if (!ok) {
      await this.audit.record(
        null,
        { action: 'platform.login_failed', entity: 'platform_member', entityId: operator.id },
        context,
      );
      throw DomainException.badRequest('رمز عبور نادرست است', 'INVALID_PASSWORD');
    }
    return this.completeLogin(operator, context, 'platform.password_login');
  }

  async refresh(
    refreshToken: string,
    principal: PlatformPrincipal,
  ): Promise<PlatformTokenPair> {
    const tokens = await this.tokens.rotate(refreshToken, principal);
    if (!tokens) throw DomainException.forbidden('نشست منقضی شده است. دوباره وارد شوید.');
    return tokens;
  }

  async logout(refreshToken?: string): Promise<{ message: string }> {
    if (refreshToken) await this.tokens.revoke(refreshToken);
    return { message: 'خروج انجام شد' };
  }

  async me(platformMemberId: string): Promise<PlatformPrincipal> {
    const operator = await this.prisma.client.platformMember.findUnique({
      where: { id: platformMemberId },
    });
    if (!operator) throw DomainException.notFound('حساب مدیریتی');
    return this.toPrincipal(operator);
  }

  /** Profile + 2FA status for the "my account" screen. */
  async account(platformMemberId: string) {
    const operator = await this.prisma.client.platformMember.findUnique({
      where: { id: platformMemberId },
      select: {
        id: true,
        phone: true,
        fullName: true,
        email: true,
        role: true,
        twoFactorEnabled: true,
        twoFactorConfirmedAt: true,
      },
    });
    if (!operator) throw DomainException.notFound('حساب مدیریتی');
    return {
      ...this.toPrincipal(operator),
      email: operator.email,
      twoFactorEnabled: operator.twoFactorEnabled,
      twoFactorConfirmedAt: operator.twoFactorConfirmedAt,
    };
  }

  // ----- 2FA (TOTP) -----

  /** Starts enrolment: returns a secret + otpauth URL. Not active until confirmed. */
  async beginTwoFactor(platformMemberId: string): Promise<TwoFactorSetupResult> {
    const operator = await this.prisma.client.platformMember.findUnique({
      where: { id: platformMemberId },
      select: { id: true, phone: true, twoFactorEnabled: true },
    });
    if (!operator) throw DomainException.notFound('حساب مدیریتی');
    if (operator.twoFactorEnabled) {
      throw DomainException.conflict('ورود دو مرحله‌ای از قبل فعال است');
    }

    const enrollment = this.totp.beginEnrollment(operator.phone);
    const qrDataUrl = await toDataURL(enrollment.otpauthUrl, { width: 220, margin: 1 });
    await this.prisma.client.platformMember.update({
      where: { id: platformMemberId },
      data: { twoFactorPendingSecret: enrollment.secret },
    });
    return { ...enrollment, qrDataUrl };
  }

  /** Confirms enrolment by verifying one code against the pending secret. */
  async confirmTwoFactor(
    platformMemberId: string,
    dto: PlatformTotpCodeDto,
    context: { userAgent?: string; ip?: string } = {},
  ) {
    const operator = await this.prisma.client.platformMember.findUnique({
      where: { id: platformMemberId },
    });
    if (!operator) throw DomainException.notFound('حساب مدیریتی');
    if (!operator.twoFactorPendingSecret) {
      throw DomainException.badRequest('ابتدا فرآیند فعال‌سازی ۲FA را شروع کنید');
    }

    const result = this.totp.verify(operator.twoFactorPendingSecret, dto.code);
    if (!result.valid) {
      throw DomainException.badRequest('کد ۲FA نامعتبر یا منقضی است', 'TOTP_INVALID');
    }

    await this.prisma.client.platformMember.update({
      where: { id: platformMemberId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: operator.twoFactorPendingSecret,
        twoFactorPendingSecret: null,
        twoFactorConfirmedAt: new Date(),
        twoFactorLastTimeStep: BigInt(result.timeStep),
      },
    });

    const principal = this.toPrincipal(operator);
    await this.audit.record(
      principal,
      { action: 'platform.2fa_enabled', entity: 'platform_member', entityId: operator.id },
      context,
    );
    return { twoFactorEnabled: true };
  }

  /** Disables 2FA. Requires a current TOTP code (or password when no 2FA). */
  async disableTwoFactor(
    platformMemberId: string,
    dto: PlatformTotpCodeDto,
    context: { userAgent?: string; ip?: string } = {},
  ) {
    const operator = await this.prisma.client.platformMember.findUnique({
      where: { id: platformMemberId },
    });
    if (!operator) throw DomainException.notFound('حساب مدیریتی');
    if (!operator.twoFactorEnabled || !operator.twoFactorSecret) {
      throw DomainException.badRequest('ورود دو مرحله‌ای فعال نیست');
    }

    const result = this.totp.verify(operator.twoFactorSecret, dto.code, {
      afterTimeStep: operator.twoFactorLastTimeStep,
    });
    if (!result.valid) {
      throw DomainException.badRequest('کد ۲FA نامعتبر یا منقضی است', 'TOTP_INVALID');
    }

    await this.prisma.client.platformMember.update({
      where: { id: platformMemberId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
        twoFactorConfirmedAt: null,
        twoFactorLastTimeStep: null,
      },
    });

    const principal = this.toPrincipal(operator);
    await this.audit.record(
      principal,
      { action: 'platform.2fa_disabled', entity: 'platform_member', entityId: operator.id },
      context,
    );
    return { twoFactorEnabled: false };
  }

  /** Second step of a login that returned `twoFactorRequired`. */
  async verifyTwoFactor(
    dto: PlatformTwoFactorVerifyDto,
    context: { userAgent?: string; ip?: string } = {},
  ): Promise<PlatformLoginResult> {
    const platformMemberId = await this.tokens.verifyTwoFactorChallenge(dto.challengeToken);
    if (!platformMemberId) {
      throw DomainException.forbidden('نشست ورود منقضی شده است. دوباره تلاش کنید.');
    }

    const operator = await this.prisma.client.platformMember.findFirst({
      where: { id: platformMemberId, deletedAt: null, status: 'ACTIVE' },
    });
    if (!operator || !operator.twoFactorSecret) {
      throw DomainException.forbidden('ورود دو مرحله‌ای برای این حساب در دسترس نیست');
    }

    const result = this.totp.verify(operator.twoFactorSecret, dto.code, {
      afterTimeStep: operator.twoFactorLastTimeStep,
    });
    if (!result.valid) {
      await this.audit.record(
        null,
        { action: 'platform.2fa_failed', entity: 'platform_member', entityId: operator.id },
        context,
      );
      throw DomainException.badRequest('کد ۲FA نامعتبر یا منقضی است', 'TOTP_INVALID');
    }

    // Persist the accepted step to block replay of the same code.
    await this.prisma.client.platformMember.update({
      where: { id: operator.id },
      data: { twoFactorLastTimeStep: BigInt(result.timeStep) },
    });

    return this.completeLogin(operator, context, 'platform.2fa_login', {
      skipSecondFactor: true,
    });
  }

  async changePassword(
    platformMemberId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const operator = await this.prisma.client.platformMember.findUnique({
      where: { id: platformMemberId },
    });
    if (!operator) throw DomainException.notFound('حساب مدیریتی');
    if (!operator.passwordHash || !(await verify(operator.passwordHash, currentPassword))) {
      throw DomainException.badRequest('رمز عبور فعلی نادرست است', 'INVALID_PASSWORD');
    }
    await this.prisma.client.platformMember.update({
      where: { id: platformMemberId },
      data: { passwordHash: await hash(newPassword) },
    });
    await this.tokens.revokeAllFor(platformMemberId);
    this.logger.log(`Platform password changed member=${platformMemberId}`);
    return { message: 'رمز عبور تغییر کرد؛ دوباره وارد شوید' };
  }

  private async requireOperator(phone: string) {
    const operator = await this.prisma.client.platformMember.findFirst({
      where: { phone, deletedAt: null },
    });
    if (!operator) {
      throw DomainException.forbidden('حساب مدیریتی یافت نشد یا دسترسی ندارد');
    }
    if (operator.status !== 'ACTIVE') {
      throw DomainException.forbidden('حساب مدیریتی شما غیرفعال است');
    }
    return operator;
  }

  private async completeLogin(
    operator: {
      id: string;
      phone: string;
      fullName: string;
      role: string;
      twoFactorEnabled?: boolean;
    },
    context: { userAgent?: string; ip?: string },
    action: string,
    options: { skipSecondFactor?: boolean } = {},
  ): Promise<PlatformLoginResult> {
    const principal = this.toPrincipal(operator);

    // If 2FA is on and the second factor has not yet been satisfied, stop here
    // and hand back an intermediate challenge instead of real tokens.
    if (operator.twoFactorEnabled && !options.skipSecondFactor) {
      const challenge = await this.tokens.issueTwoFactorChallenge(principal);
      this.logger.log(`Platform 2FA challenge issued phone=${maskPhone(operator.phone)}`);
      return {
        tokens: { accessToken: '', refreshToken: '', expiresIn: 0 },
        operator: null,
        twoFactorRequired: true,
        challengeToken: challenge.challengeToken,
      };
    }

    const tokens = await this.tokens.issue(principal, context);
    await this.prisma.client.platformMember.update({
      where: { id: operator.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.record(
      principal,
      { action, entity: 'platform_member', entityId: operator.id },
      context,
    );
    this.logger.log(`Platform login ${action} phone=${maskPhone(operator.phone)}`);
    return { tokens, operator: principal };
  }

  private toPrincipal(operator: {
    id: string;
    phone: string;
    fullName: string;
    role: string;
    twoFactorEnabled?: boolean;
  }): PlatformPrincipal {
    return {
      platformMemberId: operator.id,
      phone: operator.phone,
      fullName: operator.fullName,
      role: operator.role as PlatformRoleValue,
      twoFactorEnabled: operator.twoFactorEnabled ?? false,
    };
  }
}
