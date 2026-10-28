import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  AttendanceAlertDto,
  CreateMakeupDto,
  GeofenceCheckInDto,
  ListAbsenceRequestsDto,
  ListMakeupDto,
  ReviewAbsenceRequestDto,
  UseMakeupDto,
} from './dto/attendance-extra.schemas.js';

const DEFAULT_RADIUS_METERS = 300;

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** ATT-04/05/07 — makeup sessions, attendance-drop alerts and geofenced check-in. */
@Injectable()
export class AttendanceExtraService {
  constructor(private readonly prisma: PrismaService) {}

  // ----- ATT-04 makeup sessions -----

  async createMakeup(tenantId: string, dto: CreateMakeupDto) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw DomainException.notFound('مشتری');
    return this.prisma.client.makeupCredit.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        serviceId: dto.serviceId ?? null,
        sourceAttendanceId: dto.sourceAttendanceId ?? null,
        expiresAt: dto.expiresAt ?? null,
        note: dto.note ?? null,
      },
    });
  }

  listMakeup(tenantId: string, dto: ListMakeupDto) {
    return this.prisma.client.makeupCredit.findMany({
      where: {
        tenantId,
        ...(dto.customerId ? { customerId: dto.customerId } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async useMakeup(tenantId: string, id: string, dto: UseMakeupDto) {
    const credit = await this.prisma.client.makeupCredit.findFirst({ where: { id, tenantId } });
    if (!credit) throw DomainException.notFound('اعتبار جبران جلسه');
    if (credit.status !== 'AVAILABLE')
      throw DomainException.conflict('این اعتبار قابل استفاده نیست');
    if (credit.expiresAt && credit.expiresAt < new Date()) {
      await this.prisma.client.makeupCredit.update({ where: { id }, data: { status: 'EXPIRED' } });
      throw DomainException.badRequest('اعتبار جبران جلسه منقضی شده است');
    }
    return this.prisma.client.makeupCredit.update({
      where: { id },
      data: { status: 'USED', usedAt: new Date(), usedAppointmentId: dto.appointmentId },
    });
  }

  // ----- ATT-05 attendance-drop alert -----

  async attendanceAlerts(tenantId: string, dto: AttendanceAlertDto) {
    const rows = await this.prisma.client.attendance.groupBy({
      by: ['customerId', 'status'],
      where: { tenantId, customerId: { not: null } },
      _count: { _all: true },
    });

    const byCustomer = new Map<string, { total: number; present: number }>();
    for (const row of rows) {
      if (!row.customerId) continue;
      const entry = byCustomer.get(row.customerId) ?? { total: 0, present: 0 };
      entry.total += row._count._all;
      if (row.status === 'PRESENT' || row.status === 'LATE') entry.present += row._count._all;
      byCustomer.set(row.customerId, entry);
    }

    const atRiskIds = [...byCustomer.entries()]
      .filter(([, v]) => v.total > 0 && (v.present / v.total) * 100 < dto.thresholdPercent)
      .map(([id, v]) => ({
        customerId: id,
        present: v.present,
        total: v.total,
        ratio: Math.round((v.present / v.total) * 100),
      }));

    if (!atRiskIds.length) return { threshold: dto.thresholdPercent, atRisk: [] };

    const customers = await this.prisma.client.customer.findMany({
      where: { tenantId, id: { in: atRiskIds.map((a) => a.customerId) } },
      select: { id: true, fullName: true, phone: true },
    });
    const nameMap = new Map(customers.map((c) => [c.id, c]));
    return {
      threshold: dto.thresholdPercent,
      atRisk: atRiskIds.map((a) => ({
        ...a,
        fullName: nameMap.get(a.customerId)?.fullName ?? null,
        phone: nameMap.get(a.customerId)?.phone ?? null,
      })),
    };
  }

  // ----- ATT-07 geofenced check-in -----

  async geofenceCheckIn(tenantId: string, dto: GeofenceCheckInDto) {
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: dto.branchId, tenantId, isActive: true },
    });
    if (!branch) throw DomainException.notFound('شعبه');
    if (branch.latitude == null || branch.longitude == null) {
      throw DomainException.badRequest('مختصات جغرافیایی شعبه تنظیم نشده است');
    }

    const distance = haversineMeters(
      { lat: Number(branch.latitude), lng: Number(branch.longitude) },
      { lat: dto.latitude, lng: dto.longitude },
    );
    const withinRadius = distance <= DEFAULT_RADIUS_METERS + (dto.accuracyMeters ?? 0);
    if (!withinRadius) {
      throw DomainException.badRequest('شما در محدوده شعبه نیستید');
    }

    const today = new Date();
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const attendance = await this.prisma.client.attendance.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        memberId: dto.memberId,
        status: 'PRESENT',
        method: 'GEO',
        date: day,
        checkInAt: new Date(),
        note: `geofence:${Math.round(distance)}m`,
      },
    });
    return { attendance, distanceMeters: Math.round(distance), withinRadius };
  }

  // ----- ATT-03 absence/excuse requests (coach/business side) -----

  /** Coach inbox: pending (or filtered) absence requests awaiting review. */
  async listAbsenceRequests(tenantId: string, dto: ListAbsenceRequestsDto) {
    return this.prisma.client.absenceRequest.findMany({
      where: {
        tenantId,
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.customerId ? { customerId: dto.customerId } : {}),
      },
      orderBy: [{ status: 'asc' }, { absenceDate: 'desc' }],
      take: 200,
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });
  }

  /**
   * Approves or rejects an absence request. On approval the absence is recorded
   * as an EXCUSED attendance for that date (ATT-03) so it feeds attendance
   * reports; on rejection a note is stored for the student to see.
   */
  async reviewAbsenceRequest(
    tenantId: string,
    memberId: string,
    id: string,
    dto: ReviewAbsenceRequestDto,
  ) {
    const request = await this.prisma.client.absenceRequest.findFirst({
      where: { id, tenantId },
    });
    if (!request) throw DomainException.notFound('درخواست غیبت');
    if (request.status !== 'PENDING') {
      throw DomainException.conflict('این درخواست قبلاً بررسی شده است');
    }

    return this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.absenceRequest.update({
        where: { id },
        data: {
          status: dto.decision,
          reviewNote: dto.reviewNote ?? null,
          reviewedByMemberId: memberId,
          reviewedAt: new Date(),
        },
      });

      if (dto.decision === 'APPROVED') {
        // Record the absence as EXCUSED (ATT-03). Idempotent: update an existing
        // row for that customer/date instead of duplicating it.
        const note = `موجه: ${request.note ?? request.reason}`;
        const existing = await tx.attendance.findFirst({
          where: {
            tenantId,
            customerId: request.customerId,
            date: request.absenceDate,
          },
          select: { id: true },
        });
        if (existing) {
          await tx.attendance.update({
            where: { id: existing.id },
            data: { status: 'EXCUSED', note },
          });
        } else {
          await tx.attendance.create({
            data: {
              tenantId,
              customerId: request.customerId,
              status: 'EXCUSED',
              method: 'MANUAL',
              date: request.absenceDate,
              note,
            },
          });
        }
      }
      return updated;
    });
  }
}
