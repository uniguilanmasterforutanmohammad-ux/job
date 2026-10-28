import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { DocumentsExtraController } from './documents-extra.controller.js';
import { DocumentsExtraService } from './documents-extra.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [DocumentsExtraController, DocumentsController],
  providers: [DocumentsService, DocumentsExtraService],
  exports: [DocumentsService, DocumentsExtraService],
})
export class DocumentsModule {}
