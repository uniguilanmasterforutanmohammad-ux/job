import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CrmExtService } from './crm-ext.service.js';
import {
  bulkImportSchema,
  moveLeadSchema,
  onlineFormSchema,
  pipelineQuerySchema,
  reEngagementSchema,
  type BulkImportDto,
  type MoveLeadDto,
  type OnlineFormDto,
  type PipelineQueryDto,
  type ReEngagementDto,
} from './dto/crm-ext.schemas.js';

@ApiTags('crm-ext')
@Controller('customers')
@RequireModule('CRM')
export class CrmExtController {
  constructor(private readonly crm: CrmExtService) {}

  @Get('re-engagement')
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: 'یادآور مراجعه مجدد (CRM-04)' })
  reEngagement(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(reEngagementSchema)) dto: ReEngagementDto,
  ) {
    return this.crm.reEngagement(tenantId, dto);
  }

  @Get('duplicates')
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: 'یافتن پرونده‌های تکراری (CRM-05)' })
  duplicates(@CurrentUser('tenantId') tenantId: string) {
    return this.crm.findDuplicates(tenantId);
  }

  @Post('import')
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: 'ورود گروهی مشتریان (CRM-06)' })
  bulkImport(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(bulkImportSchema)) dto: BulkImportDto,
  ) {
    return this.crm.bulkImport(tenantId, dto);
  }

  @Get('pipeline')
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: 'قیف فروش (CRM-08)' })
  pipeline(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(pipelineQuerySchema)) dto: PipelineQueryDto,
  ) {
    return this.crm.pipeline(tenantId, dto);
  }

  @Patch(':id/lead-stage')
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: 'تغییر مرحله سرنخ' })
  moveLead(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moveLeadSchema)) dto: MoveLeadDto,
  ) {
    return this.crm.moveLead(tenantId, id, dto);
  }

  @Post('online-form/:tenantId')
  @Public()
  @ApiOperation({ summary: 'فرم آنلاین ثبت‌نام (CRM-07)' })
  onlineForm(
    @Param('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(onlineFormSchema)) dto: OnlineFormDto,
  ) {
    return this.crm.submitOnlineForm(tenantId, dto);
  }
}
