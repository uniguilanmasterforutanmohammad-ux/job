import { Injectable, Logger } from '@nestjs/common';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CreateSmsPackageDto,
  ListChatDto,
  MarkChatReadDto,
  SendChatDto,
} from './dto/messaging-extra.schemas.js';

/** MSG-05 (individual chat) and MSG-07 (SMS packages/usage). */
@Injectable()
export class MessagingExtraService {
  private readonly logger = new Logger(MessagingExtraService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ----- MSG-05 individual chat -----

  async sendChat(tenantId: string, authorId: string | undefined, dto: SendChatDto) {
    if (!dto.body && !dto.fileKey) {
      throw DomainException.badRequest('متن پیام یا فایل الزامی است');
    }
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw DomainException.notFound('مشتری');

    return this.prisma.client.chatMessage.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        authorId: authorId ?? null,
        direction: dto.direction,
        body: dto.body ?? null,
        fileKey: dto.fileKey ?? null,
      },
    });
  }

  async listChat(tenantId: string, dto: ListChatDto) {
    const where = { tenantId, customerId: dto.customerId };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.chatMessage.findMany({
        where,
        ...toSkipTake(dto),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.chatMessage.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  async markChatRead(tenantId: string, dto: MarkChatReadDto) {
    const result = await this.prisma.client.chatMessage.updateMany({
      where: { tenantId, customerId: dto.customerId, readAt: null, direction: 'INBOUND' },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /** Inbox summary: latest message + unread count per customer. */
  async chatInbox(tenantId: string) {
    const messages = await this.prisma.client.chatMessage.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { customer: { select: { id: true, fullName: true, phone: true } } },
    });
    const map = new Map<
      string,
      {
        customerId: string;
        fullName: string;
        phone: string | null;
        lastMessageAt: Date;
        lastBody: string | null;
        unread: number;
      }
    >();
    for (const m of messages) {
      const entry = map.get(m.customerId);
      if (!entry) {
        map.set(m.customerId, {
          customerId: m.customerId,
          fullName: m.customer.fullName,
          phone: m.customer.phone,
          lastMessageAt: m.createdAt,
          lastBody: m.body,
          unread: m.direction === 'INBOUND' && !m.readAt ? 1 : 0,
        });
      } else if (m.direction === 'INBOUND' && !m.readAt) {
        entry.unread += 1;
      }
    }
    return [...map.values()].sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  // ----- MSG-07 SMS packages / usage -----

  createSmsPackage(tenantId: string, dto: CreateSmsPackageDto) {
    return this.prisma.client.smsPackage.create({
      data: {
        tenantId,
        title: dto.title,
        credits: dto.credits,
        amount: dto.amount,
        expiresAt: dto.expiresAt ?? null,
      },
    });
  }

  async listSmsPackages(tenantId: string) {
    const packages = await this.prisma.client.smsPackage.findMany({
      where: { tenantId },
      orderBy: { purchasedAt: 'desc' },
    });
    const totalCredits = packages.reduce((s, p) => s + p.credits, 0);
    const totalUsed = packages.reduce((s, p) => s + p.used, 0);
    return {
      packages,
      summary: { totalCredits, totalUsed, remaining: Math.max(0, totalCredits - totalUsed) },
    };
  }

  /**
   * MSG-07 usage report. Counts SMS messages sent in the period and deducts
   * them from the tenant's active package consumption counter.
   */
  async smsUsageReport(tenantId: string, from: Date, to: Date) {
    const [sent, failed, queued] = await this.prisma.client.$transaction([
      this.prisma.client.message.count({
        where: { tenantId, channel: 'SMS', createdAt: { gte: from, lte: to }, status: { in: ['SENT', 'DELIVERED', 'READ'] } },
      }),
      this.prisma.client.message.count({
        where: { tenantId, channel: 'SMS', createdAt: { gte: from, lte: to }, status: 'FAILED' },
      }),
      this.prisma.client.message.count({
        where: { tenantId, channel: 'SMS', createdAt: { gte: from, lte: to }, status: 'QUEUED' },
      }),
    ]);
    const packages = await this.prisma.client.smsPackage.findMany({ where: { tenantId } });
    const creditsRemaining = packages.reduce((s, p) => s + Math.max(0, p.credits - p.used), 0);
    return {
      from,
      to,
      smsSent: sent,
      smsFailed: failed,
      smsQueued: queued,
      creditsRemaining,
    };
  }

  /** Deducts credits from packages sequentially (called by the message worker). */
  async consumeCredit(tenantId: string, count = 1): Promise<void> {
    const packages = await this.prisma.client.smsPackage.findMany({
      where: { tenantId },
      orderBy: { purchasedAt: 'asc' },
    });
    let remaining = count;
    for (const p of packages) {
      if (remaining <= 0) break;
      const available = p.credits - p.used;
      if (available <= 0) continue;
      const take = Math.min(available, remaining);
      await this.prisma.client.smsPackage.update({
        where: { id: p.id },
        data: { used: { increment: take } },
      });
      remaining -= take;
    }
    if (remaining > 0) this.logger.warn(`SMS credits exhausted tenant=${tenantId} short=${remaining}`);
  }
}
