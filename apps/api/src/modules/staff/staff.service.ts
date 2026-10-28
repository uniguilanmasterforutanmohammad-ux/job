import { Injectable, Logger } from '@nestjs/common';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CreateLeaveDto,
  CreateStaffDto,
  GeneratePayrollDto,
  ListStaffDto,
  ReviewLeaveDto,
  UpdatePayrollDto,
  UpdateStaffDto,
} from './dto/staff.schemas.js';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ----- HR-01 profile -----

  create(tenantId: string, dto: CreateStaffDto) {
    return this.prisma.client.staffProfile.create({
      data: {
        tenantId,
        memberId: dto.memberId ?? null,
        fullName: dto.fullName,
        phone: dto.phone ?? null,
        position: dto.position ?? null,
        contractType: dto.contractType ?? null,
        baseSalary: dto.baseSalary,
        commissionRate: dto.commissionRate,
        hireDate: dto.hireDate ?? null,
        nationalId: dto.nationalId ?? null,
        certifications: dto.certifications as never,
        isActive: dto.isActive,
      },
    });
  }

  async list(tenantId: string, dto: ListStaffDto) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
      ...(dto.search
        ? {
            OR: [
              { fullName: { contains: dto.search, mode: 'insensitive' as const } },
              { phone: { contains: dto.search } },
              { position: { contains: dto.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.staffProfile.findMany({ where, ...toSkipTake(dto), orderBy: { fullName: 'asc' } }),
      this.prisma.client.staffProfile.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  private async findOne(tenantId: string, id: string) {
    const staff = await this.prisma.client.staffProfile.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!staff) throw DomainException.notFound('کارمند');
    return staff;
  }

  async update(tenantId: string, id: string, dto: UpdateStaffDto) {
    await this.findOne(tenantId, id);
    return this.prisma.client.staffProfile.update({
      where: { id },
      data: { ...dto, certifications: dto.certifications as never },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.client.staffProfile.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'کارمند حذف شد' };
  }

  /** HR-04 — scorecard: appointments, revenue, satisfaction. */
  async scorecard(tenantId: string, id: string, from?: Date, to?: Date) {
    const staff = await this.findOne(tenantId, id);
    const range = { gte: from ?? new Date(0), lte: to ?? new Date() };
    const appointments = staff.memberId
      ? await this.prisma.client.appointment.findMany({
          where: {
            tenantId,
            staffId: staff.memberId,
            startsAt: range,
            status: 'COMPLETED',
          },
          include: { service: true },
        })
      : [];
    const revenue = appointments.reduce((sum, a) => sum + Number(a.service?.price ?? 0), 0);
    const reviews = await this.prisma.client.review.aggregate({
      where: { tenantId },
      _avg: { rating: true },
    });
    return {
      staff: { id: staff.id, fullName: staff.fullName },
      completedAppointments: appointments.length,
      revenue,
      averageRating: reviews._avg.rating ?? null,
    };
  }

  // ----- HR-03 leave -----

  createLeave(tenantId: string, dto: CreateLeaveDto) {
    if (dto.toDate < dto.fromDate) throw DomainException.badRequest('بازه تاریخ نامعتبر است');
    return this.prisma.client.leaveRequest.create({
      data: {
        tenantId,
        staffId: dto.staffId,
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        reason: dto.reason ?? null,
      },
    });
  }

  listLeaves(tenantId: string, staffId?: string, status?: string) {
    return this.prisma.client.leaveRequest.findMany({
      where: {
        tenantId,
        ...(staffId ? { staffId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewLeave(tenantId: string, id: string, dto: ReviewLeaveDto, reviewerId?: string) {
    const leave = await this.prisma.client.leaveRequest.findFirst({ where: { id, tenantId } });
    if (!leave) throw DomainException.notFound('درخواست مرخصی');
    return this.prisma.client.leaveRequest.update({
      where: { id },
      data: { status: dto.status, reviewedBy: reviewerId ?? null, reviewedAt: new Date() },
    });
  }

  // ----- HR-02/06 payroll -----

  /** Generates draft payroll for all active staff in a period. */
  async generatePayroll(tenantId: string, dto: GeneratePayrollDto) {
    if (dto.periodEnd < dto.periodStart) throw DomainException.badRequest('بازه تاریخ نامعتبر است');
    const staff = await this.prisma.client.staffProfile.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
    });

    const created: string[] = [];
    for (const profile of staff) {
      const commission = await this.commissionFor(tenantId, profile, dto.periodStart, dto.periodEnd);
      const base = Number(profile.baseSalary);
      const entry = await this.prisma.client.payrollEntry.create({
        data: {
          tenantId,
          staffId: profile.id,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
          baseSalary: base,
          commission,
          netPay: base + commission,
          status: 'DRAFT',
        },
      });
      created.push(entry.id);
    }
    this.logger.log(`Payroll generated tenant=${tenantId} entries=${created.length}`);
    return { created: created.length, ids: created };
  }

  private async commissionFor(
    tenantId: string,
    profile: { memberId: string | null; commissionRate: unknown },
    from: Date,
    to: Date,
  ): Promise<number> {
    const rate = Number(profile.commissionRate);
    if (!profile.memberId || rate <= 0) return 0;
    const appointments = await this.prisma.client.appointment.findMany({
      where: { tenantId, staffId: profile.memberId, startsAt: { gte: from, lte: to }, status: 'COMPLETED' },
      include: { service: true },
    });
    const revenue = appointments.reduce((sum, a) => sum + Number(a.service?.price ?? 0), 0);
    return Math.round((revenue * rate) / 100);
  }

  listPayroll(tenantId: string, staffId?: string) {
    return this.prisma.client.payrollEntry.findMany({
      where: { tenantId, ...(staffId ? { staffId } : {}) },
      orderBy: { periodStart: 'desc' },
    });
  }

  async updatePayroll(tenantId: string, id: string, dto: UpdatePayrollDto) {
    const entry = await this.prisma.client.payrollEntry.findFirst({ where: { id, tenantId } });
    if (!entry) throw DomainException.notFound('فیش حقوقی');
    const base = Number(entry.baseSalary);
    const commission = Number(entry.commission);
    const bonus = dto.bonus ?? Number(entry.bonus);
    const deductions = dto.deductions ?? Number(entry.deductions);
    return this.prisma.client.payrollEntry.update({
      where: { id },
      data: {
        bonus,
        deductions,
        netPay: base + commission + bonus - deductions,
        status: dto.status ?? entry.status,
        paidAt: dto.status === 'PAID' ? new Date() : entry.paidAt,
      },
    });
  }
}
