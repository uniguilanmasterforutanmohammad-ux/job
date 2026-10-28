import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SchedulingExtService } from './scheduling-ext.service.js';
import {
  createRecurringSchema,
  createWaitlistSchema,
  updateWaitlistStatusSchema,
  type CreateRecurringDto,
  type CreateWaitlistDto,
  type UpdateWaitlistStatusDto,
} from './dto/scheduling-ext.schemas.js';

@ApiTags('scheduling-ext')
@Controller('scheduling')
@RequireModule('SCH')
export class SchedulingExtController {
  constructor(private readonly scheduling: SchedulingExtService) {}

  @Post('waitlist')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'افزودن به لیست انتظار (SCH-07)' })
  addWaitlist(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createWaitlistSchema)) dto: CreateWaitlistDto,
  ) {
    return this.scheduling.createWaitlist(tenantId, dto);
  }

  @Get('waitlist')
  @RequirePermissions(PERMISSIONS.SCH_READ)
  @ApiOperation({ summary: 'فهرست لیست انتظار' })
  listWaitlist(@CurrentUser('tenantId') tenantId: string, @Query('status') status?: string) {
    return this.scheduling.listWaitlist(tenantId, status);
  }

  @Patch('waitlist/:id')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'تغییر وضعیت لیست انتظار' })
  updateWaitlist(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWaitlistStatusSchema)) dto: UpdateWaitlistStatusDto,
  ) {
    return this.scheduling.updateWaitlistStatus(tenantId, id, dto);
  }

  @Post('recurring')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'ایجاد جلسات تکرارشونده (SCH-08)' })
  createRecurring(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createRecurringSchema)) dto: CreateRecurringDto,
  ) {
    return this.scheduling.createRecurring(tenantId, dto);
  }

  @Get('recurring')
  @RequirePermissions(PERMISSIONS.SCH_READ)
  @ApiOperation({ summary: 'فهرست سری‌های تکرارشونده' })
  listRecurring(@CurrentUser('tenantId') tenantId: string) {
    return this.scheduling.listRecurring(tenantId);
  }

  @Post('recurring/:id/generate')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'تولید نوبت‌های سری' })
  generate(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.scheduling.generateOccurrences(tenantId, id);
  }

  @Post('recurring/:id/cancel')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'لغو سری تکرارشونده' })
  cancel(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.scheduling.cancelRecurring(tenantId, id);
  }
}
