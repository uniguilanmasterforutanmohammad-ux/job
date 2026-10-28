import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReportType = 'revenue' | 'customers' | 'staff';

/** Minimal RFC-4180 CSV serialiser — Excel opens the result directly. */
export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const escape = (value: unknown): string => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(','));
  return '\uFEFF' + lines.join('\n');
}

@Injectable()
export class ReportsExtService {
  private readonly logger = new Logger(ReportsExtService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** RPT-05 — tabular export payloads reused by CSV / print / email. */
  async exportData(tenantId: string, type: ReportType, from: Date, to: Date) {
    switch (type) {
      case 'revenue':
        return this.revenueRows(tenantId, from, to);
      case 'customers':
        return this.customerRows(tenantId, from, to);
      case 'staff':
        return this.staffRows(tenantId, from, to);
      default:
        throw DomainException.badRequest('نوع گزارش نامعتبر است');
    }
  }

  private async revenueRows(tenantId: string, from: Date, to: Date) {
    const payments = await this.prisma.client.payment.findMany({
      where: { tenantId, status: 'SUCCEEDED', paidAt: { gte: from, lte: to } },
      select: { amount: true, method: true, paidAt: true, trackingCode: true },
      orderBy: { paidAt: 'asc' },
    });
    return payments.map((p) => ({
      date: (p.paidAt ?? new Date()).toISOString().slice(0, 10),
      amount: Number(p.amount),
      method: p.method,
      trackingCode: p.trackingCode ?? '',
    }));
  }

  private async customerRows(tenantId: string, from: Date, to: Date) {
    const customers = await this.prisma.client.customer.findMany({
      where: { tenantId, deletedAt: null, createdAt: { gte: from, lte: to } },
      select: { fullName: true, phone: true, city: true, leadStage: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return customers.map((c) => ({
      fullName: c.fullName,
      phone: c.phone ?? '',
      city: c.city ?? '',
      leadStage: c.leadStage,
      createdAt: c.createdAt.toISOString().slice(0, 10),
    }));
  }

  private async staffRows(tenantId: string, from: Date, to: Date) {
    const rows = await this.prisma.client.appointment.groupBy({
      by: ['staffId'],
      where: { tenantId, status: 'COMPLETED', startsAt: { gte: from, lte: to }, staffId: { not: null } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ staffId: r.staffId ?? '', completedAppointments: r._count._all }));
  }

  /** RPT-05 — CSV download. */
  async exportCsv(tenantId: string, type: ReportType, from: Date, to: Date) {
    const rows = (await this.exportData(tenantId, type, from, to)) as Array<Record<string, unknown>>;
    return { filename: `${type}-${from.toISOString().slice(0, 10)}.csv`, content: toCsv(rows) };
  }

  /** RPT-05 — printable HTML (browser print-to-PDF). */
	async exportPrintable(tenantId: string, type: ReportType, from: Date, to: Date) {
    const rows = (await this.exportData(tenantId, type, from, to)) as Array<Record<string, unknown>>;
    const headers = rows.length ? Object.keys(rows[0]!) : [];
    const head = headers.map((h) => `<th style="border:1px solid #ccc;padding:6px">${h}</th>`).join('');
    const body = rows
      .map(
        (row) =>
          `<tr>${headers
            .map((h) => `<td style="border:1px solid #ccc;padding:6px">${row[h] ?? ''}</td>`)
            .join('')}</tr>`,
      )
      .join('');
    const html = `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>گزارش ${type}</title></head><body><h2>گزارش ${type}</h2><table style="border-collapse:collapse;width:100%"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    return { filename: `${type}-${from.toISOString().slice(0, 10)}.html`, html };
  }

  /** RPT-05 — register a scheduled email export. */
  async scheduleExport(
    tenantId: string,
    dto: { type: ReportType; cron: string; email: string },
  ) {
    const tenant = await this.prisma.client.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const schedules = Array.isArray(settings.reportSchedules) ? settings.reportSchedules : [];
    schedules.push({ ...dto, createdAt: new Date().toISOString() });
    await this.prisma.client.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...settings, reportSchedules: schedules } as never },
    });
    return { scheduled: true, total: schedules.length };
  }

  listSchedules(tenantId: string) {
    return this.prisma.client.tenant
      .findUniqueOrThrow({ where: { id: tenantId } })
      .then((t) => ((t.settings ?? {}) as Record<string, unknown>).reportSchedules ?? []);
  }

  /** RPT-06 — next-month revenue forecast from subscriptions + bookings. */
  async forecast(tenantId: string) {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * DAY_MS);
    const past30 = new Date(now.getTime() - 30 * DAY_MS);

    const [historical, subscriptionValue, bookedValue] = await this.prisma.client.$transaction([
      this.prisma.client.payment.aggregate({
        where: { tenantId, status: 'SUCCEEDED', paidAt: { gte: past30, lte: now } },
        _sum: { amount: true },
      }),
      this.prisma.client.studentSubscription.aggregate({
        where: { tenantId, status: 'ACTIVE', endsAt: { gte: now, lte: in30 } },
        _sum: { price: true },
      }),
      this.prisma.client.appointment.findMany({
        where: { tenantId, startsAt: { gte: now, lte: in30 }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
        include: { service: { select: { price: true } } },
      }),
    ]);

    const historicalTotal = Number(historical._sum.amount ?? 0);
    const subscriptionTotal = Number(subscriptionValue._sum.price ?? 0);
    const bookedTotal = bookedValue.reduce((sum, a) => sum + Number(a.service?.price ?? 0), 0);
    return {
      basedOn: { period: '30d', historical: historicalTotal },
      expectedSubscriptions: subscriptionTotal,
      expectedBookings: bookedTotal,
      forecast: historicalTotal + subscriptionTotal + bookedTotal,
    };
  }
}
