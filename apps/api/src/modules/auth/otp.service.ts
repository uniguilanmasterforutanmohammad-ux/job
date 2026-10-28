import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { hash, verify } from 'argon2';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';
import type { AppConfig } from '../../config/configuration.js';
import { OTP_RATELIMIT_PREFIX } from './auth.constants.js';
import { SmsService } from '../notifications/sms.service.js';

const RATELIMIT_WINDOW_SECONDS = 900; // 15 minutes
const MAX_OTP_REQUESTS_PER_WINDOW = 5;

type OtpPurposeValue = 'LOGIN' | 'PHONE_VERIFY' | 'PASSWORD_RESET' | 'TWO_FACTOR';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService<AppConfig>,
    private readonly sms: SmsService,
  ) {}

  private get otpConfig() {
    return this.config.get('otp', { infer: true })!;
  }

  /**
   * Issues an OTP for a phone. Codes are stored hashed and never logged.
   * In development, a fixed bypass code is accepted to ease testing.
   */
  async request(phone: string, purpose: OtpPurposeValue): Promise<{ expiresInSeconds: number }> {
    const rateKey = `${OTP_RATELIMIT_PREFIX}${phone}`;
    const count = await this.redis.incrementWithTtl(rateKey, RATELIMIT_WINDOW_SECONDS);
    if (count > MAX_OTP_REQUESTS_PER_WINDOW) {
      throw DomainException.tooManyRequests('درخواست کد بیش از حد مجاز. کمی بعد تلاش کنید.');
    }

    const { length, ttlSeconds, devBypassCode } = this.otpConfig;
    const code = devBypassCode ?? this.generateCode(length);
    const codeHash = await hash(code);

    // Invalidate previous pending codes for this phone/purpose.
    await this.prisma.client.otpCode.updateMany({
      where: { phone, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await this.prisma.client.otpCode.create({
      data: {
        phone,
        purpose,
        codeHash,
        maxAttempts: this.otpConfig.maxAttempts,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    });

    await this.sms.sendOtp(phone, code);
    this.logger.log(`OTP issued purpose=${purpose} phone=${maskPhone(phone)}`);

    return { expiresInSeconds: ttlSeconds };
  }

  /** Verifies and consumes an OTP. Throws on mismatch, expiry or exhausted attempts. */
  async verify(phone: string, code: string, purpose: OtpPurposeValue): Promise<void> {
    const record = await this.prisma.client.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw DomainException.badRequest('کد یکبار مصرف یافت نشد', 'OTP_NOT_FOUND');
    if (record.expiresAt.getTime() < Date.now()) {
      throw DomainException.badRequest('کد یکبار مصرف منقضی شده است', 'OTP_EXPIRED');
    }
    if (record.attempts >= record.maxAttempts) {
      throw DomainException.tooManyRequests('تعداد تلاش‌های نادرست بیش از حد مجاز است');
    }

    const ok = await verify(record.codeHash, code);
    if (!ok) {
      await this.prisma.client.otpCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw DomainException.badRequest('کد یکبار مصرف نامعتبر است', 'OTP_INVALID');
    }

    await this.prisma.client.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
  }

  private generateCode(length: number): string {
    let code = '';
    for (let i = 0; i < length; i += 1) {
      code += randomInt(0, 10).toString();
    }
    return code;
  }
}

export function maskPhone(phone: string): string {
  if (phone.length < 6) return '***';
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}
