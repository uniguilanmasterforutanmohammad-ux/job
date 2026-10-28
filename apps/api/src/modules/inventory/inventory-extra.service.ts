import { Injectable } from '@nestjs/common';
import { toDataURL } from 'qrcode';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';

/** INV-07 — barcode/QR generation for products (labels + scan sheets). */
@Injectable()
export class InventoryExtraService {
  constructor(private readonly prisma: PrismaService) {}

  /** Generates a QR code (data URL) for a product — used for shelf labels. */
  async productQr(tenantId: string, id: string) {
    const product = await this.prisma.client.product.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!product) throw DomainException.notFound('کالا');

    // The QR encodes the tenant-scoped SKU/barcode so any scanner can resolve it.
    const payload = JSON.stringify({
      t: tenantId,
      id: product.id,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
    });
    const dataUrl = await toDataURL(payload, { width: 320, margin: 1 });
    return { id: product.id, name: product.name, sku: product.sku, barcode: product.barcode, qr: dataUrl };
  }

  /** QR sheet for a batch of products (label printing). */
  async productQrSheet(tenantId: string, ids: string[]) {
    const products = await this.prisma.client.product.findMany({
      where: { tenantId, id: { in: ids }, deletedAt: null },
    });
    return Promise.all(
      products.map(async (p) => ({
        id: p.id,
        name: p.name,
        qr: await toDataURL(JSON.stringify({ t: tenantId, id: p.id, sku: p.sku }), {
          width: 200,
          margin: 1,
        }),
      })),
    );
  }
}
