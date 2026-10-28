import { Body, Controller, Get, Headers, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ReportsExtService, type ReportType } from './reports-ext.service.js';

const exportSchema = z.object({
  type: z.enum(['revenue', 'customers', 'staff']),
  from: z.coerce.date().default(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  to: z.coerce.date().default(() => new Date()),
});
type ExportDto = z.infer<typeof exportSchema>;

const scheduleSchema = z.object({
  type: z.enum(['revenue', 'customers', 'staff']),
  cron: z.string().trim().min(3).max(60),
  email: z.string().email(),
});
type ScheduleDto = z.infer<typeof scheduleSchema>;

@ApiTags('reports-ext')
@Controller('reports')
@RequireModule('RPT')
export class ReportsExtController {
  constructor(private readonly reports: ReportsExtService) {}

  @Get('export/csv')
  @RequirePermissions(PERMISSIONS.RPT_READ)
  @ApiOperation({ summary: 'خروجی CSV/Excel (RPT-05)' })
  async exportCsv(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(exportSchema)) dto: ExportDto,
    @Res() res: Response,
  ) {
    const { filename, content } = await this.reports.exportCsv(
      tenantId,
      dto.type as ReportType,
      dto.from,
      dto.to,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get('export/print')
  @RequirePermissions(PERMISSIONS.RPT_READ)
  @ApiOperation({ summary: 'خروجی چاپی/PDF (RPT-05)' })
  async exportPrint(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(exportSchema)) dto: ExportDto,
    @Res() res: Response,
  ) {
    const { html } = await this.reports.exportPrintable(
      tenantId,
      dto.type as ReportType,
      dto.from,
      dto.to,
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Post('export/schedule')
  @RequirePermissions(PERMISSIONS.RPT_READ)
  @ApiOperation({ summary: 'زمان‌بندی ارسال گزارش با ایمیل (RPT-05)' })
  schedule(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(scheduleSchema)) dto: ScheduleDto,
  ) {
    return this.reports.scheduleExport(tenantId, dto);
  }

  @Get('export/schedules')
  @RequirePermissions(PERMISSIONS.RPT_READ)
  @ApiOperation({ summary: 'فهرست زمان‌بندی گزارش‌ها' })
  listSchedules(@CurrentUser('tenantId') tenantId: string) {
    return this.reports.listSchedules(tenantId);
  }

  @Get('forecast')
  @RequirePermissions(PERMISSIONS.RPT_READ)
  @ApiOperation({ summary: 'پیش‌بینی درآمد ماه بعد (RPT-06)' })
  forecast(@CurrentUser('tenantId') tenantId: string, @Headers('accept') _accept?: string) {
    return this.reports.forecast(tenantId);
  }
}
