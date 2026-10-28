import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { todayDateOnly } from '../../common/dto/date-only.dto.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { ListAttendanceDto, MarkAttendanceDto } from './dto/attendance.schemas.js';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async mark(tenantId: string, dto: MarkAttendanceDto) {
    if (!dto.customerId && !dto.memberId) {
      throw DomainException.badRequest('یکی از مشتری یا کارمند باید مشخص شود');
    }
    if (dto.customerId) {
      const customer = await this.prisma.client.customer.findFirst({
        where: { id: dto.customerId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!customer) throw DomainException.notFound('مشتری');
    }

    const day = dto.date ?? todayDateOnly();

    return this.prisma.client.attendance.create({
      data: {
        tenantId,
        customerId: dto.customerId ?? null,
        memberId: dto.memberId ?? null,
        branchId: dto.branchId ?? null,
        status: dto.status,
        method: dto.method,
        note: dto.note ?? null,
        date: day,
        checkInAt: dto.status === 'PRESENT' || dto.status === 'LATE' ? new Date() : null,
      },
    });
  }

  list(tenantId: string, dto: ListAttendanceDto) {
    return this.prisma.client.attendance.findMany({
      where: {
        tenantId,
        ...(dto.customerId ? { customerId: dto.customerId } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.from || dto.to
          ? {
              date: {
                ...(dto.from ? { gte: dto.from } : {}),
                ...(dto.to ? { lte: dto.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: 500,
      include: { customer: { select: { id: true, fullName: true } } },
    });
  }

  /** Attendance ratio for a customer over a period (ATT-05/06). */
  async summary(tenantId: string, customerId: string) {
    const [present, total] = await this.prisma.client.$transaction([
      this.prisma.client.attendance.count({
        where: { tenantId, customerId, status: { in: ['PRESENT', 'LATE'] } },
      }),
      this.prisma.client.attendance.count({ where: { tenantId, customerId } }),
    ]);
    const ratio = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, total, ratio };
  }
}
