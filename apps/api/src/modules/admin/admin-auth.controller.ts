import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator.js';
import {
  CurrentPlatform,
  RequirePlatformRoles,
} from '../../common/decorators/platform.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { AppConfig } from '../../config/configuration.js';
import type { PlatformPrincipal } from './admin.constants.js';
import { AdminAuthService } from './admin-auth.service.js';
import { PlatformAuthGuard } from './guards/platform-auth.guard.js';
import { PlatformRolesGuard } from './guards/platform-roles.guard.js';
import {
  PLATFORM_ACCESS_COOKIE,
  PLATFORM_REFRESH_COOKIE,
} from './admin.constants.js';
import {
  platformOtpRequestSchema,
  platformOtpVerifySchema,
  platformPasswordLoginSchema,
  platformTotpCodeSchema,
  platformTwoFactorVerifySchema,
  type PlatformOtpRequestDto,
  type PlatformOtpVerifyDto,
  type PlatformPasswordLoginDto,
  type PlatformTotpCodeDto,
  type PlatformTwoFactorVerifyDto,
} from './dto/admin.schemas.js';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  @ApiOperation({ summary: 'درخواست کد یکبار مصرف برای ورود به بنل مدیریت' })
  requestOtp(@Body(new ZodValidationPipe(platformOtpRequestSchema)) dto: PlatformOtpRequestDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  @ApiOperation({ summary: 'ورود به بنل مدیریت با کد یکبار مصرف' })
  async verifyOtp(
    @Body(new ZodValidationPipe(platformOtpVerifySchema)) dto: PlatformOtpVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyOtpLogin(dto, requestContext(req));
    if (!result.twoFactorRequired) {
      this.setCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    }
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'ورود به بنل مدیریت با رمز عبور' })
  async login(
    @Body(new ZodValidationPipe(platformPasswordLoginSchema)) dto: PlatformPasswordLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.passwordLogin(dto, requestContext(req));
    if (!result.twoFactorRequired) {
      this.setCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    }
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/verify')
  @ApiOperation({ summary: 'تکمیل ورود با کد ورود دو مرحله‌ای (TOTP)' })
  async verifyTwoFactor(
    @Body(new ZodValidationPipe(platformTwoFactorVerifySchema)) dto: PlatformTwoFactorVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyTwoFactor(dto, requestContext(req));
    this.setCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    return result;
  }

  @Public()
  @UseGuards(PlatformAuthGuard)
  @Get('account')
  @ApiOperation({ summary: 'پروفایل و وضعیت ۲FA مدیر جاری' })
  account(@CurrentPlatform() principal: PlatformPrincipal) {
    return this.auth.account(principal.platformMemberId);
  }

  @Public()
  @UseGuards(PlatformAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/setup')
  @ApiOperation({ summary: 'شروع فعال‌سازی ورود دو مرحله‌ای' })
  setupTwoFactor(@CurrentPlatform() principal: PlatformPrincipal) {
    return this.auth.beginTwoFactor(principal.platformMemberId);
  }

  @Public()
  @UseGuards(PlatformAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/confirm')
  @ApiOperation({ summary: 'تأیید فعال‌سازی ورود دو مرحله‌ای' })
  confirmTwoFactor(
    @CurrentPlatform() principal: PlatformPrincipal,
    @Body(new ZodValidationPipe(platformTotpCodeSchema)) dto: PlatformTotpCodeDto,
    @Req() req: Request,
  ) {
    return this.auth.confirmTwoFactor(principal.platformMemberId, dto, requestContext(req));
  }

  @Public()
  @UseGuards(PlatformAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/disable')
  @ApiOperation({ summary: 'غیرفعال‌سازی ورود دو مرحله‌ای' })
  disableTwoFactor(
    @CurrentPlatform() principal: PlatformPrincipal,
    @Body(new ZodValidationPipe(platformTotpCodeSchema)) dto: PlatformTotpCodeDto,
    @Req() req: Request,
  ) {
    return this.auth.disableTwoFactor(principal.platformMemberId, dto, requestContext(req));
  }

  @Public()
  @UseGuards(PlatformAuthGuard)
  @Post('logout')
  @ApiOperation({ summary: 'خروج از بنل مدیریت' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
    const result = await this.auth.logout(cookies[PLATFORM_REFRESH_COOKIE]);
    res.clearCookie(PLATFORM_ACCESS_COOKIE, { path: '/' });
    res.clearCookie(PLATFORM_REFRESH_COOKIE, { path: '/' });
    return result;
  }

  @Public()
  @UseGuards(PlatformAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'اطلاعات مدیر جاری' })
  async me(@CurrentPlatform() principal: PlatformPrincipal) {
    return this.auth.me(principal.platformMemberId);
  }

  private setCookies(res: Response, accessToken: string, refreshToken: string): void {
    const secure = this.config.get('isProd', { infer: true }) ?? false;
    res.cookie(PLATFORM_ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.cookie(PLATFORM_REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}

export function requestContext(req: Request) {
  return { userAgent: req.get('user-agent') ?? undefined, ip: req.ip };
}
