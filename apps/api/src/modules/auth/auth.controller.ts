import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration.js';
import { AuthService } from './auth.service.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth.constants.js';
import {
  passwordLoginSchema,
  registerTenantSchema,
  requestOtpSchema,
  verifyOtpSchema,
  type PasswordLoginDto,
  type RegisterTenantDto,
  type RequestOtpDto,
  type VerifyOtpDto,
} from './dto/auth.schemas.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  @ApiOperation({ summary: 'درخواست کد یکبار مصرف' })
  requestOtp(@Body(new ZodValidationPipe(requestOtpSchema)) dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  @ApiOperation({ summary: 'ورود با کد یکبار مصرف' })
  async verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpSchema)) dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyOtpLogin(dto, {
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
    });
    this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'ورود با رمز عبور' })
  async login(
    @Body(new ZodValidationPipe(passwordLoginSchema)) dto: PasswordLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.passwordLogin(dto, {
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
    });
    this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'ثبت‌نام کسب‌وکار جدید (SaaS onboarding)' })
  async register(
    @Body(new ZodValidationPipe(registerTenantSchema)) dto: RegisterTenantDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.registerTenant(dto, {
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
    });
    this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    return result;
  }

  @Post('logout')
  @ApiOperation({ summary: 'خروج' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
    const result = await this.auth.logout(cookies[REFRESH_TOKEN_COOKIE]);
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
    return result;
  }

  @Get('me')
  @ApiOperation({ summary: 'اطلاعات کاربر جاری' })
  me(@CurrentUser('memberId') memberId: string) {
    return this.auth.me(memberId);
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const secure = this.config.get('isProd', { infer: true }) ?? false;
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}
