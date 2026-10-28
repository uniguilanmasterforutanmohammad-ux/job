import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { AssignServiceDto } from './dto/staff-extra.schemas.js';

/** HR-05 — staff ↔ service assignment and fair appointment routing. */
@Injectable()
export class StaffExtraService {
  constructor(private readonly prisma: PrismaService) {}

  async assignService(tenantId: string, staffId: string, dto: AssignServiceDto) {
    const staff = await this.prisma.client.staffProfile.findFirst({
      where: { id: staffId, tenantId, deletedAt: null },
    });
    if (!staff) throw DomainException.notFound('کارمند');
    const service = await this.prisma.client.service.findFirst({
      where: { id: dto.serviceId, tenantId, deletedAt: null },
    });
    if (!service) throw DomainException.notFound('خدمت');

    return this.prisma.client.staffService.upsert({
      where: { staffId_serviceId: { staffId, serviceId: dto.serviceId } },
      update: { isPrimary: dto.isPrimary },
      create: { tenantId, staffId, serviceId: dto.serviceId, isPrimary: dto.isPrimary },
    });
  }

  async listServices(tenantId: string, staffId: string) {
    const rows = await this.prisma.client.staffService.findMany({
      where: { tenantId, staffId },
    });
    if (!rows.length) return [];
    const services = await this.prisma.client.service.findMany({
      where: { tenantId, id: { in: rows.map((r) => r.serviceId) } },
      select: { id: true, name: true, durationMinutes: true, price: true },
    });
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    return rows.map((r) => ({ ...r, service: serviceMap.get(r.serviceId) ?? null }));
  }

  async removeService(tenantId: string, staffId: string, serviceId: string) {
    const row = await this.prisma.client.staffService.findFirst({
      where: { tenantId, staffId, serviceId },
    });
    if (!row) throw DomainException.notFound('نگاشت کارمند-خدمت');
    await this.prisma.client.staffService.delete({ where: { id: row.id } });
    return { message: 'نگاشت حذف شد' };
  }

  /** HR-05 — orders qualified staff by upcoming load for fair assignment. */
  async suggestStaff(tenantId: string, serviceId: string, at: Date) {
    const links = await this.prisma.client.staffService.findMany({
      where: { tenantId, serviceId },
      include: { },
    });
    const staffIds = links.map((l) => l.staffId);
    if (!staffIds.length) {
      const fallback = await this.prisma.client.staffProfile.findMany({
        where: { tenantId, isActive: true, deletedAt: null },
        select: { id: true, fullName: true },
      });
      return fallback.map((s) => ({ ...s, load: 0, qualified: false }));
    }

    const staff = await this.prisma.client.staffProfile.findMany({
      where: { tenantId, id: { in: staffIds }, isActive: true, deletedAt: null },
      select: { id: true, fullName: true },
    });

    const dayStart = new Date(at);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const loads = await this.prisma.client.appointment.groupBy({
      by: ['staffId'],
      where: { tenantId, staffId: { in: staffIds }, startsAt: { gte: dayStart, lt: dayEnd }, status: { notIn: ['CANCELED', 'NO_SHOW'] } },
      _count: { _all: true },
    });
    const loadMap = new Map(loads.map((l) => [l.staffId, l._count._all]));

    return staff
      .map((s) => ({ ...s, load: loadMap.get(s.id) ?? 0, qualified: true }))
      .sort((a, b) => a.load - b.load);
  }
}
