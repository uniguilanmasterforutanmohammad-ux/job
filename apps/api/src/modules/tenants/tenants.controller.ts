import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePermissions, RequireSystemRoles } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PERMISSIONS } from '@repo/shared';
import { TenantsService } from './tenants.service.js';
import {
  createBranchSchema,
  moduleKeysSchema,
  updateTenantSchema,
  type CreateBranchDto,
  type ModuleKeysDto,
  type UpdateTenantDto,
} from './dto/tenant.schemas.js';

@ApiTags('tenants')
@Controller('tenant')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TENANT_READ)
  @ApiOperation({ summary: 'اطلاعات کسب‌وکار جاری' })
  current(@CurrentUser('tenantId') tenantId: string) {
    return this.tenants.current(tenantId);
  }

  @Patch()
  @RequireSystemRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'ویرایش تنظیمات کسب‌وکار' })
  update(@CurrentUser('tenantId') tenantId: string, @Body(new ZodValidationPipe(updateTenantSchema)) dto: UpdateTenantDto) {
    return this.tenants.update(tenantId, dto);
  }

  @Get('modules')
  @RequirePermissions(PERMISSIONS.TENANT_READ)
  @ApiOperation({ summary: 'ماژول‌های فعال' })
  modules(@CurrentUser('tenantId') tenantId: string) {
    return this.tenants.listModules(tenantId);
  }

  @Post('modules/enable')
  @RequireSystemRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'فعال‌سازی ماژول‌ها' })
  enableModules(@CurrentUser('tenantId') tenantId: string, @Body(new ZodValidationPipe(moduleKeysSchema)) dto: ModuleKeysDto) {
    return this.tenants.enableModules(tenantId, dto.modules);
  }

  @Get('branches')
  @RequirePermissions(PERMISSIONS.TENANT_READ)
  @ApiOperation({ summary: 'فهرست شعبه‌ها' })
  branches(@CurrentUser('tenantId') tenantId: string) {
    return this.tenants.listBranches(tenantId);
  }

  @Post('branches')
  @RequireSystemRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'افزودن شعبه' })
  createBranch(@CurrentUser('tenantId') tenantId: string, @Body(new ZodValidationPipe(createBranchSchema)) dto: CreateBranchDto) {
    return this.tenants.createBranch(tenantId, dto);
  }
}
