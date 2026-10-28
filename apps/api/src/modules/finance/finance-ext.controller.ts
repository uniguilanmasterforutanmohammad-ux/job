import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { FinanceExtService } from './finance-ext.service.js';
import {
  closeCashSessionSchema,
  createExpenseSchema,
  createInstallmentPlanSchema,
  listExpensesSchema,
  listInstallmentsSchema,
  openCashSessionSchema,
  payInstallmentSchema,
  profitLossSchema,
  type CloseCashSessionDto,
  type CreateExpenseDto,
  type CreateInstallmentPlanDto,
  type ListExpensesDto,
  type ListInstallmentsDto,
  type OpenCashSessionDto,
  type PayInstallmentDto,
  type ProfitLossDto,
} from './dto/finance-ext.schemas.js';

@ApiTags('finance-ext')
@Controller('finance')
@RequireModule('FIN')
export class FinanceExtController {
  constructor(private readonly finance: FinanceExtService) {}

  @Post('installments/plans')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'ایجاد جدول اقساط (FIN-04)' })
  createPlan(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createInstallmentPlanSchema)) dto: CreateInstallmentPlanDto,
  ) {
    return this.finance.createInstallmentPlan(tenantId, dto);
  }

  @Get('installments')
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'فهرست اقساط' })
  listInstallments(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listInstallmentsSchema)) dto: ListInstallmentsDto,
  ) {
    return this.finance.listInstallments(tenantId, dto);
  }

  @Post('installments/:id/pay')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'پرداخت قسط' })
  payInstallment(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(payInstallmentSchema)) dto: PayInstallmentDto,
  ) {
    return this.finance.payInstallment(tenantId, id, dto);
  }

  @Post('installments/mark-overdue')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'علامت‌گذاری اقساط معوق' })
  markOverdue(@CurrentUser('tenantId') tenantId: string) {
    return this.finance.markOverdue(tenantId);
  }

  @Post('expenses')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'ثبت هزینه (FIN-10)' })
  createExpense(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createExpenseSchema)) dto: CreateExpenseDto,
  ) {
    return this.finance.createExpense(tenantId, dto);
  }

  @Get('expenses')
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'فهرست هزینه‌ها' })
  listExpenses(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listExpensesSchema)) dto: ListExpensesDto,
  ) {
    return this.finance.listExpenses(tenantId, dto);
  }

  @Delete('expenses/:id')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'حذف هزینه' })
  removeExpense(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.finance.removeExpense(tenantId, id);
  }

  @Post('cash-sessions/open')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'باز کردن صندوق (FIN-12)' })
  openCash(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(openCashSessionSchema)) dto: OpenCashSessionDto,
  ) {
    return this.finance.openCashSession(user.tenantId, user.memberId, dto);
  }

  @Post('cash-sessions/:id/close')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'بستن صندوق و مغایرت‌گیری' })
  closeCash(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(closeCashSessionSchema)) dto: CloseCashSessionDto,
  ) {
    return this.finance.closeCashSession(tenantId, id, dto);
  }

  @Get('cash-sessions')
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'فهرست صندوق‌ها' })
  listCash(@CurrentUser('tenantId') tenantId: string) {
    return this.finance.listCashSessions(tenantId);
  }

  @Get('profit-loss')
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'گزارش سود و زیان (FIN-11)' })
  profitLoss(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(profitLossSchema)) dto: ProfitLossDto,
  ) {
    return this.finance.profitLoss(tenantId, dto);
  }
}
