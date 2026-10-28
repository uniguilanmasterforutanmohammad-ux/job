import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SubscriptionsService } from './subscriptions.service.js';
import {
  createPlanSchema,
  createSessionPackageSchema,
  createSubscriptionSchema,
  freezeSubscriptionSchema,
  listSubscriptionsSchema,
  updatePlanSchema,
  upgradeSubscriptionSchema,
  useSessionsSchema,
  type CreatePlanDto,
  type CreateSessionPackageDto,
  type CreateSubscriptionDto,
  type FreezeSubscriptionDto,
  type ListSubscriptionsDto,
  type UpdatePlanDto,
  type UpgradeSubscriptionDto,
  type UseSessionsDto,
} from './dto/subscription.schemas.js';

@ApiTags('subscriptions')
@Controller('subscriptions')
@RequireModule('SUB')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Post('plans')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'ثبت طرح عضویت' })
  createPlan(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createPlanSchema)) dto: CreatePlanDto,
  ) {
    return this.subscriptions.createPlan(tenantId, dto);
  }

  @Get('plans')
  @RequirePermissions(PERMISSIONS.SUB_READ)
  @ApiOperation({ summary: 'فهرست طرح‌های عضویت' })
  listPlans(@CurrentUser('tenantId') tenantId: string) {
    return this.subscriptions.listPlans(tenantId);
  }

  @Patch('plans/:id')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'ویرایش طرح عضویت' })
  updatePlan(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePlanSchema)) dto: UpdatePlanDto,
  ) {
    return this.subscriptions.updatePlan(tenantId, id, dto);
  }

  @Delete('plans/:id')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'غیرفعال‌سازی طرح عضویت' })
  removePlan(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.subscriptions.removePlan(tenantId, id);
  }

  @Post('renewals/run')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'اجرای تمدید خودکار (SUB-02)' })
  runRenewals(@CurrentUser('tenantId') tenantId: string) {
    return this.subscriptions.processRenewals(tenantId);
  }

  @Post('packages')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'ثبت بسته جلسه' })
  createPackage(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createSessionPackageSchema)) dto: CreateSessionPackageDto,
  ) {
    return this.subscriptions.createPackage(tenantId, dto);
  }

  @Get('packages')
  @RequirePermissions(PERMISSIONS.SUB_READ)
  @ApiOperation({ summary: 'فهرست بسته‌های جلسه' })
  listPackages(
    @CurrentUser('tenantId') tenantId: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.subscriptions.listPackages(tenantId, customerId);
  }

  @Post('packages/:id/use')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'مصرف یک جلسه از بسته' })
  usePackage(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.subscriptions.usePackageSession(tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'ثبت اشتراک/شهریه' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createSubscriptionSchema)) dto: CreateSubscriptionDto,
  ) {
    return this.subscriptions.create(tenantId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SUB_READ)
  @ApiOperation({ summary: 'فهرست اشتراک‌ها' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listSubscriptionsSchema)) dto: ListSubscriptionsDto,
  ) {
    return this.subscriptions.list(tenantId, dto);
  }

  @Post(':id/use')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'کسر جلسات اشتراک' })
  use(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(useSessionsSchema)) dto: UseSessionsDto,
  ) {
    return this.subscriptions.useSessions(tenantId, id, dto);
  }

  @Post(':id/freeze')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'انجماد اشتراک' })
  freeze(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(freezeSubscriptionSchema)) dto: FreezeSubscriptionDto,
  ) {
    return this.subscriptions.freeze(tenantId, id, dto);
  }

  @Post(':id/unfreeze')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'رفع انجماد' })
  unfreeze(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.subscriptions.unfreeze(tenantId, id);
  }

  @Post(':id/upgrade')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'ارتقای اشتراک (SUB-05)' })
  upgrade(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(upgradeSubscriptionSchema)) dto: UpgradeSubscriptionDto,
  ) {
    return this.subscriptions.upgrade(tenantId, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'لغو اشتراک' })
  cancel(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.subscriptions.cancel(tenantId, id);
  }
}
