import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CrmExtService } from './crm-ext.service.js';
import type { CsvImportDto, HistoryQueryDto, PublicLeadFormDto } from './dto/crm-extra.schemas.js';

/** CRM-02 history, CRM-06 CSV parsing and CRM-07 public intake. */
@Injectable()
export class CrmExtraService {
  private readonly logger = new Logger(CrmExtraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crm: CrmExtService,
  ) {}

  /** CRM-02 — unified timeline: services, invoices, payments, notes, messages, files. */
  async fullHistory(tenantId: string, customerId: string, dto: HistoryQueryDto) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
      include: { wallet: true },
    });
    if (!customer) throw DomainException.notFound('مشتری');

    const [appointments, invoices, payments, messages, documents, chats] =
      await this.prisma.client.$transaction([
        this.prisma.client.appointment.findMany({
          where: { tenantId, customerId },
          include: { service: { select: { name: true } } },
          orderBy: { startsAt: 'desc' },
          take: dto.limit,
        }),
        this.prisma.client.invoice.findMany({
          where: { tenantId, customerId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: dto.limit,
        }),
        this.prisma.client.payment.findMany({
          where: { tenantId, customerId },
          orderBy: { createdAt: 'desc' },
          take: dto.limit,
        }),
        this.prisma.client.message.findMany({
          where: { tenantId, customerId },
          orderBy: { createdAt: 'desc' },
          take: dto.limit,
        }),
        this.prisma.client.document.findMany({
          where: { tenantId, customerId },
          orderBy: { createdAt: 'desc' },
          take: dto.limit,
        }),
        this.prisma.client.chatMessage.findMany({
          where: { tenantId, customerId },
          orderBy: { createdAt: 'desc' },
          take: dto.limit,
        }),
      ]);

    const timeline = [
      ...appointments.map((a) => ({
        type: 'appointment' as const,
        at: a.startsAt,
        title: a.service?.name ?? 'نوبت',
        status: a.status,
        refId: a.id,
      })),
      ...invoices.map((i) => ({
        type: 'invoice' as const,
        at: i.createdAt,
        title: `فاکتور ${i.number}`,
        amount: Number(i.total),
        status: i.status,
        refId: i.id,
      })),
      ...payments.map((p) => ({
        type: 'payment' as const,
        at: p.createdAt,
        title: `پرداخت ${p.method}`,
        amount: Number(p.amount),
        status: p.status,
        refId: p.id,
      })),
      ...messages.map((m) => ({
        type: 'message' as const,
        at: m.createdAt,
        title: m.subject ?? `پیام ${m.channel}`,
        status: m.status,
        refId: m.id,
      })),
      ...documents.map((d) => ({
        type: 'document' as const,
        at: d.createdAt,
        title: d.title,
        refId: d.id,
      })),
      ...chats.map((c) => ({
        type: 'chat' as const,
        at: c.createdAt,
        title: c.body ?? 'فایل',
        refId: c.id,
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const paid = payments.reduce(
      (s, p) => (p.status === 'SUCCEEDED' ? s + Number(p.amount) : s),
      0,
    );
    const owed = invoices.reduce((s, i) => s + (Number(i.total) - Number(i.paidTotal)), 0);

    return {
      customer: {
        ...customer,
        wallet: customer.wallet ? { balance: Number(customer.wallet.balance) } : null,
      },
      summary: {
        totalPaid: paid,
        outstanding: Math.max(0, owed),
        appointments: appointments.length,
      },
      timeline,
    };
  }

  /**
   * CRM-06 — parses a raw CSV string (with a header row) and imports rows.
   * Handles quoted fields and both `,` and `;` delimiters. Excel files should
   * be exported to CSV client-side first.
   */
  async importCsv(tenantId: string, dto: CsvImportDto) {
    const rows = parseCsv(dto.csv);
    if (rows.length < 2) throw DomainException.badRequest('فایل CSV خالی یا نامعتبر است');

    const header = rows[0].map((h) => h.trim());
    const mapping = dto.mapping ?? autoMap(header);
    const dataRows: Record<string, unknown>[] = [];

    for (const cells of rows.slice(1)) {
      const record: Record<string, string> = {};
      header.forEach((key, idx) => {
        record[key] = (cells[idx] ?? '').trim();
      });
      const mapped: Record<string, unknown> = {};
      for (const [field, column] of Object.entries(mapping)) {
        const raw = record[column];
        if (!raw) continue;
        if (field === 'tags')
          mapped.tags = raw
            .split(/[|،,]/)
            .map((t) => t.trim())
            .filter(Boolean);
        else mapped[field] = raw;
      }
      if (!mapped.fullName) continue;
      if (mapped.phone && !/^09\d{9}$/.test(String(mapped.phone))) delete mapped.phone;
      dataRows.push(mapped);
    }

    if (!dataRows.length) throw DomainException.badRequest('هیچ ردیف معتبری در فایل یافت نشد');

    const result = await this.crm.bulkImport(tenantId, {
      rows: dataRows as never,
      skipDuplicates: dto.skipDuplicates,
    });
    this.logger.log(`CSV import tenant=${tenantId} ${JSON.stringify(result)}`);
    return { ...result, parsed: dataRows.length, headers: header };
  }

  /** CRM-07 — public lead form submission (creates a customer marked as a lead). */
  async submitPublicLeadForm(tenantId: string, dto: PublicLeadFormDto) {
    const tenant = await this.prisma.client.tenant.findFirst({
      where: { id: tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!tenant) throw DomainException.notFound('کسب‌وکار');

    const existing = await this.prisma.client.customer.findFirst({
      where: { tenantId, phone: dto.phone, deletedAt: null },
      select: { id: true, notes: true },
    });
    if (existing) {
      return this.prisma.client.customer.update({
        where: { id: existing.id },
        data: { leadStage: 'LEAD', notes: dto.message ?? existing.notes },
      });
    }
    return this.prisma.client.customer.create({
      data: {
        tenantId,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email ?? null,
        city: dto.city ?? null,
        source: dto.source,
        leadStage: 'LEAD',
        notes: dto.message ?? null,
      },
    });
  }
}

/** Minimal RFC-4180-ish CSV parser (quotes + comma/semicolon). */
function parseCsv(input: string): string[][] {
  const text = input.replace(/\r\n?/g, '\n').trim();
  const delimiter =
    (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0)
      ? ';'
      : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length));
}

const FIELD_ALIASES: Record<string, string> = {
  name: 'fullName',
  نام: 'fullName',
  fullname: 'fullName',
  'full name': 'fullName',
  phone: 'phone',
  mobile: 'phone',
  موبایل: 'phone',
  تلفن: 'phone',
  email: 'email',
  ایمیل: 'email',
  city: 'city',
  شهر: 'city',
  tags: 'tags',
  برچسب: 'tags',
  notes: 'notes',
  یادداشت: 'notes',
};

function autoMap(header: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const column of header) {
    const field = FIELD_ALIASES[column.trim().toLowerCase()];
    if (field && !mapping[field]) mapping[field] = column;
  }
  return mapping;
}
