import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { configuration } from './config/configuration.js';
import { loadRootEnv } from './config/env.loader.js';
import { DatabaseModule } from './database/database.module.js';
import { RedisModule } from './redis/redis.module.js';
import { QueueModule } from './queue/queue.module.js';
import { SchedulerService } from './queue/scheduler.service.js';
import { MessageProcessor } from './queue/processors/message.processor.js';
import { NotificationProcessor } from './queue/processors/notification.processor.js';
import { AutomationProcessor } from './queue/processors/automation.processor.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { IndustriesModule } from './modules/industries/industries.module.js';
import { TenantsModule } from './modules/tenants/tenants.module.js';
import { CrmModule } from './modules/crm/crm.module.js';
import { SchedulingModule } from './modules/scheduling/scheduling.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import { BaleModule } from './modules/bale/bale.module.js';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { StaffModule } from './modules/staff/staff.module.js';
import { MarketingModule } from './modules/marketing/marketing.module.js';
import { ShopModule } from './modules/shop/shop.module.js';
import { MarketplaceModule } from './modules/marketplace/marketplace.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { CampaignsModule } from './modules/campaigns/campaigns.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { PortalModule } from './modules/app/app.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from './modules/auth/guards/permissions.guard.js';
import { ModuleAccessGuard } from './common/guards/module-access.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { AuditInterceptor } from './common/interceptors/audit.interceptor.js';

loadRootEnv();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.code',
            'req.body.refreshToken',
          ],
          censor: '[redacted]',
        },
        autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
    }),
    DatabaseModule,
    RedisModule,
    QueueModule,
    NotificationsModule,
    AuthModule,
    IndustriesModule,
    TenantsModule,
    CrmModule,
    SchedulingModule,
    AttendanceModule,
    FinanceModule,
    PaymentsModule,
    ReportsModule,
    MessagingModule,
    BaleModule,
    SubscriptionsModule,
    InventoryModule,
    StaffModule,
    MarketingModule,
    ShopModule,
    MarketplaceModule,
    DocumentsModule,
    CampaignsModule,
    FilesModule,
    PortalModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    SchedulerService,
    MessageProcessor,
    NotificationProcessor,
    AutomationProcessor,
    // Order matters: throttling → authentication → authorization.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ModuleAccessGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
