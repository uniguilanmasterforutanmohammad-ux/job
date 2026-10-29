import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PortalModule } from '../app/app.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { ShopModule } from '../shop/shop.module.js';
import { MarketplaceController } from './marketplace.controller.js';
import { MarketplaceService } from './marketplace.service.js';

@Module({
  imports: [AuthModule, PortalModule, PaymentsModule, ShopModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
