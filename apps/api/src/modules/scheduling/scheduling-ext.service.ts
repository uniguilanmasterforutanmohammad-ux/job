import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CreateRecurringDto,
  CreateWaitlistDto,
  UpdateWaitlistStatusDto,
} from './dto/scheduling-ext.schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SchedulingExtService {
  private readonly logger = new Logger(SchedulingExtService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ----- SCH-07 waitlist -----

  createWaitlist(tenantId: string, dto: CreateWaitlistDto) {
    return this.prisma.client.waitlistEntry.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        serviceId: dto.serviceId ?? null,
        preferredFrom: dto.preferredFrom ?? null,
        preferredTo: dto.preferredTo ?? null,
        note: dto.note ?? null,
      },
    });
  }

  listWaitlist(tenantId: string, status?: string) {
    return this.prisma.client.waitlistEntry.findMany({
      where: { tenantId, ...(status ? { status: status as never } : {}) },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateWaitlistStatus(tenantId: string, id: string, dto: UpdateWaitlistStatusDto) {
    const entry = await this.prisma.client.waitlistEntry.findFirst({ where: { id, tenantId } });
    if (!entry) throw DomainException.notFound('رکورد لیست انتظار');
    return this.prisma.client.waitlistEntry.update({ where: { id }, data: { status: dto.status } });
  }

  // ----- SCH-08 recurring series -----

  async createRecurring(tenantId: string, dto: CreateRecurringDto) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId, deletedAt: null },
    });
    if (!customer) throw DomainException.notFound('مشتری');

    const series = await this.prisma.client.recurringSeries.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        serviceId: dto.serviceId ?? null,
        staffId: dto.staffId ?? null,
        frequency: dto.frequency,
        weekday: dto.weekday ?? null,
        timeOfDay: dto.timeOfDay ?? null,
        occurrences: dto.occurrences,
        startsFrom: dto.startsFrom,
        exceptions: dto.exceptions as never,
      },
    });
    return this.generateOccurrences(tenantId, series.id);
  }

  listRecurring(tenantId: string) {
    return this.prisma.client.recurringSeries.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Materialises the next batch of appointments for a recurring series (SCH-08). */
  async generateOccurrences(tenantId: string, seriesId: string) {
    const series = await this.prisma.client.recurringSeries.findFirst({
      where: { id: seriesId, tenantId },
    });
    if (!series) throw DomainException.notFound('سری تکرارشونده');

    const exceptions = new Set(
      (Array.isArray(series.exceptions) ? (series.exceptions as string[]) : []).map((d) =>
        new Date(d).toISOString().slice(0, 10),
      ),
    );
    const stepDays = series.frequency === 'WEEKLY' ? 7 : series.frequency === 'BIWEEKLY' ? 14 : 30;
    const [hh, mm] = (series.timeOfDay ?? '09:00').split(':').map(Number);

    const service = series.serviceId
      ? await this.prisma.client.service.findFirst({ where: { id: series.serviceId, tenantId } })
      : null;
    const duration = service?.durationMinutes ?? 60;

    const created: string[] = [];
    for (let i = 0; i < series.occurrences; i += 1) {
      const day = new Date(series.startsFrom.getTime() + i * stepDays * DAY_MS);
      day.setHours(hh ?? 9, mm ?? 0, 0, 0);
      if (exceptions.has(day.toISOString().slice(0, 10))) continue;
      const appt = await this.prisma.client.appointment.create({
        data: {
          tenantId,
          customerId: series.customerId,
          serviceId: series.serviceId ?? null,
          staffId: series.staffId ?? null,
          startsAt: day,
          endsAt: new Date(day.getTime() + duration * 60 * 1000),
          status: 'SCHEDULED',
          source: 'recurring',
        },
      });
      created.push(appt.id);
    }
    this.logger.log(`Recurring series=${seriesId} generated=${created.length}`);
    return { seriesId, created: created.length, appointmentIds: created };
  }

  async cancelRecurring(tenantId: string, id: string) {
    const series = await this.prisma.client.recurringSeries.findFirst({ where: { id, tenantId } });
    if (!series) throw DomainException.notFound('سری تکرارشونده');
    return this.prisma.client.recurringSeries.update({ where: { id }, data: { isActive: false } });
  }
}
