import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service.js';
import { SmsService } from '../../modules/notifications/sms.service.js';
import { MessagingExtraService } from '../../modules/messaging/messaging-extra.service.js';
import { MESSAGE_JOBS, QUEUE_NAMES } from '../queue.constants.js';

type SendMessagePayload = { messageId: string };

/**
 * Worker that delivers queued messages (MSG-02/03/06). Consumed by the
 * `messages` queue; retries are handled by BullMQ backoff.
 */
@Processor(QUEUE_NAMES.MESSAGES)
export class MessageProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly messaging: MessagingExtraService,
    @InjectQueue(QUEUE_NAMES.MESSAGES) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job<SendMessagePayload>): Promise<void> {
    if (job.name !== MESSAGE_JOBS.SEND) return;
    const { messageId } = job.data;

    const message = await this.prisma.client.message.findUnique({ where: { id: messageId } });
    if (!message) {
      this.logger.warn(`Message ${messageId} not found; skipping`);
      return;
    }
    if (message.status === 'SENT') return;
    if (!message.toAddress) {
      await this.prisma.client.message.update({
        where: { id: messageId },
        data: { status: 'FAILED', error: 'گیرنده مشخص نیست' },
      });
      return;
    }

    try {
      if (message.channel === 'SMS' || message.channel === 'WHATSAPP') {
        await this.sms.send(message.toAddress, message.body);
        // MSG-07 — consume an SMS package credit (best-effort).
        await this.messaging.consumeCredit(message.tenantId, 1).catch(() => undefined);
      }
      // EMAIL/PUSH providers attach here behind the same switch.
      await this.prisma.client.message.update({
        where: { id: messageId },
        data: { status: 'SENT', sentAt: new Date() },
      });
      this.logger.debug(`Delivered message ${messageId} via ${message.channel}`);
    } catch (error) {
      await this.prisma.client.message.update({
        where: { id: messageId },
        data: { status: 'FAILED', error: (error as Error).message },
      });
      throw error;
    }
  }
}
