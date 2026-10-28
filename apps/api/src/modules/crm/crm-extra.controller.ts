import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CrmExtraService } from './crm-extra.service.js';
import {
  csvImportSchema,
  historyQuerySchema,
  publicLeadFormSchema,
  type CsvImportDto,
  type HistoryQueryDto,
  type PublicLeadFormDto,
} from './dto/crm-extra.schemas.js';

@ApiTags('crm-extra')
@Controller('customers')
@RequireModule('CRM')
export class CrmExtraController {
  constructor(private readonly crm: CrmExtraService) {}

  @Get(':id/history')
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: 'تاریخچه کامل مشتری (CRM-02)' })
  history(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(historyQuerySchema)) dto: HistoryQueryDto,
  ) {
    return this.crm.fullHistory(tenantId, id, dto);
  }

  @Post('import/csv')
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: 'ورود مشتریان از فایل CSV (CRM-06)' })
  importCsv(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(csvImportSchema)) dto: CsvImportDto,
  ) {
    return this.crm.importCsv(tenantId, dto);
  }
}

@ApiTags('public')
@Controller('public/forms')
export class PublicLeadFormController {
  constructor(private readonly crm: CrmExtraService) {}

  @Public()
  @Post(':tenantId')
  @ApiOperation({ summary: 'فرم آنلاین عمومی ثبت سرنخ (CRM-07)' })
  submit(
    @Param('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(publicLeadFormSchema)) dto: PublicLeadFormDto,
  ) {
    return this.crm.submitPublicLeadForm(tenantId, dto);
  }
}
