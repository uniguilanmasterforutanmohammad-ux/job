import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller.js';
import { MarketingService } from './marketing.service.js';
import { MarketingExtraController } from './marketing-extra.controller.js';
import { MarketingExtraService } from './marketing-extra.service.js';
import { MessagingModule } from '../messaging/messaging.module.js';

@Module({
  imports: [MessagingModule],
  controllers: [MarketingExtraController, MarketingController],
  providers: [MarketingService, MarketingExtraService],
  exports: [MarketingService, MarketingExtraService],
})
export class MarketingModule {}
