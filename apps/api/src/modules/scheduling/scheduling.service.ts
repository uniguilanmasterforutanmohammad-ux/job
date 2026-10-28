import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CreateAppointmentDto,
  CreateServiceDto,
  ListAppointmentsDto,
  UpdateAppointmentStatusDto,
  UpdateServiceDto,
} from './dto/service.schemas.js';

@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Services -----------------------------------------------------------

  createService(tenantId: string, dto: CreateServiceDto) {
    return this.prisma.client.service.create({ data: { tenantId, ...dto } });
  }

  listServices(tenantId: string) {
    return this.prisma.client.service.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateService(tenantId: string, id: string, dto: UpdateServiceDto) {
    await this.assertService(tenantId, id);
    return this.prisma.client.service.update({ where: { id }, data: dto });
  }

  // --- Appointments -------------------------------------------------------

  async createAppointment(tenantId: string, dto: CreateAppointmentDto) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw DomainException.notFound('مشتری');

    let duration = dto.durationMinutes ?? 60;
    let price = 0;
    if (dto.serviceId) {
      const service = await this.prisma.client.service.findFirst({
        where: { id: dto.serviceId, tenantId, deletedAt: null },
      });
      if (!service) throw DomainException.notFound('خدمت');
      duration = dto.durationMinutes ?? service.durationMinutes;
      price = Number(service.price);
    }

    const startsAt = dto.startsAt;
    const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);

    await this.assertNoConflict(tenantId, startsAt, endsAt, dto.staffId);

    return this.prisma.client.appointment.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        serviceId: dto.serviceId ?? null,
        branchId: dto.branchId ?? null,
        staffId: dto.staffId ?? null,
        startsAt,
        endsAt,
        notes: dto.notes ?? null,
        source: dto.source,
        status: 'SCHEDULED',
        meta: { price } as never,
      },
    });
  }

  listAppointments(tenantId: string, dto: ListAppointmentsDto) {
    return this.prisma.client.appointment.findMany({
      where: {
        tenantId,
        ...(dto.staffId ? { staffId: dto.staffId } : {}),
        ...(dto.customerId ? { customerId: dto.customerId } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.from || dto.to
          ? {
              startsAt: {
                ...(dto.from ? { gte: dto.from } : {}),
                ...(dto.to ? { lte: dto.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { startsAt: 'asc' },
      take: 500,
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        service: { select: { id: true, name: true } },
      },
    });
  }

  async updateStatus(tenantId: string, id: string, dto: UpdateAppointmentStatusDto) {
    await this.assertAppointment(tenantId, id);
    return this.prisma.client.appointment.update({
      where: { id },
      data: { status: dto.status, cancelReason: dto.cancelReason ?? null },
    });
  }

  private async assertNoConflict(
    tenantId: string,
    startsAt: Date,
    endsAt: Date,
    staffId?: string | null,
  ): Promise<void> {
    const conflict = await this.prisma.client.appointment.findFirst({
      where: {
        tenantId,
        ...(staffId ? { staffId } : {}),
        status: { notIn: ['CANCELED', 'NO_SHOW'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true, startsAt: true, endsAt: true },
    });
    if (conflict) {
      throw DomainException.conflict('این بازه زمانی با نوبت دیگری تداخل دارد');
    }
  }

  private async assertService(tenantId: string, id: string): Promise<void> {
    const found = await this.prisma.client.service.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw DomainException.notFound('خدمت');
  }

  private async assertAppointment(tenantId: string, id: string): Promise<void> {
    const found = await this.prisma.client.appointment.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!found) throw DomainException.notFound('نوبت');
  }
}
