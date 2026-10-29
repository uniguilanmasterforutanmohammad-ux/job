import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { BaleService } from '../bale/bale.service.js';
import type { ListAnnouncementsDto, PublishAnnouncementDto } from './dto/announcement.schemas.js';

/**
 * اطلاعیه‌ها (MSG-ANN) — یک اطلاعیه از پنل منتشر می‌شود، برای هر گیرنده یک
 * پیام درون‌برنامه‌ای (`Message`) می‌سازد تا در `/me` دیده شود و نسخه‌ای هم به
 * گروه بیام‌رسان بله آینه می‌شود.
 */
@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bale: BaleService,
  ) {}

  async list(tenantId: string, dto: ListAnnouncementsDto) {
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.announcement.findMany({
        where: { tenantId },
        orderBy: { publishedAt: 'desc' },
        take: dto.take,
      }),
      this.prisma.client.announcement.count({ where: { tenantId } }),
    ]);
    return { data, total };
  }

  async publish(tenantId: string, dto: PublishAnnouncementDto, createdById?: string) {
    const recipients = await this.resolveRecipients(tenantId, dto);

    let announcement = await this.prisma.client.announcement.create({
      data: {
        tenantId,
        title: dto.title,
        body: dto.body,
        audience: dto.audience,
        eventDate: dto.eventDate ?? null,
        recipients: recipients.length,
        createdById: createdById ?? null,
      },
    });

    if (recipients.length) {
      const now = new Date();
      await this.prisma.client.message.createMany({
        data: recipients.map((customer) => ({
          tenantId,
          customerId: customer.id,
          channel: 'IN_APP' as const,
          status: 'SENT' as const,
          subject: dto.title,
          body: dto.body,
          toAddress: customer.phone ?? customer.email ?? null,
          sentAt: now,
          meta: {
            event: 'announcement',
            announcementId: announcement.id,
            ...(dto.eventDate ? { eventDate: dto.eventDate.toISOString() } : {}),
          } as never,
        })),
      });
    }

    let bale: { status: string; messageId?: string; error?: string; reason?: string } = {
      status: 'SKIPPED',
      reason: dto.mirrorToBale ? 'skipped' : 'disabled_by_user',
    };
    if (dto.mirrorToBale) {
      const result = await this.bale.mirror(tenantId, 'announcement', {
        title: dto.title,
        body: dto.body,
        eventDate: dto.eventDate ?? null,
      });
      bale = result;
      announcement = await this.prisma.client.announcement.update({
        where: { id: announcement.id },
        data: {
          baleStatus: result.status,
          baleError: result.status === 'FAILED' ? result.error : result.status === 'SKIPPED' ? result.reason : null,
          baleMessageId: result.status === 'SENT' ? result.messageId : null,
        },
      });
    }

    this.logger.log(
      `Announcement tenant=${tenantId} recipients=${recipients.length} bale=${bale.status}`,
    );

    return { ...announcement, bale };
  }

  /** Re-sends an existing announcement to Bale (after fixing the connection). */
  async resendToBale(tenantId: string, id: string) {
    const announcement = await this.prisma.client.announcement.findFirst({
      where: { id, tenantId },
    });
    if (!announcement) throw DomainException.notFound('اطلاعیه');

    const result = await this.bale.mirror(tenantId, 'announcement', {
      title: announcement.title,
      body: announcement.body,
      eventDate: announcement.eventDate,
    });
    await this.prisma.client.announcement.update({
      where: { id: announcement.id },
      data: {
        baleStatus: result.status,
        baleError: result.status === 'FAILED' ? result.error : result.status === 'SKIPPED' ? result.reason : null,
        baleMessageId: result.status === 'SENT' ? result.messageId : null,
      },
    });
    return result;
  }

  private async resolveRecipients(tenantId: string, dto: PublishAnnouncementDto) {
    if (dto.audience === 'SELECTED') {
      const customers = await this.prisma.client.customer.findMany({
        where: {
          tenantId,
          deletedAt: null,
          id: { in: dto.customerIds ?? [] },
        },
        select: { id: true, phone: true, email: true },
      });
      if (!customers.length) throw DomainException.badRequest('هیچ گیرندهٔ معتبری انتخاب نشده است');
      return customers;
    }

    return this.prisma.client.customer.findMany({
      where: { tenantId, deletedAt: null, isActive: true },
      select: { id: true, phone: true, email: true },
      take: 5000,
    });
  }
}
