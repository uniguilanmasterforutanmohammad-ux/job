import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PERMISSIONS } from '@repo/shared';
import { PaymentsService } from './payments.service.js';
import {
  callbackSchema,
  createPaymentSchema,
  manualPaymentSchema,
  refundPaymentSchema,
  type CreatePaymentDto,
  type ManualPaymentDto,
  type RefundPaymentDto,
} from './dto/payment.schemas.js';

@ApiTags('payments')
@Controller('payments')
@RequireModule('FIN')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('providers')
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'فهرست درگاه‌های پرداخت فعال' })
  providers() {
    return { providers: this.payments.availableProviders() };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'فهرست پرداخت‌ها' })
  list(@CurrentUser('tenantId') tenantId: string) {
    return this.payments.listForTenant(tenantId);
  }

  @Post('online')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'شروع پرداخت آنلاین (درگاه اصلی یا حالت دولوپر)' })
  createOnline(@CurrentUser('tenantId') tenantId: string, @Body(new ZodValidationPipe(createPaymentSchema)) dto: CreatePaymentDto) {
    return this.payments.createOnlinePayment(tenantId, dto);
  }

  @Post('manual')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'ثبت پرداخت دستی (نقدی، کارت‌خوان، کارت به کارت، چک)' })
  recordManual(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('memberId') memberId: string,
    @Body(new ZodValidationPipe(manualPaymentSchema)) dto: ManualPaymentDto,
  ) {
    return this.payments.recordManualPayment(tenantId, dto, memberId);
  }

  @Post(':id/refund')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'استرداد پرداخت موفق (بازگشت موجودی سفارش مرتبط)' })
  refund(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('memberId') memberId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(refundPaymentSchema)) dto: RefundPaymentDto,
  ) {
    return this.payments.refundPayment(tenantId, id, memberId, dto.reason);
  }

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'بازگشت از درگاه پرداخت' })
  async callback(
    @Query() query: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = callbackSchema.parse(query);
    const paymentId = String(query.paymentId ?? '');
    const authority = parsed.authority ?? parsed.Authority;
    const status = parsed.status ?? parsed.Status;

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    try {
      const result = await this.payments.verifyCallback({ paymentId, authority, status });
      const orderQuery = result.orderNumber
        ? `&order=${encodeURIComponent(result.orderNumber)}`
        : '';
      return res.redirect(
        `${appUrl}/payments/result?status=success&paymentId=${result.paymentId}&ref=${result.trackingCode ?? ''}${orderQuery}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطای پرداخت';
      return res.redirect(
        `${appUrl}/payments/result?status=failed&paymentId=${paymentId}&message=${encodeURIComponent(message)}`,
      );
    }
  }
}
