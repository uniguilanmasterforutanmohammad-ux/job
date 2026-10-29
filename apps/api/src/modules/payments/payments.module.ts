import { forwardRef, Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PaymentProviderRegistry } from './providers/provider.registry.js';
import { MockPaymentProvider } from './providers/mock.provider.js';
import { ZarinpalPaymentProvider } from './providers/zarinpal.provider.js';

@Module({
  imports: [forwardRef(() => ShopModule)],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentProviderRegistry,
    MockPaymentProvider,
    ZarinpalPaymentProvider,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
