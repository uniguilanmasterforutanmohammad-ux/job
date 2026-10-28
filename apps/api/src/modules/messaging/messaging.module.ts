import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller.js';
import { MessagingService } from './messaging.service.js';
import { MessageTemplateService } from './template.service.js';
import { MessagingExtraController } from './messaging-extra.controller.js';
import { MessagingExtraService } from './messaging-extra.service.js';

@Module({
  controllers: [MessagingExtraController, MessagingController],
  providers: [MessagingService, MessageTemplateService, MessagingExtraService],
  exports: [MessagingService, MessageTemplateService, MessagingExtraService],
})
export class MessagingModule {}
