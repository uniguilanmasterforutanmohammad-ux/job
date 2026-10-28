import { Injectable, Logger } from '@nestjs/common';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { QueueService } from '../../queue/queue.service.js';
import { MESSAGE_JOBS, QUEUE_NAMES } from '../../queue/queue.constants.js';
import { SmsService } from '../notifications/sms.service.js';
import { MessageTemplateService, renderTemplate } from './template.service.js';
import type { BulkSendDto, ListMessagesDto, SendMessageDto, SetConsentDto } from './dto/message.schemas.js';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly templates: MessageTemplateService,
    private readonly queue: QueueService,
  ) {}

  /** Sends (or queues) a single message to a customer or raw address. */
  async send(tenantId: string, dto: SendMessageDto) {
    let toAddress = dto.toAddress ?? null;
    let body = dto.body ?? null;
    let variables: Record<string, string> = dto.variables ?? {};

    if (dto.customerId) {
      const customer = await this.prisma.client.customer.findFirst({
        where: { id: dto.customerId, tenantId, deletedAt: null },
      });
      if (!customer) throw DomainException.notFound('مشتری');

      // Anti-spam: respect consent (MSG-08).
      if (!(await this.hasConsent(tenantId, dto.customerId, dto.channel))) {
        throw DomainException.forbidden('مشتری برای این کانال رضایت دریافت پیام ندارد');
      }

      toAddress ??= dto.channel === 'EMAIL' ? customer.email : customer.phone;
      variables = { customerName: customer.fullName, phone: customer.phone ?? '', ...variables };
    }

    if (dto.templateKey) {
      const template = await this.templates.getByKey(tenantId, dto.templateKey);
      if (!template) throw DomainException.notFound('قالب پیام');
      body = renderTemplate(template.body, variables);
    }

    if (!body) throw DomainException.badRequest('متن پیام یا قالب الزامی است');
    if (!toAddress) throw DomainException.badRequest('گیرنده پیام مشخص نیست');

    const scheduled = dto.scheduledAt && dto.scheduledAt.getTime() > Date.now();

    const message = await this.prisma.client.message.create({
      data: {
        tenantId,
        customerId: dto.customerId ?? null,
        channel: dto.channel,
        templateKey: dto.templateKey ?? null,
        body,
        toAddress,
        provider: this.smsProviderKey(),
        status: 'QUEUED',
        scheduledAt: dto.scheduledAt ?? null,
      },
    });

    if (!scheduled) {
      await this.enqueue(message.id, dto.scheduledAt ?? undefined);
    }

    return this.prisma.client.message.findUniqueOrThrow({ where: { id: message.id } });
  }

  /** Bulk send to a filtered list (MSG-01) — per-recipient rows, consent-gated. */
  async bulkSend(tenantId: string, dto: BulkSendDto) {
    const customers = await this.prisma.client.customer.findMany({
      where: { id: { in: dto.customerIds }, tenantId, deletedAt: null },
      select: { id: true, fullName: true, phone: true, email: true },
    });

    let template: Awaited<ReturnType<MessageTemplateService['getByKey']>> = null;
    if (dto.templateKey) {
      template = await this.templates.getByKey(tenantId, dto.templateKey);
      if (!template) throw DomainException.notFound('قالب پیام');
    }

    const results = { queued: 0, skipped: 0, failed: 0 };

    for (const customer of customers) {
      if (!(await this.hasConsent(tenantId, customer.id, dto.channel))) {
        results.skipped += 1;
        continue;
      }
      const toAddress = dto.channel === 'EMAIL' ? customer.email : customer.phone;
      if (!toAddress) {
        results.skipped += 1;
        continue;
      }
      const body = dto.body ?? renderTemplate(template!.body, { customerName: customer.fullName });

      const message = await this.prisma.client.message.create({
        data: {
          tenantId,
          customerId: customer.id,
          channel: dto.channel,
          templateKey: dto.templateKey ?? null,
          body,
          toAddress,
          provider: this.smsProviderKey(),
          status: 'QUEUED',
        },
      });
      try {
        await this.enqueue(message.id);
        results.queued += 1;
      } catch {
        results.failed += 1;
      }
    }

    this.logger.log(`Bulk send tenant=${tenantId} queued=${results.queued} skipped=${results.skipped}`);
    return results;
  }

  async list(tenantId: string, dto: ListMessagesDto) {
    const where = {
      tenantId,
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.channel ? { channel: dto.channel } : {}),
      ...(dto.customerId ? { customerId: dto.customerId } : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.message.findMany({
        where,
        ...toSkipTake(dto),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.message.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  async stats(tenantId: string) {
    const rows = await this.prisma.client.message.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  }

  async setConsent(tenantId: string, dto: SetConsentDto) {
    return this.prisma.client.messageConsent.upsert({
      where: {
        tenantId_customerId_channel: {
          tenantId,
          customerId: dto.customerId,
          channel: dto.channel,
        },
      },
      update: { optedIn: dto.optedIn, reason: dto.reason ?? null },
      create: {
        tenantId,
        customerId: dto.customerId,
        channel: dto.channel,
        optedIn: dto.optedIn,
        reason: dto.reason ?? null,
      },
    });
  }

  async hasConsent(tenantId: string, customerId: string, channel: string): Promise<boolean> {
    const consent = await this.prisma.client.messageConsent.findUnique({
      where: {
        tenantId_customerId_channel: {
          tenantId,
          customerId,
          channel: channel as never,
        },
      },
    });
    // Default = opted in unless explicitly opted out.
    return consent ? consent.optedIn : true;
  }

  /**
   * Hands the message to the BullMQ `messages` queue (MSG-03). Immediate
   * messages run right away; scheduled ones are delayed until `scheduledAt`.
   * Delivery, retries and status updates are handled by MessageProcessor.
   */
  private async enqueue(messageId: string, scheduledAt?: Date): Promise<void> {
    await this.queue.add(
      QUEUE_NAMES.MESSAGES,
      MESSAGE_JOBS.SEND,
      { messageId },
      scheduledAt && scheduledAt.getTime() > Date.now() ? { delay: scheduledAt.getTime() - Date.now() } : undefined,
    );
  }

  private smsProviderKey(): string {
    return process.env.SMS_PROVIDER ?? 'console';
  }
}
