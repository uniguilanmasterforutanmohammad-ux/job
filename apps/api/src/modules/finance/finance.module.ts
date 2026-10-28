import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';
import { FinanceExtController } from './finance-ext.controller.js';
import { FinanceExtService } from './finance-ext.service.js';
import { FinanceExtraController, PublicPaymentLinkController } from './finance-extra.controller.js';
import { FinanceExtraService } from './finance-extra.service.js';

@Module({
  controllers: [
    InvoicesController,
    FinanceExtController,
    FinanceExtraController,
    PublicPaymentLinkController,
  ],
  providers: [InvoicesService, FinanceExtService, FinanceExtraService],
  exports: [InvoicesService, FinanceExtService, FinanceExtraService],
})
export class FinanceModule {}
