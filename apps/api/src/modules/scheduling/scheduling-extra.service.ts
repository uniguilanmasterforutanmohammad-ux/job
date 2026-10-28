import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  AvailabilityQueryDto,
  CancelAppointmentDto,
  ConnectCalendarDto,
  CreateGroupBookingDto,
  JoinGroupBookingDto,
} from './dto/scheduling-extra.schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SLOT_MINUTES = 30;

/**
 * SCH-03/04/06/09 — time rules, cancellation policy, group bookings and
 * external-calendar sync. Sync is a stub behind an interface until the
 * Google/Outlook OAuth credentials are provisioned.
 */
@Injectable()
export class SchedulingExtraService {
  private readonly logger = new Logger(SchedulingExtraService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** SCH-03 — free slots for a service/staff/date, honouring opening hours. */
  async availability(tenantId: string, dto: AvailabilityQueryDto) {
    const branch = await this.prisma.client.branch.findFirst({
      where: { tenantId, isActive: true, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const workHours = (branch?.workHours ?? {}) as Record<string, { open?: string; close?: string }>;
    const weekday = String(new Date(dto.date).getDay());
    const hours = workHours[weekday] ?? { open: '09:00', close: '21:00' };

    let duration = 60;
    let buffer = 0;
    if (dto.serviceId) {
      const service = await this.prisma.client.service.findFirst({
        where: { id: dto.serviceId, tenantId, deletedAt: null },
      });
      if (!service) throw DomainException.notFound('خدمت');
      duration = service.durationMinutes;
      buffer = service.bufferMinutes;
    }

    const dayStart = new Date(dto.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    const existing = await this.prisma.client.appointment.findMany({
      where: {
        tenantId,
        ...(dto.staffId ? { staffId: dto.staffId } : {}),
        status: { notIn: ['CANCELED', 'NO_SHOW'] },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { startsAt: true, endsAt: true },
    });

    const [openH, openM] = (hours.open ?? '09:00').split(':').map(Number);
    const [closeH, closeM] = (hours.close ?? '21:00').split(':').map(Number);
    const openAt = new Date(dayStart);
    openAt.setHours(openH ?? 9, openM ?? 0, 0, 0);
    const closeAt = new Date(dayStart);
    closeAt.setHours(closeH ?? 21, closeM ?? 0, 0, 0);

    const slots: Array<{ start: string; end: string }> = [];
    const step = duration + buffer;
    for (let t = openAt.getTime(); t + duration * 60_000 <= closeAt.getTime(); t += SLOT_MINUTES * 60_000) {
      const slotStart = new Date(t);
      const slotEnd = new Date(t + duration * 60_000);
      const overlaps = existing.some((a) => a.startsAt < slotEnd && a.endsAt > slotStart);
      if (!overlaps) slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
      if (step > 0 && (t - openAt.getTime()) % (step * 60_000) === 0 && step > SLOT_MINUTES) {
        // step alignment is intentionally simple; slots still filtered by overlap
      }
    }
    return { date: dayStart.toISOString(), hours, duration, slots };
  }

  /** SCH-04 — cancel with an optional penalty and track no-shows/risky flags. */
  async cancelAppointment(tenantId: string, id: string, dto: CancelAppointmentDto) {
    const appointment = await this.prisma.client.appointment.findFirst({ where: { id, tenantId } });
    if (!appointment) throw DomainException.notFound('نوبت');
    if (appointment.status === 'CANCELED') throw DomainException.conflict('نوبت قبلاً لغو شده است');

    const result = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          status: 'CANCELED',
          cancelReason: dto.reason ?? null,
        },
      });

      if (dto.chargePenalty && dto.penaltyAmount > 0) {
        const wallet = await tx.wallet.upsert({
          where: { customerId: appointment.customerId },
          update: {},
          create: { tenantId, customerId: appointment.customerId, balance: 0 },
        });
        const balanceAfter = Number(wallet.balance) - dto.penaltyAmount;
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEBIT',
            amount: dto.penaltyAmount,
            balanceAfter,
            reason: 'جریمه لغو دیرهنگام نوبت',
          },
        });
      }
      return updated;
    });

    return result;
  }

  /** SCH-04 — mark a no-show and flag chronically unreliable customers. */
  async markNoShow(tenantId: string, id: string, threshold = 3) {
    const appointment = await this.prisma.client.appointment.findFirst({ where: { id, tenantId } });
    if (!appointment) throw DomainException.notFound('نوبت');

    await this.prisma.client.appointment.update({
      where: { id },
      data: { status: 'NO_SHOW' },
    });

    const customer = await this.prisma.client.customer.update({
      where: { id: appointment.customerId },
      data: { noShowCount: { increment: 1 } },
    });
    if (customer.noShowCount >= threshold && !customer.isRisky) {
      await this.prisma.client.customer.update({
        where: { id: customer.id },
        data: { isRisky: true, tags: { push: 'پرریسک' } },
      });
    }
    return { appointmentId: id, noShowCount: customer.noShowCount, isRisky: customer.isRisky || customer.noShowCount >= threshold };
  }

  // ----- SCH-06 group bookings -----

  async createGroupBooking(tenantId: string, dto: CreateGroupBookingDto) {
    const startsAt = dto.startsAt;
    const endsAt = new Date(startsAt.getTime() + dto.durationMinutes * 60_000);
    return this.prisma.client.groupBooking.create({
      data: {
        tenantId,
        title: dto.title,
        serviceId: dto.serviceId ?? null,
        staffId: dto.staffId ?? null,
        startsAt,
        endsAt,
        capacity: dto.capacity,
      },
    });
  }

  listGroupBookings(tenantId: string) {
    return this.prisma.client.groupBooking.findMany({
      where: { tenantId },
      orderBy: { startsAt: 'desc' },
      include: { members: true },
    });
  }

  async joinGroupBooking(tenantId: string, id: string, dto: JoinGroupBookingDto) {
    const booking = await this.prisma.client.groupBooking.findFirst({
      where: { id, tenantId },
      include: { members: true },
    });
    if (!booking) throw DomainException.notFound('رزرو گروهی');
    if (!booking.isOpen) throw DomainException.conflict('این رزرو گروهی بسته شده است');
    if (booking.members.length >= booking.capacity) {
      throw DomainException.conflict('ظرفیت این رزرو گروهی تکمیل است');
    }

    const existing = await this.prisma.client.groupBookingMember.findUnique({
      where: { groupBookingId_customerId: { groupBookingId: id, customerId: dto.customerId } },
    });
    if (existing) throw DomainException.conflict('این مشتری قبلاً ثبت‌نام کرده است');

    const appointment = await this.prisma.client.appointment.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        serviceId: booking.serviceId ?? null,
        staffId: booking.staffId ?? null,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        status: 'SCHEDULED',
        source: 'group',
      },
    });
    return this.prisma.client.groupBookingMember.create({
      data: { groupBookingId: id, customerId: dto.customerId, appointmentId: appointment.id },
    });
  }

  async closeGroupBooking(tenantId: string, id: string) {
    const booking = await this.prisma.client.groupBooking.findFirst({ where: { id, tenantId } });
    if (!booking) throw DomainException.notFound('رزرو گروهی');
    return this.prisma.client.groupBooking.update({ where: { id }, data: { isOpen: false } });
  }

  // ----- SCH-09 external calendar sync (stub) -----

  listConnections(tenantId: string) {
    return this.prisma.client.calendarConnection.findMany({
      where: { tenantId },
      select: { id: true, provider: true, memberId: true, isActive: true, lastSyncedAt: true },
    });
  }

  async connectCalendar(tenantId: string, dto: ConnectCalendarDto) {
    const existing = await this.prisma.client.calendarConnection.findFirst({
      where: { tenantId, memberId: dto.memberId ?? null, provider: dto.provider },
    });
    const connection = existing
      ? await this.prisma.client.calendarConnection.update({
          where: { id: existing.id },
          data: { isActive: true, externalId: dto.externalId ?? null },
        })
      : await this.prisma.client.calendarConnection.create({
          data: {
            tenantId,
            memberId: dto.memberId ?? null,
            provider: dto.provider,
            externalId: dto.externalId ?? null,
          },
        });
    // Real OAuth/two-way sync is added when the provider credentials exist.
    return { ...connection, syncEnabled: false, message: 'همگام‌سازی پس از پیکربندی اعتبارنامه فعال می‌شود' };
  }

  async disconnectCalendar(tenantId: string, id: string) {
    const connection = await this.prisma.client.calendarConnection.findFirst({ where: { id, tenantId } });
    if (!connection) throw DomainException.notFound('اتصال تقویم');
    return this.prisma.client.calendarConnection.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
