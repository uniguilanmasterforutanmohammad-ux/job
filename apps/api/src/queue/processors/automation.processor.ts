import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationService } from '../../modules/notifications/notification.service.js';
import { SubscriptionsService } from '../../modules/subscriptions/subscriptions.service.js';
import { FinanceExtService } from '../../modules/finance/finance-ext.service.js';
import { DocumentsExtraService } from '../../modules/documents/documents-extra.service.js';
import { AUTOMATION_JOBS, QUEUE_NAMES } from '../queue.constants.js';

type TenantPayload = { tenantId: string };

/**
 * Background automation worker (SCH-05, SUB-02, FIN-04). Runs cron-registered
 * jobs across all active tenants. Each handler is idempotent per run.
 */
@Processor(QUEUE_NAMES.AUTOMATION)
export class AutomationProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly subscriptions: SubscriptionsService,
    private readonly finance: FinanceExtService,
    private readonly documents: DocumentsExtraService,
  ) {
    super();
  }

  async process(job: Job<TenantPayload>): Promise<void> {
    const tenants = job.data.tenantId
      ? [job.data.tenantId]
      : (await this.prisma.client.tenant.findMany({ where: { deletedAt: null, status: 'ACTIVE' }, select: { id: true } })).map(
          (t) => t.id,
        );

    switch (job.name) {
      case AUTOMATION_JOBS.APPOINTMENT_REMINDER:
        for (const tenantId of tenants) await this.sendAppointmentReminders(tenantId);
        return;
      case AUTOMATION_JOBS.SUBSCRIPTION_RENEWAL:
        for (const tenantId of tenants) await this.subscriptions.processRenewals(tenantId);
        return;
      case AUTOMATION_JOBS.INSTALLMENT_OVERDUE:
        for (const tenantId of tenants) await this.finance.markOverdue(tenantId);
        return;
      case AUTOMATION_JOBS.DEDUCT_STOCK_FOR_SERVICE:
        for (const tenantId of tenants) await this.deductServiceConsumption(tenantId);
        return;
      case AUTOMATION_JOBS.DOCUMENT_EXPIRY:
        for (const tenantId of tenants) await this.documents.runExpiryReminders(tenantId, { days: 30 });
        return;
      default:
        this.logger.warn(`Unknown automation job: ${job.name}`);
    }
  }

  /** SCH-05 — reminds customers of appointments starting in ~24h / ~1h. */
  private async sendAppointmentReminders(tenantId: string): Promise<void> {
    const now = new Date();
    const windows = [
      { label: '24h', from: new Date(now.getTime() + 23 * 3600_000), to: new Date(now.getTime() + 25 * 3600_000) },
      { label: '1h', from: new Date(now.getTime() + 30 * 60_000), to: new Date(now.getTime() + 90 * 60_000) },
    ];

    for (const window of windows) {
      const appointments = await this.prisma.client.appointment.findMany({
        where: {
          tenantId,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          remindedAt: null,
          startsAt: { gte: window.from, lte: window.to },
        },
        include: { customer: { select: { id: true, fullName: true, phone: true } } },
      });

      for (const appt of appointments) {
        if (!appt.customer.phone) continue;
        await this.notifications.notify({
          tenantId,
          customerId: appt.customer.id,
          event: 'appointment_reminder',
          title: 'یادآور نوبت',
          body: `${appt.customer.fullName} عزیز، یادآور نوبت شما.`,
          channels: ['SMS', 'IN_APP'],
        });
        await this.prisma.client.appointment.update({
          where: { id: appt.id },
          data: { remindedAt: new Date() },
        });
      }
      this.logger.debug(`Reminders tenant=${tenantId} window=${window.label} count=${appointments.length}`);
    }
  }

  /** INV-05 — deducts materials linked to a completed service via appointment meta. */
  private async deductServiceConsumption(tenantId: string): Promise<void> {
    const completed = await this.prisma.client.appointment.findMany({
      where: { tenantId, status: 'COMPLETED' },
      select: { id: true, meta: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    for (const appt of completed) {
      const meta = (appt.meta ?? {}) as Record<string, unknown>;
      const recipe = Array.isArray(meta.consumption)
        ? (meta.consumption as Array<{ productId: string; quantity: number }>)
        : [];
      if (recipe.length === 0 || meta.consumptionApplied === true) continue;

      for (const line of recipe) {
        await this.prisma.client.$transaction([
          this.prisma.client.stockMovement.create({
            data: {
              tenantId,
              productId: line.productId,
              type: 'CONSUMPTION',
              quantity: -Math.abs(line.quantity),
              reference: appt.id,
            },
          }),
          this.prisma.client.product.update({
            where: { id: line.productId },
            data: { stock: { decrement: Math.abs(line.quantity) } },
          }),
        ]);
      }
      await this.prisma.client.appointment.update({
        where: { id: appt.id },
        data: { meta: { ...meta, consumptionApplied: true } as never },
      });
    }
  }
}
