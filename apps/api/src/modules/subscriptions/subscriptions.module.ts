import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { SubscriptionsExtraController } from './subscriptions-extra.controller.js';
import { SubscriptionsExtraService } from './subscriptions-extra.service.js';

@Module({
  controllers: [SubscriptionsExtraController, SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionsExtraService],
  exports: [SubscriptionsService, SubscriptionsExtraService],
})
export class SubscriptionsModule {}
