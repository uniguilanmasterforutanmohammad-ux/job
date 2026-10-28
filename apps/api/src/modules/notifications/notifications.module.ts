import { Global, Module } from '@nestjs/common';
import { SmsService } from './sms.service.js';
import { EmailService } from './email.service.js';
import { NotificationService } from './notification.service.js';

@Global()
@Module({
  providers: [SmsService, EmailService, NotificationService],
  exports: [SmsService, EmailService, NotificationService],
})
export class NotificationsModule {}
