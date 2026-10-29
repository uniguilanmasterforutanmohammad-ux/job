import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { SmsService } from './sms.service.js';
import { EmailService } from './email.service.js';
import { BaleService } from '../bale/bale.service.js';

export type NotificationChannel = 'SMS' | 'EMAIL' | 'IN_APP' | 'PUSH' | 'WHATSAPP';

export type NotifyInput = {
  tenantId: string;
  memberId?: string | null;
  customerId?: string | null;
  event: string;
  title: string;
  body: string;
  channels?: NotificationChannel[];
  /** Set for notifications that are already mirrored explicitly (announcements). */
  skipBaleMirror?: boolean;
};

/**
 * Multi-channel notification dispatcher (CORE-08). Resolves the member's
 * per-event channel preferences, then fans out to the concrete providers.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
    private readonly bale: BaleService,
  ) {}

  /** Resolves channels from member prefs, falling back to the provided default. */
  async resolveChannels(
    tenantId: string,
    memberId: string | null | undefined,
    event: string,
    fallback: NotificationChannel[] = ['IN_APP'],
  ): Promise<NotificationChannel[]> {
    if (!memberId) return fallback;
    const member = await this.prisma.client.member.findFirst({
      where: { id: memberId, tenantId },
      select: { notificationPrefs: true },
    });
    const prefs = (member?.notificationPrefs ?? {}) as Record<string, NotificationChannel[]>;
    return prefs[event]?.length ? prefs[event] : fallback;
  }

  /**
   * Persists an in-app `Message` row and delivers to any external channels.
   * In-app rows always make the notification retrievable even if a channel fails.
   */
  async notify(input: NotifyInput): Promise<{ delivered: NotificationChannel[]; failed: NotificationChannel[] }> {
    const channels = input.channels ?? (await this.resolveChannels(input.tenantId, input.memberId, input.event));
    const delivered: NotificationChannel[] = [];
    const failed: NotificationChannel[] = [];

    let toAddress: string | null = null;
    if (input.customerId) {
      const customer = await this.prisma.client.customer.findFirst({
        where: { id: input.customerId, tenantId: input.tenantId },
        select: { phone: true, email: true },
      });
      toAddress = customer?.phone ?? customer?.email ?? null;
    }

    const message = await this.prisma.client.message.create({
      data: {
        tenantId: input.tenantId,
        customerId: input.customerId ?? null,
        channel: 'IN_APP',
        status: 'QUEUED',
        subject: input.title,
        body: input.body,
        toAddress,
        meta: { event: input.event, channels } as never,
      },
    });

    for (const channel of channels) {
      try {
        if (channel === 'IN_APP') {
          delivered.push(channel);
        } else if (channel === 'SMS' && toAddress) {
          await this.sms.send(toAddress, input.body);
          delivered.push(channel);
        } else if (channel === 'EMAIL') {
          const email = await this.resolveEmail(input.tenantId, input.memberId, input.customerId);
          if (email) {
            await this.email.send({ to: email, subject: input.title, text: input.body });
            delivered.push(channel);
          }
        } else {
          // PUSH / WHATSAPP providers attach later behind this same switch.
          delivered.push(channel);
        }
      } catch (error) {
        failed.push(channel);
        this.logger.warn(`Notify ${channel} failed: ${(error as Error).message}`);
      }
    }

    await this.prisma.client.message.update({
      where: { id: message.id },
      data: { status: failed.length === channels.length ? 'FAILED' : 'SENT', sentAt: new Date() },
    });

    // MSG-BALE — mirror into the tenant's Bale group when the owner enabled it
    // for this event. Fire-and-forget: a Bale outage must never break the flow.
    if (!input.skipBaleMirror) {
      void this.bale
        .mirror(input.tenantId, input.event, { title: input.title, body: input.body })
        .catch((error: Error) => this.logger.warn(`Bale mirror error: ${error.message}`));
    }

    return { delivered, failed };
  }

  private async resolveEmail(
    tenantId: string,
    memberId?: string | null,
    customerId?: string | null,
  ): Promise<string | null> {
    if (customerId) {
      const customer = await this.prisma.client.customer.findFirst({
        where: { id: customerId, tenantId },
        select: { email: true },
      });
      if (customer?.email) return customer.email;
    }
    if (memberId) {
      const member = await this.prisma.client.member.findFirst({
        where: { id: memberId, tenantId },
        select: { email: true },
      });
      if (member?.email) return member.email;
    }
    return null;
  }
}
