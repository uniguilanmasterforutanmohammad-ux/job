import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration.js';

/**
 * SMS provider abstraction. Real providers (Kavenegar / MelliPayamak) are
 * added later behind this same interface; dev uses a console provider.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService<AppConfig>) {}

  private get provider(): string {
    return this.config.get('sms', { infer: true })?.provider ?? 'console';
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    await this.send(phone, `کد ورود شما: ${code}`);
  }

  async send(phone: string, body: string): Promise<void> {
    switch (this.provider) {
      case 'kavenegar':
      case 'mellipayamak':
        // Wiring for real providers lands with the integration phase.
        this.logger.warn(`SMS provider "${this.provider}" not configured yet; dropping message`);
        return;
      case 'console':
      default:
        this.logger.debug(`[SMS:console] ${maskPhone(phone)} -> ${body}`);
        return;
    }
  }
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return '***';
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}
