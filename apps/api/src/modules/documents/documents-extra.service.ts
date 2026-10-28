import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import type {
  CreateConsentFormDto,
  ExpiryReminderDto,
  ListConsentFormsDto,
  SignConsentFormDto,
} from './dto/document-extra.schemas.js';

/** DOC-04 expiry reminders (notification-driven) and DOC-05 consent forms. */
@Injectable()
export class DocumentsExtraService {
  private readonly logger = new Logger(DocumentsExtraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  // ----- DOC-05 consent forms -----

  createConsentForm(tenantId: string, dto: CreateConsentFormDto) {
    return this.prisma.client.consentForm.create({
      data: {
        tenantId,
        customerId: dto.customerId ?? null,
        title: dto.title,
        body: dto.body,
        expiresAt: dto.expiresAt ?? null,
        status: 'PENDING',
      },
    });
  }

  async listConsentForms(tenantId: string, dto: ListConsentFormsDto) {
    return this.prisma.client.consentForm.findMany({
      where: {
        tenantId,
        ...(dto.customerId ? { customerId: dto.customerId } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async signConsentForm(tenantId: string, id: string, dto: SignConsentFormDto) {
    const form = await this.prisma.client.consentForm.findFirst({ where: { id, tenantId } });
    if (!form) throw DomainException.notFound('رضایت‌نامه');
    if (form.status === 'SIGNED') throw DomainException.conflict('رضایت‌نامه قبلاً امضا شده است');
    return this.prisma.client.consentForm.update({
      where: { id },
      data: { status: 'SIGNED', signatureKey: dto.signatureKey, signedAt: new Date() },
    });
  }

  async revokeConsentForm(tenantId: string, id: string) {
    const form = await this.prisma.client.consentForm.findFirst({ where: { id, tenantId } });
    if (!form) throw DomainException.notFound('رضایت‌نامه');
    return this.prisma.client.consentForm.update({ where: { id }, data: { status: 'REVOKED' } });
  }

  // ----- DOC-04 expiry reminders -----

  /**
   * Finds documents/contracts/consent forms/certifications expiring within N
   * days and pushes a notification for each (in-app + configured channels).
   */
  async runExpiryReminders(tenantId: string, dto: ExpiryReminderDto) {
    const now = new Date();
    const until = new Date(now.getTime() + dto.days * 24 * 60 * 60 * 1000);

    const [documents, contracts, consents] = await this.prisma.client.$transaction([
      this.prisma.client.document.findMany({
        where: { tenantId, expiresAt: { not: null, lte: until, gte: now } },
        include: { customer: { select: { id: true, fullName: true } } },
      }),
      this.prisma.client.contract.findMany({
        where: { tenantId, expiresAt: { not: null, lte: until, gte: now }, status: { notIn: ['SIGNED', 'CANCELED'] } },
      }),
      this.prisma.client.consentForm.findMany({
        where: { tenantId, expiresAt: { not: null, lte: until, gte: now }, status: 'SIGNED' },
      }),
    ]);

    let sent = 0;
    for (const doc of documents) {
      await this.notifications.notify({
        tenantId,
        customerId: doc.customerId ?? undefined,
        event: 'document.expiring',
        title: 'سند در حال انقضا',
        body: `سند «${doc.title}» تا ${dto.days} روز آینده منقضی می‌شود.`,
        channels: ['IN_APP', 'SMS'],
      });
      sent += 1;
    }
    for (const contract of contracts) {
      await this.notifications.notify({
        tenantId,
        customerId: contract.customerId ?? undefined,
        event: 'contract.expiring',
        title: 'قرارداد در حال انقضا',
        body: `قرارداد «${contract.title}» تا ${dto.days} روز آینده منقضی می‌شود.`,
        channels: ['IN_APP'],
      });
      sent += 1;
    }
    for (const consent of consents) {
      await this.notifications.notify({
        tenantId,
        customerId: consent.customerId ?? undefined,
        event: 'consent.expiring',
        title: 'رضایت‌نامه در حال انقضا',
        body: `رضایت‌نامه «${consent.title}» تا ${dto.days} روز آینده منقضی می‌شود.`,
        channels: ['IN_APP'],
      });
      sent += 1;
    }
    this.logger.log(`Expiry reminders tenant=${tenantId} sent=${sent}`);
    return { windowDays: dto.days, sent, documents: documents.length, contracts: contracts.length, consents: consents.length };
  }
}
