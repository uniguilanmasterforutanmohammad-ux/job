import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { FinanceExtraService } from './finance-extra.service.js';
import {
  createDiscountSchema,
  createPaymentLinkSchema,
  createRefundSchema,
  debtorReportSchema,
  listRefundsSchema,
  rejectRefundSchema,
  taxReportSchema,
  validateDiscountSchema,
  walletAdjustSchema,
  walletHistorySchema,
  type CreateDiscountDto,
  type CreatePaymentLinkDto,
  type CreateRefundDto,
  type DebtorReportDto,
  type ListRefundsDto,
  type RejectRefundDto,
  type TaxReportDto,
  type ValidateDiscountDto,
  type WalletAdjustDto,
  type WalletHistoryDto,
} from './dto/finance-extra.schemas.js';

@ApiTags('finance-extra')
@Controller('finance')
@RequireModule('FIN')
export class FinanceExtraController {
  constructor(private readonly finance: FinanceExtraService) {}

  // ----- FIN-06 wallet -----

  @Post('wallet/adjust')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'شارژ/کسر کیف پول مشتری (FIN-06)' })
  walletAdjust(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(walletAdjustSchema)) dto: WalletAdjustDto,
  ) {
    return this.finance.walletAdjust(tenantId, dto);
  }

  @Get('wallet')
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'موجودی و گردش کیف پول مشتری' })
  walletHistory(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(walletHistorySchema)) dto: WalletHistoryDto,
  ) {
    return this.finance.walletHistory(tenantId, dto.customerId);
  }

  // ----- FIN-07 refunds -----

  @Post('refunds')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'ثبت درخواست استرداد (FIN-07)' })
  createRefund(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('memberId') memberId: string,
    @Body(new ZodValidationPipe(createRefundSchema)) dto: CreateRefundDto,
  ) {
    return this.finance.createRefund(tenantId, memberId, dto);
  }

  @Get('refunds')
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'فهرست استردادها' })
  listRefunds(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listRefundsSchema)) dto: ListRefundsDto,
  ) {
    return this.finance.listRefunds(tenantId, dto);
  }

  @Patch('refunds/:id/approve')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'تأیید مدیر و انجام استرداد' })
  approveRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.finance.approveRefund(user.tenantId, id, user.memberId);
  }

  @Patch('refunds/:id/reject')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'رد درخواست استرداد' })
  rejectRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectRefundSchema)) dto: RejectRefundDto,
  ) {
    return this.finance.rejectRefund(user.tenantId, id, user.memberId, dto.reason);
  }

  // ----- FIN-08 discount codes -----

  @Post('discounts')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'ایجاد کد تخفیف (FIN-08)' })
  createDiscount(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createDiscountSchema)) dto: CreateDiscountDto,
  ) {
    return this.finance.createDiscount(tenantId, dto);
  }

  @Get('discounts')
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'فهرست کدهای تخفیف' })
  listDiscounts(@CurrentUser('tenantId') tenantId: string) {
    return this.finance.listDiscounts(tenantId);
  }

  @Post('discounts/validate')
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'اعتبارسنجی کد تخفیف' })
  validateDiscount(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(validateDiscountSchema)) dto: ValidateDiscountDto,
  ) {
    return this.finance.validateDiscount(tenantId, dto);
  }

  @Delete('discounts/:id')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'غیرفعال‌سازی کد تخفیف' })
  deactivateDiscount(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.finance.deactivateDiscount(tenantId, id);
  }

  // ----- FIN-13 payment links -----

  @Post('payment-links')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'ساخت لینک پرداخت (FIN-13)' })
  createPaymentLink(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createPaymentLinkSchema)) dto: CreatePaymentLinkDto,
  ) {
    return this.finance.createPaymentLink(tenantId, dto);
  }

  @Get('payment-links')
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'فهرست لینک‌های پرداخت' })
  listPaymentLinks(@CurrentUser('tenantId') tenantId: string) {
    return this.finance.listPaymentLinks(tenantId);
  }

  @Post('payment-links/:id/send')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'ارسال پیامکی لینک پرداخت' })
  sendPaymentLink(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.finance.sendPaymentLink(tenantId, id);
  }

  // ----- FIN-05 / FIN-09 reports -----

  @Get('reports/debtors')
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'گزارش بدهکاران و معوقات (FIN-05)' })
  debtorReport(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(debtorReportSchema)) dto: DebtorReportDto,
  ) {
    return this.finance.debtorReport(tenantId, dto);
  }

  @Get('reports/tax')
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'گزارش مالیاتی (FIN-09)' })
  taxReport(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(taxReportSchema)) dto: TaxReportDto,
  ) {
    return this.finance.taxReport(tenantId, dto);
  }
}

@ApiTags('public')
@Controller('public/payment-links')
export class PublicPaymentLinkController {
  constructor(private readonly finance: FinanceExtraService) {}

  @Public()
  @Get(':token')
  @ApiOperation({ summary: 'مشاهده عمومی لینک پرداخت (FIN-13)' })
  get(@Param('token') token: string) {
    return this.finance.getPaymentLinkByToken(token);
  }
}
