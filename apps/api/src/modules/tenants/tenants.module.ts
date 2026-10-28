import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';
import { TenantsExtController } from './tenants-ext.controller.js';
import { TenantsExtService } from './tenants-ext.service.js';
import { ModuleAccessService } from './module-access.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [TenantsController, TenantsExtController],
  providers: [TenantsService, TenantsExtService, ModuleAccessService],
  exports: [TenantsService, TenantsExtService, ModuleAccessService],
})
export class TenantsModule {}
