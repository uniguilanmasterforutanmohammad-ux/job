import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller.js';
import { MessagingService } from './messaging.service.js';
import { MessageTemplateService } from './template.service.js';
import { MessagingExtraController } from './messaging-extra.controller.js';
import { MessagingExtraService } from './messaging-extra.service.js';
import { AnnouncementsController } from './announcements.controller.js';
import { AnnouncementsService } from './announcements.service.js';

@Module({
  controllers: [MessagingExtraController, AnnouncementsController, MessagingController],
  providers: [MessagingService, MessageTemplateService, MessagingExtraService, AnnouncementsService],
  exports: [MessagingService, MessageTemplateService, MessagingExtraService, AnnouncementsService],
})
export class MessagingModule {}
