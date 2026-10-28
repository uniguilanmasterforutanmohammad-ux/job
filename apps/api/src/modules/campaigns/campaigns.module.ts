import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller.js';
import { CampaignsService } from './campaigns.service.js';
import { CampaignsExtraController } from './campaigns-extra.controller.js';
import { CampaignsExtraService } from './campaigns-extra.service.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  imports: [MessagingModule, PaymentsModule],
  controllers: [CampaignsExtraController, CampaignsController],
  providers: [CampaignsService, CampaignsExtraService],
  exports: [CampaignsService, CampaignsExtraService],
})
export class CampaignsModule {}
