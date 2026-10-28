import { Injectable, Logger } from '@nestjs/common';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { PlatformPrincipal } from './admin.constants.js';
import type { AdminAuditQueryDto } from './dto/admin.schemas.js';

export type AuditContext = { ip?: string | null; userAgent?: string | null };

export type WriteAuditInput = {
  action: string;
  entity: string;
  entityId?: string | null;
  tenantId?: string | null;
  before?: unknown;
  after?: unknown;
};

const SENSITIVE_KEYS = new Set(['password', 'passwordHash', 'refreshToken', 'code', 'otp', 'secret']);

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitize);
  const clone: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    clone[key] = SENSITIVE_KEYS.has(key) ? '[redacted]' : sanitize(val);
  }
  return clone;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Records a platform-level mutation. Never throws — audit must not break flow. */
  async record(
    actor: PlatformPrincipal | null,
    input: WriteAuditInput,
    context: AuditContext = {},
  ): Promise<void> {
    try {
      await this.prisma.client.platformAuditLog.create({
        data: {
          platformMemberId: actor?.platformMemberId ?? null,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          tenantId: input.tenantId ?? null,
          before: (sanitize(input.before) ?? null) as never,
          after: (sanitize(input.after) ?? null) as never,
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(`Platform audit write failed: ${(error as Error).message}`);
    }
  }

  async list(dto: AdminAuditQueryDto) {
    const where = {
      ...(dto.tenantId ? { tenantId: dto.tenantId } : {}),
      ...(dto.entity ? { entity: dto.entity } : {}),
      ...(dto.action ? { action: { contains: dto.action, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.platformAuditLog.findMany({
        where,
        ...toSkipTake(dto),
        orderBy: { createdAt: 'desc' },
        include: {
          platformMember: { select: { id: true, fullName: true, phone: true, role: true } },
        },
      }),
      this.prisma.client.platformAuditLog.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  async listForTenant(tenantId: string, page = 1, pageSize = 20) {
    const dto = { page, pageSize };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.platformAuditLog.findMany({
        where: { tenantId },
        ...toSkipTake(dto),
        orderBy: { createdAt: 'desc' },
        include: {
          platformMember: { select: { id: true, fullName: true, role: true } },
        },
      }),
      this.prisma.client.platformAuditLog.count({ where: { tenantId } }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }
}
