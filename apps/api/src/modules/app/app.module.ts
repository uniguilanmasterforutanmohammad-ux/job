import { Module } from '@nestjs/common';
import { AppController, PublicPortalController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { ShopModule } from '../shop/shop.module.js';

@Module({
  imports: [AuthModule, AttendanceModule, MessagingModule, PaymentsModule, ShopModule],
  controllers: [PublicPortalController, AppController],
  providers: [AppService],
  exports: [AppService],
})
export class PortalModule {}
