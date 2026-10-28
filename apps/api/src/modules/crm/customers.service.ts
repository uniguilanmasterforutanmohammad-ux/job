import { Injectable } from '@nestjs/common';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CreateCustomerDto,
  ListCustomersDto,
  UpdateCustomerDto,
} from './dto/customer.schemas.js';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCustomerDto) {
    await this.assertBranch(tenantId, dto.branchId);

    if (dto.phone) {
      // Only visible (not soft-deleted) files occupy the phone number: a
      // deleted customer releases it, so the same person can be re-added.
      const existing = await this.prisma.client.customer.findFirst({
        where: { tenantId, phone: dto.phone, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        throw DomainException.conflict('مشتری با این شماره تماس قبلاً ثبت شده است');
      }
    }

    return this.prisma.client.customer.create({
      data: {
        tenantId,
        fullName: dto.fullName,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        type: dto.type,
        nationalId: dto.nationalId ?? null,
        birthDate: dto.birthDate ?? null,
        gender: dto.gender ?? null,
        address: dto.address ?? null,
        city: dto.city ?? null,
        source: dto.source ?? null,
        tags: dto.tags,
        leadStage: dto.leadStage,
        branchId: dto.branchId ?? null,
        notes: dto.notes ?? null,
        meta: (dto.meta ?? {}) as never,
      },
    });
  }

  async list(tenantId: string, dto: ListCustomersDto) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(dto.leadStage ? { leadStage: dto.leadStage } : {}),
      ...(dto.tag ? { tags: { has: dto.tag } } : {}),
      ...(dto.search
        ? {
            OR: [
              { fullName: { contains: dto.search, mode: 'insensitive' as const } },
              { phone: { contains: dto.search } },
              { email: { contains: dto.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.customer.findMany({
        where,
        ...toSkipTake(dto),
        orderBy: { [dto.sortBy]: dto.sortDir },
        include: { _count: { select: { appointments: true, invoices: true } } },
      }),
      this.prisma.client.customer.count({ where }),
    ]);

    return { data, meta: buildMeta(total, dto) };
  }

  async findOne(tenantId: string, id: string) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        appointments: {
          orderBy: { startsAt: 'desc' },
          take: 20,
          include: { service: true },
        },
        invoices: { orderBy: { createdAt: 'desc' }, take: 20 },
        wallet: true,
      },
    });
    if (!customer) throw DomainException.notFound('مشتری');
    return customer;
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    await this.assertExists(tenantId, id);
    await this.assertBranch(tenantId, dto.branchId ?? undefined);
    return this.prisma.client.customer.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.leadStage !== undefined ? { leadStage: dto.leadStage } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.meta !== undefined ? { meta: dto.meta as never } : {}),
      },
    });
  }

  /**
   * Soft delete keeps history for invoices and audit (CORE-05) but releases the
   * phone number: `(tenantId, phone)` is unique, so keeping it on a deleted row
   * would block re-adding the same person. The number is archived in `meta`.
   */
  async remove(tenantId: string, id: string) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, phone: true, meta: true },
    });
    if (!customer) throw DomainException.notFound('مشتری');

    const meta = (customer.meta ?? {}) as Record<string, unknown>;
    await this.prisma.client.customer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        phone: null,
        meta: { ...meta, archivedPhone: customer.phone ?? null } as never,
      },
    });
    return { message: 'مشتری حذف شد' };
  }

  private async assertExists(tenantId: string, id: string): Promise<void> {
    const found = await this.prisma.client.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw DomainException.notFound('مشتری');
  }

  /**
   * A branch id always comes from the client, so it must be proven to belong to
   * the same tenant before it is written (multi-tenant isolation).
   */
  private async assertBranch(tenantId: string, branchId?: string): Promise<void> {
    if (!branchId) return;
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: branchId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!branch) throw DomainException.badRequest('شعبه انتخاب‌شده معتبر نیست', 'INVALID_BRANCH');
  }
}
