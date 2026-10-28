import { Injectable, Logger } from '@nestjs/common';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CloseCashSessionDto,
  CreateExpenseDto,
  CreateInstallmentPlanDto,
  ListExpensesDto,
  ListInstallmentsDto,
  OpenCashSessionDto,
  PayInstallmentDto,
  ProfitLossDto,
} from './dto/finance-ext.schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FinanceExtService {
  private readonly logger = new Logger(FinanceExtService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ----- FIN-04 installments -----

  async createInstallmentPlan(tenantId: string, dto: CreateInstallmentPlanDto) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId, deletedAt: null },
    });
    if (!customer) throw DomainException.notFound('مشتری');

    const perInstallment = Math.floor(dto.totalAmount / dto.count);
    const remainder = dto.totalAmount - perInstallment * dto.count;

    const rows = Array.from({ length: dto.count }, (_, i) => ({
      tenantId,
      invoiceId: dto.invoiceId ?? null,
      customerId: dto.customerId,
      number: i + 1,
      amount: perInstallment + (i === dto.count - 1 ? remainder : 0),
      dueDate: new Date(dto.firstDueDate.getTime() + i * dto.intervalDays * DAY_MS),
      status: 'PENDING' as const,
    }));

    await this.prisma.client.installment.createMany({ data: rows });
    return { created: rows.length, totalAmount: dto.totalAmount };
  }

  async listInstallments(tenantId: string, dto: ListInstallmentsDto) {
    return this.prisma.client.installment.findMany({
      where: {
        tenantId,
        ...(dto.customerId ? { customerId: dto.customerId } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async payInstallment(tenantId: string, id: string, dto: PayInstallmentDto) {
    const installment = await this.prisma.client.installment.findFirst({ where: { id, tenantId } });
    if (!installment) throw DomainException.notFound('قسط');
    if (installment.status === 'PAID') throw DomainException.conflict('این قسط قبلاً پرداخت شده است');
    return this.prisma.client.installment.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), lateFee: dto.lateFee },
    });
  }

  /** Marks overdue installments (FIN-04 — optional penalty handled by caller). */
  async markOverdue(tenantId: string) {
    const result = await this.prisma.client.installment.updateMany({
      where: { tenantId, status: 'PENDING', dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });
    return { updated: result.count };
  }

  // ----- FIN-10 expenses -----

  createExpense(tenantId: string, dto: CreateExpenseDto) {
    return this.prisma.client.expense.create({
      data: {
        tenantId,
        branchId: dto.branchId ?? null,
        category: dto.category,
        title: dto.title,
        amount: dto.amount,
        spentAt: dto.spentAt ?? new Date(),
        note: dto.note ?? null,
        fileKey: dto.fileKey ?? null,
      },
    });
  }

  async listExpenses(tenantId: string, dto: ListExpensesDto) {
    const where = {
      tenantId,
      ...(dto.category ? { category: dto.category } : {}),
      ...(dto.from || dto.to
        ? { spentAt: { ...(dto.from ? { gte: dto.from } : {}), ...(dto.to ? { lte: dto.to } : {}) } }
        : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.expense.findMany({ where, ...toSkipTake(dto), orderBy: { spentAt: 'desc' } }),
      this.prisma.client.expense.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  async removeExpense(tenantId: string, id: string) {
    const expense = await this.prisma.client.expense.findFirst({ where: { id, tenantId } });
    if (!expense) throw DomainException.notFound('هزینه');
    await this.prisma.client.expense.delete({ where: { id } });
    return { message: 'هزینه حذف شد' };
  }

  // ----- FIN-12 cash sessions -----

  async openCashSession(tenantId: string, memberId: string | undefined, dto: OpenCashSessionDto) {
    const existing = await this.prisma.client.cashSession.findFirst({
      where: { tenantId, status: 'OPEN', ...(dto.branchId ? { branchId: dto.branchId } : {}) },
    });
    if (existing) throw DomainException.conflict('یک صندوق باز در این شعبه وجود دارد');
    return this.prisma.client.cashSession.create({
      data: {
        tenantId,
        branchId: dto.branchId ?? null,
        openedById: memberId ?? null,
        openingFloat: dto.openingFloat,
        expectedCash: dto.openingFloat,
        status: 'OPEN',
      },
    });
  }

  async closeCashSession(tenantId: string, id: string, dto: CloseCashSessionDto) {
    const session = await this.prisma.client.cashSession.findFirst({ where: { id, tenantId } });
    if (!session) throw DomainException.notFound('صندوق');
    if (session.status === 'CLOSED') throw DomainException.conflict('صندوق قبلاً بسته شده است');

    const cashPayments = await this.prisma.client.payment.aggregate({
      where: {
        tenantId,
        method: 'CASH',
        createdAt: { gte: session.openedAt },
        ...(session.branchId ? { invoice: { branchId: session.branchId } } : {}),
        status: 'SUCCEEDED',
      },
      _sum: { amount: true },
    });
    const expectedCash = Number(session.openingFloat) + Number(cashPayments._sum.amount ?? 0);
    const difference = dto.countedCash - expectedCash;

    return this.prisma.client.cashSession.update({
      where: { id },
      data: {
        expectedCash,
        countedCash: dto.countedCash,
        difference,
        status: 'CLOSED',
        closedAt: new Date(),
        note: dto.note ?? null,
      },
    });
  }

  listCashSessions(tenantId: string) {
    return this.prisma.client.cashSession.findMany({
      where: { tenantId },
      orderBy: { openedAt: 'desc' },
    });
  }

  // ----- FIN-11 profit & loss -----

  async profitLoss(tenantId: string, dto: ProfitLossDto) {
    const range = {
      ...(dto.from ? { gte: dto.from } : {}),
      ...(dto.to ? { lte: dto.to } : {}),
    };
    const [payments, expenses] = await this.prisma.client.$transaction([
      this.prisma.client.payment.aggregate({
        where: { tenantId, status: 'SUCCEEDED', createdAt: range },
        _sum: { amount: true },
      }),
      this.prisma.client.expense.aggregate({
        where: { tenantId, spentAt: range, ...(dto.branchId ? { branchId: dto.branchId } : {}) },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);
    const revenue = Number(payments._sum.amount ?? 0);
    const cost = Number(expenses._sum.amount ?? 0);
    return {
      revenue,
      expenses: cost,
      expenseCount: expenses._count._all,
      netProfit: revenue - cost,
      margin: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : 0,
    };
  }
}
