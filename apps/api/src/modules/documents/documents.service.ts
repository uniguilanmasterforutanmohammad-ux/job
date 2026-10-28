import { Injectable, Logger } from '@nestjs/common';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { renderTemplate } from '../messaging/template.service.js';
import type {
  CreateContractDto,
  CreateContractTemplateDto,
  CreateDocumentDto,
  ListContractsDto,
  ListDocumentsDto,
  SignContractDto,
  UpdateContractStatusDto,
  UpdateContractTemplateDto,
} from './dto/document.schemas.js';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ----- DOC-01 templates -----

  createTemplate(tenantId: string, dto: CreateContractTemplateDto) {
    return this.prisma.client.contractTemplate.create({
      data: { tenantId, title: dto.title, body: dto.body, isActive: dto.isActive },
    });
  }

  listTemplates(tenantId: string) {
    return this.prisma.client.contractTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findTemplate(tenantId: string, id: string) {
    const template = await this.prisma.client.contractTemplate.findFirst({ where: { id, tenantId } });
    if (!template) throw DomainException.notFound('قالب قرارداد');
    return template;
  }

  async updateTemplate(tenantId: string, id: string, dto: UpdateContractTemplateDto) {
    await this.findTemplate(tenantId, id);
    return this.prisma.client.contractTemplate.update({ where: { id }, data: dto });
  }

  async removeTemplate(tenantId: string, id: string) {
    await this.findTemplate(tenantId, id);
    await this.prisma.client.contractTemplate.delete({ where: { id } });
    return { message: 'قالب حذف شد' };
  }

  // ----- DOC-02/05 contracts -----

  async createContract(tenantId: string, dto: CreateContractDto) {
    let body = dto.body ?? null;
    let title = dto.title;
    if (dto.templateId) {
      const template = await this.findTemplate(tenantId, dto.templateId);
      title = dto.title || template.title;
      body = body ?? renderTemplate(template.body, dto.variables ?? {});
    }
    if (!body) body = renderTemplate(dto.title, dto.variables ?? {});

    if (dto.customerId) {
      const customer = await this.prisma.client.customer.findFirst({
        where: { id: dto.customerId, tenantId, deletedAt: null },
      });
      if (!customer) throw DomainException.notFound('مشتری');
      if (dto.variables) {
        body = renderTemplate(body, { customerName: customer.fullName, ...dto.variables });
      }
    }

    return this.prisma.client.contract.create({
      data: {
        tenantId,
        customerId: dto.customerId ?? null,
        templateId: dto.templateId ?? null,
        title,
        body,
        amount: dto.amount ?? null,
        expiresAt: dto.expiresAt ?? null,
        status: 'DRAFT',
      },
    });
  }

  async listContracts(tenantId: string, dto: ListContractsDto) {
    const where = {
      tenantId,
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.customerId ? { customerId: dto.customerId } : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.contract.findMany({ where, ...toSkipTake(dto), orderBy: { createdAt: 'desc' } }),
      this.prisma.client.contract.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  private async findContract(tenantId: string, id: string) {
    const contract = await this.prisma.client.contract.findFirst({ where: { id, tenantId } });
    if (!contract) throw DomainException.notFound('قرارداد');
    return contract;
  }

  /** DOC-02 — e-signature on mobile/digital. */
  async sign(tenantId: string, id: string, dto: SignContractDto) {
    const contract = await this.findContract(tenantId, id);
    if (contract.status === 'SIGNED') throw DomainException.conflict('قرارداد قبلاً امضا شده است');
    return this.prisma.client.contract.update({
      where: { id },
      data: { status: 'SIGNED', signatureKey: dto.signatureKey, signedAt: new Date() },
    });
  }

  async updateStatus(tenantId: string, id: string, dto: UpdateContractStatusDto) {
    await this.findContract(tenantId, id);
    return this.prisma.client.contract.update({ where: { id }, data: { status: dto.status } });
  }

  /** DOC-04 — documents / certificates nearing expiry. */
  async expiring(tenantId: string, days = 30) {
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const [documents, contracts] = await this.prisma.client.$transaction([
      this.prisma.client.document.findMany({
        where: { tenantId, expiresAt: { not: null, lte: until } },
        orderBy: { expiresAt: 'asc' },
      }),
      this.prisma.client.contract.findMany({
        where: { tenantId, expiresAt: { not: null, lte: until }, status: { notIn: ['SIGNED', 'CANCELED'] } },
        orderBy: { expiresAt: 'asc' },
      }),
    ]);
    return { documents, contracts };
  }

  // ----- DOC-03 archive -----

  createDocument(tenantId: string, dto: CreateDocumentDto) {
    return this.prisma.client.document.create({
      data: {
        tenantId,
        customerId: dto.customerId ?? null,
        title: dto.title,
        category: dto.category ?? null,
        fileKey: dto.fileKey,
        mimeType: dto.mimeType ?? null,
        size: dto.size ?? null,
        expiresAt: dto.expiresAt ?? null,
      },
    });
  }

  async listDocuments(tenantId: string, dto: ListDocumentsDto) {
    const where = {
      tenantId,
      ...(dto.customerId ? { customerId: dto.customerId } : {}),
      ...(dto.category ? { category: dto.category } : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.document.findMany({ where, ...toSkipTake(dto), orderBy: { createdAt: 'desc' } }),
      this.prisma.client.document.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  async removeDocument(tenantId: string, id: string) {
    const doc = await this.prisma.client.document.findFirst({ where: { id, tenantId } });
    if (!doc) throw DomainException.notFound('سند');
    await this.prisma.client.document.delete({ where: { id } });
    return { message: 'سند حذف شد' };
  }
}
