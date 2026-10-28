import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Dashboard KPIs (RPT-01). */
  async dashboard(tenantId: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
    const startOfTomorrow = endOfToday;
    const endOfTomorrow = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000 - 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      revenueToday,
      revenueMonth,
      appointmentsToday,
      appointmentsTomorrow,
      newCustomersMonth,
      totalCustomers,
      unpaidAgg,
      enabledModules,
    ] = await this.prisma.client.$transaction([
      this.prisma.client.payment.aggregate({
        where: { tenantId, status: 'SUCCEEDED', paidAt: { gte: startOfToday, lte: endOfToday } },
        _sum: { amount: true },
      }),
      this.prisma.client.payment.aggregate({
        where: { tenantId, status: 'SUCCEEDED', paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.client.appointment.count({
        where: { tenantId, startsAt: { gte: startOfToday, lte: endOfToday } },
      }),
      this.prisma.client.appointment.count({
        where: { tenantId, startsAt: { gte: startOfTomorrow, lte: endOfTomorrow } },
      }),
      this.prisma.client.customer.count({
        where: { tenantId, deletedAt: null, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.client.customer.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.client.invoice.aggregate({
        where: { tenantId, status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] }, deletedAt: null },
        _sum: { total: true, paidTotal: true },
      }),
      this.prisma.client.tenantModule.findMany({
        where: { tenantId, isEnabled: true },
        select: { key: true },
      }),
    ]);

    const outstanding =
      Number(unpaidAgg._sum.total ?? 0) - Number(unpaidAgg._sum.paidTotal ?? 0);

    return {
      revenueToday: Number(revenueToday._sum.amount ?? 0),
      revenueMonth: Number(revenueMonth._sum.amount ?? 0),
      appointmentsToday,
      appointmentsTomorrow,
      newCustomersMonth,
      totalCustomers,
      outstanding,
      enabledModules: enabledModules.map((m) => m.key),
    };
  }

  /** Revenue grouped by day for a period (RPT-02). */
  async revenueSeries(tenantId: string, from: Date, to: Date) {
    const payments = await this.prisma.client.payment.findMany({
      where: { tenantId, status: 'SUCCEEDED', paidAt: { gte: from, lte: to } },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    });

    const buckets = new Map<string, number>();
    for (const payment of payments) {
      const key = (payment.paidAt ?? new Date()).toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(payment.amount));
    }

    return [...buckets.entries()].map(([date, amount]) => ({ date, amount }));
  }

  /** Top staff by completed appointments (RPT-04). */
  async staffPerformance(tenantId: string, from: Date, to: Date) {
    const rows = await this.prisma.client.appointment.groupBy({
      by: ['staffId'],
      where: {
        tenantId,
        status: 'COMPLETED',
        startsAt: { gte: from, lte: to },
        staffId: { not: null },
      },
      _count: { _all: true },
    });

    return rows
      .filter((row) => row.staffId)
      .map((row) => ({ staffId: row.staffId as string, completed: row._count._all }))
      .sort((a, b) => b.completed - a.completed);
  }

  /** Customer growth + churn signals (RPT-03). */
  async customerStats(tenantId: string, from: Date, to: Date) {
    const [created, total, active] = await this.prisma.client.$transaction([
      this.prisma.client.customer.count({
        where: { tenantId, deletedAt: null, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.client.customer.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.client.customer.count({
        where: {
          tenantId,
          deletedAt: null,
          appointments: { some: { startsAt: { gte: from, lte: to } } },
        },
      }),
    ]);
    return { newCustomers: created, totalCustomers: total, activeCustomers: active };
  }
}
