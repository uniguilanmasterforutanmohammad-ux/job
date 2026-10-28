import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PERMISSIONS } from '@repo/shared';
import { ReportsService } from './reports.service.js';

const rangeSchema = z.object({
  from: z.coerce.date().default(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  to: z.coerce.date().default(() => new Date()),
});
type RangeDto = z.infer<typeof rangeSchema>;

@ApiTags('reports')
@Controller('reports')
@RequireModule('RPT')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  @RequirePermissions(PERMISSIONS.RPT_READ)
  @ApiOperation({ summary: 'داشبورد' })
  dashboard(@CurrentUser('tenantId') tenantId: string) {
    return this.reports.dashboard(tenantId);
  }

  @Get('revenue')
  @RequirePermissions(PERMISSIONS.RPT_READ)
  @ApiOperation({ summary: 'روند درآمد' })
  revenue(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(rangeSchema)) range: RangeDto,
  ) {
    return this.reports.revenueSeries(tenantId, range.from, range.to);
  }

  @Get('staff-performance')
  @RequirePermissions(PERMISSIONS.RPT_READ)
  @ApiOperation({ summary: 'عملکرد کارکنان' })
  staffPerformance(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(rangeSchema)) range: RangeDto,
  ) {
    return this.reports.staffPerformance(tenantId, range.from, range.to);
  }

  @Get('customers')
  @RequirePermissions(PERMISSIONS.RPT_READ)
  @ApiOperation({ summary: 'آمار مشتریان' })
  customers(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(rangeSchema)) range: RangeDto,
  ) {
    return this.reports.customerStats(tenantId, range.from, range.to);
  }
}
