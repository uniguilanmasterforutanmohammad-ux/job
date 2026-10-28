import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateTemplateDto } from './dto/message.schemas.js';

/**
 * Renders `{{variable}}` placeholders in message templates.
 * Unknown variables are left intact so operators notice the gap.
 */
export function renderTemplate(body: string, variables: Record<string, string> = {}): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    return key in variables ? variables[key] : match;
  });
}

@Injectable()
export class MessageTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateTemplateDto) {
    const existing = await this.prisma.client.messageTemplate.findUnique({
      where: { tenantId_key: { tenantId, key: dto.key } },
    });
    if (existing) throw DomainException.conflict('قالب با این کلید قبلاً ثبت شده است');

    return this.prisma.client.messageTemplate.create({ data: { tenantId, ...dto } });
  }

  list(tenantId: string) {
    return this.prisma.client.messageTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const template = await this.prisma.client.messageTemplate.findFirst({ where: { id, tenantId } });
    if (!template) throw DomainException.notFound('قالب پیام');
    return template;
  }

  async getByKey(tenantId: string, key: string) {
    return this.prisma.client.messageTemplate.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
  }

  async update(tenantId: string, id: string, dto: Partial<CreateTemplateDto>) {
    await this.findOne(tenantId, id);
    return this.prisma.client.messageTemplate.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.client.messageTemplate.delete({ where: { id } });
    return { message: 'قالب حذف شد' };
  }

  /** Seeds the standard template set referenced across the PRD. */
  async seedDefaults(tenantId: string) {
    const defaults = [
      { key: 'appointment_reminder', title: 'یادآور نوبت', body: '{{customerName}} عزیز، یادآوری نوبت شما در {{date}} ساعت {{time}}.' },
      { key: 'appointment_canceled', title: 'لغو نوبت', body: '{{customerName}} عزیز، نوبت شما در {{date}} لغو شد.' },
      { key: 'payment_due', title: 'یادآور پرداخت', body: '{{customerName}} عزیز، مبلغ {{amount}} سررسید شده است.' },
      { key: 'payment_received', title: 'تأیید پرداخت', body: '{{customerName}} عزیز، پرداخت {{amount}} دریافت شد. کد پیگیری: {{ref}}' },
      { key: 'birthday', title: 'تبریک تولد', body: '{{customerName}} عزیز، تولدتان مبارک!' },
      { key: 'closed_day', title: 'تعطیلی', body: 'کسب‌وکار در تاریخ {{date}} تعطیل است.' },
      { key: 'discount', title: 'تخفیف', body: '{{customerName}} عزیز، از تخفیف ویژه ما بهره‌مند شوید.' },
    ];

    let created = 0;
    for (const item of defaults) {
      const exists = await this.getByKey(tenantId, item.key);
      if (!exists) {
        await this.prisma.client.messageTemplate.create({
          data: { tenantId, channel: 'SMS', ...item },
        });
        created += 1;
      }
    }
    return { created };
  }
}
