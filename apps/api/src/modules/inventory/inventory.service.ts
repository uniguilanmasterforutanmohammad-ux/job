import { Injectable, Logger } from '@nestjs/common';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CreateMovementDto,
  CreateProductDto,
  CreateSupplierDto,
  ListMovementsDto,
  ListProductsDto,
  StockCountDto,
  TransferStockDto,
  UpdateProductDto,
} from './dto/inventory.schemas.js';

/** Signs a stock movement so `stock` on the product always stays consistent. */
const INBOUND: ReadonlySet<string> = new Set(['PURCHASE', 'TRANSFER_IN', 'ADJUSTMENT']);

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ----- Suppliers -----

  createSupplier(tenantId: string, dto: CreateSupplierDto) {
    return this.prisma.client.supplier.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        address: dto.address ?? null,
        note: dto.note ?? null,
      },
    });
  }

  listSuppliers(tenantId: string) {
    return this.prisma.client.supplier.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  // ----- Products (INV-01) -----

  createProduct(tenantId: string, dto: CreateProductDto) {
    return this.prisma.client.product.create({
      data: {
        tenantId,
        sku: dto.sku ?? null,
        name: dto.name,
        unit: dto.unit,
        category: dto.category ?? null,
        costPrice: dto.costPrice,
        salePrice: dto.salePrice,
        minStock: dto.minStock,
        barcode: dto.barcode ?? null,
        imageUrl: dto.imageUrl ?? null,
        trackExpiry: dto.trackExpiry,
        isActive: dto.isActive,
      },
    });
  }

  async listProducts(tenantId: string, dto: ListProductsDto) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(dto.category ? { category: dto.category } : {}),
      ...(dto.search
        ? {
            OR: [
              { name: { contains: dto.search, mode: 'insensitive' as const } },
              { sku: { contains: dto.search } },
              { barcode: { contains: dto.search } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.product.findMany({ where, ...toSkipTake(dto), orderBy: { name: 'asc' } }),
      this.prisma.client.product.count({ where }),
    ]);
    const data = rows.map((row) => ({ ...row, lowStock: Number(row.stock) <= Number(row.minStock) }));
    const filtered = dto.lowStock ? data.filter((row) => row.lowStock) : data;
    return { data: filtered, meta: buildMeta(total, dto) };
  }

  private async findProduct(tenantId: string, id: string) {
    const product = await this.prisma.client.product.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!product) throw DomainException.notFound('کالا');
    return product;
  }

  async updateProduct(tenantId: string, id: string, dto: UpdateProductDto) {
    await this.findProduct(tenantId, id);
    return this.prisma.client.product.update({ where: { id }, data: dto });
  }

  async removeProduct(tenantId: string, id: string) {
    await this.findProduct(tenantId, id);
    await this.prisma.client.product.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'کالا حذف شد' };
  }

  async findByBarcode(tenantId: string, barcode: string) {
    const product = await this.prisma.client.product.findFirst({
      where: { tenantId, barcode, deletedAt: null },
    });
    if (!product) throw DomainException.notFound('کالا');
    return product;
  }

  // ----- Stock movements (INV-04/05/06) -----

  async createMovement(tenantId: string, dto: CreateMovementDto) {
    await this.findProduct(tenantId, dto.productId);
    const signed = INBOUND.has(dto.type) ? Math.abs(dto.quantity) : -Math.abs(dto.quantity);

    return this.prisma.client.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          branchId: dto.branchId ?? null,
          type: dto.type,
          quantity: dto.type === 'ADJUSTMENT' ? dto.quantity : signed,
          unitCost: dto.unitCost,
          lotNumber: dto.lotNumber ?? null,
          expiresAt: dto.expiresAt ?? null,
          supplierId: dto.supplierId ?? null,
          reference: dto.reference ?? null,
          note: dto.note ?? null,
        },
      });

      const delta =
        dto.type === 'ADJUSTMENT' ? dto.quantity : signed; // adjustment carries the delta directly
      const updated = await tx.product.update({
        where: { id: dto.productId },
        data: { stock: { increment: delta } },
      });
      return { movement, stock: updated.stock, lowStock: Number(updated.stock) <= Number(updated.minStock) };
    });
  }

  async listMovements(tenantId: string, dto: ListMovementsDto) {
    const where = {
      tenantId,
      ...(dto.productId ? { productId: dto.productId } : {}),
      ...(dto.type ? { type: dto.type } : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.stockMovement.findMany({
        where,
        ...toSkipTake(dto),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.stockMovement.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  /** INV-03 — products at or below the configured minimum. */
  async lowStock(tenantId: string) {
    const products = await this.prisma.client.product.findMany({
      where: { tenantId, deletedAt: null, isActive: true },
    });
    return products
      .filter((p) => Number(p.stock) <= Number(p.minStock))
      .map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock,
        suggestedOrder: Math.max(0, Number(p.minStock) * 2 - Number(p.stock)),
      }));
  }

  /** INV-06 — expiring lots within the given window (default 30 days). */
  async expiring(tenantId: string, days = 30) {
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return this.prisma.client.stockMovement.findMany({
      where: {
        tenantId,
        expiresAt: { not: null, lte: until },
        type: { in: ['PURCHASE', 'TRANSFER_IN'] },
      },
      orderBy: { expiresAt: 'asc' },
    });
  }

  /** INV-02 — transfer between branches (paired out/in movements). */
  async transfer(tenantId: string, dto: TransferStockDto) {
    if (dto.fromBranchId === dto.toBranchId) {
      throw DomainException.badRequest('شعبه مبدأ و مقصد یکسان است');
    }
    await this.findProduct(tenantId, dto.productId);
    return this.prisma.client.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          branchId: dto.fromBranchId,
          type: 'TRANSFER_OUT',
          quantity: -Math.abs(dto.quantity),
          note: dto.note ?? null,
        },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          branchId: dto.toBranchId,
          type: 'TRANSFER_IN',
          quantity: Math.abs(dto.quantity),
          note: dto.note ?? null,
        },
      });
      return { message: 'انتقال ثبت شد', quantity: dto.quantity };
    });
  }

  /** INV-08 — stock count reconciliation. */
  async reconcile(tenantId: string, dto: StockCountDto) {
    const product = await this.findProduct(tenantId, dto.productId);
    const delta = dto.counted - Number(product.stock);
    return this.prisma.client.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          type: 'ADJUSTMENT',
          quantity: delta,
          note: dto.note ?? 'انبارگردانی',
        },
      });
      const updated = await tx.product.update({
        where: { id: dto.productId },
        data: { stock: dto.counted },
      });
      return { product: updated, difference: delta };
    });
  }
}
