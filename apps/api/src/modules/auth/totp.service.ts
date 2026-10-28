import { Injectable, Logger } from '@nestjs/common';
import { generateSecret, generateSync, generateURI, verifySync } from 'otplib';

export type TotpEnrollment = {
  secret: string;
  otpauthUrl: string;
};

const ISSUER = 'Business Platform';

/**
 * Thin wrapper around otplib for RFC-6238 TOTP (Google Authenticator compatible).
 * Shared by tenant members and platform operators so 2FA behaves identically.
 */
@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);

  /** Issues a fresh Base32 secret plus the otpauth:// URL to render as a QR. */
  beginEnrollment(label: string, issuer: string = ISSUER): TotpEnrollment {
    const secret = generateSecret();
    const otpauthUrl = generateURI({ issuer, label, secret, strategy: 'totp' });
    return { secret, otpauthUrl };
  }

  /**
   * Verifies a token with a one-step tolerance and returns the accepted time
   * step so callers can persist it and reject replays.
   */
  verify(
    secret: string,
    token: string,
    options: { afterTimeStep?: number | bigint | null } = {},
  ): { valid: boolean; timeStep: number } {
    const normalized = token.replace(/\s+/g, '');
    if (!/^\d{6,8}$/.test(normalized)) return { valid: false, timeStep: 0 };

    try {
      const result = verifySync({
        secret,
        token: normalized,
        // Accept the previous step too, to tolerate clock skew / typing delay.
        epochTolerance: [30, 0],
        ...(options.afterTimeStep != null
          ? { afterTimeStep: Number(options.afterTimeStep) }
          : {}),
      });
      if (!result.valid) return { valid: false, timeStep: 0 };
      // otplib's published union type omits `timeStep` although the TOTP/HOTP
      // strategies always return it at runtime; read it defensively.
      const timeStep = Number((result as { timeStep?: number }).timeStep ?? 0);
      return { valid: true, timeStep };
    } catch (error) {
      // A malformed secret should never crash a login — log and reject.
      this.logger.warn(`TOTP verification error: ${(error as Error).message}`);
      return { valid: false, timeStep: 0 };
    }
  }

  /** Current valid token — used by tests and the console SMS fallback. */
  currentToken(secret: string): string {
    return generateSync({ secret });
  }
}
