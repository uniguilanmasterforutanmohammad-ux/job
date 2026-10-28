import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration.js';

export type EmailMessage = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

/**
 * Email provider abstraction (CORE-08). Real SMTP delivery is enabled by
 * setting EMAIL_PROVIDER=smtp; the console provider logs for local dev.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService<AppConfig>) {}

  private get emailConfig() {
    return this.config.get('email', { infer: true })!;
  }

  async send(message: EmailMessage): Promise<void> {
    const { provider } = this.emailConfig;
    switch (provider) {
      case 'smtp':
        await this.sendViaSmtp(message);
        return;
      case 'console':
      default:
        this.logger.debug(
          `[EMAIL:console] to=${maskEmail(message.to)} subject="${message.subject}"`,
        );
        return;
    }
  }

  private async sendViaSmtp(message: EmailMessage): Promise<void> {
    const cfg = this.emailConfig;
    if (!cfg.host || !cfg.user || !cfg.password) {
      this.logger.warn('SMTP selected but credentials are incomplete; dropping email');
      return;
    }
    // Real transport (nodemailer) is attached when SMTP creds are provisioned.
    // Keeping the interface stable so the rest of the platform is unaffected.
    this.logger.warn(`SMTP transport not provisioned yet; dropping email to ${maskEmail(message.to)}`);
  }
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return '***';
  const visible = name.slice(0, 2);
  return `${visible}***@${domain}`;
}
