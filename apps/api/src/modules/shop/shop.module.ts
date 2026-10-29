import { forwardRef, Module } from '@nestjs/common';
import { ShopController } from './shop.controller.js';
import { ShopService } from './shop.service.js';
import { ShopExtraController } from './shop-extra.controller.js';
import { ShopExtraService } from './shop-extra.service.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  imports: [forwardRef(() => PaymentsModule)],
  controllers: [ShopController, ShopExtraController],
  providers: [ShopService, ShopExtraService],
  exports: [ShopService, ShopExtraService],
})
export class ShopModule {}
