import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthenticatedUser } from '@repo/shared';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Writes an immutable audit record (CORE-05) for mutating requests.
 * Runs after the response so only successful changes are recorded.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!MUTATING.has(request.method)) return next.handle();

    return next.handle().pipe(
      tap(() => {
        void this.record(request);
      }),
    );
  }

  private async record(request: Request & { user?: AuthenticatedUser }): Promise<void> {
    try {
      const user = request.user;
      if (!user?.tenantId) return;

      const [entity = 'unknown', entityId] = request.url
        .replace(/^\/api\/v\d+\//, '')
        .split('?')[0]
        .split('/')
        .filter(Boolean);

      await this.prisma.client.auditLog.create({
        data: {
          tenantId: user.tenantId,
          memberId: user.memberId,
          action: `${request.method} ${request.url}`,
          entity,
          entityId: entityId ?? null,
          after: sanitize(request.body) as never,
          ip: request.ip ?? null,
          userAgent: request.get('user-agent') ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(`Audit write failed: ${(error as Error).message}`);
    }
  }
}

const SENSITIVE_KEYS = new Set(['password', 'passwordHash', 'refreshToken', 'code', 'otp']);

function sanitize(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const clone: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    clone[key] = SENSITIVE_KEYS.has(key) ? '[redacted]' : val;
  }
  return clone;
}
