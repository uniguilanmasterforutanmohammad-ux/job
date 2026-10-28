import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { StaffExtraService } from './staff-extra.service.js';
import { assignServiceSchema, type AssignServiceDto } from './dto/staff-extra.schemas.js';

@ApiTags('staff-extra')
@Controller('staff')
@RequireModule('HR')
export class StaffExtraController {
  constructor(private readonly staff: StaffExtraService) {}

  @Post(':id/services')
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'تخصیص خدمت به کارمند (HR-05)' })
  assign(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignServiceSchema)) dto: AssignServiceDto,
  ) {
    return this.staff.assignService(tenantId, id, dto);
  }

  @Get(':id/services')
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: 'خدمات تخصیص‌یافته به کارمند' })
  list(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.staff.listServices(tenantId, id);
  }

  @Delete(':id/services/:serviceId')
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'حذف تخصیص خدمت' })
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.staff.removeService(tenantId, id, serviceId);
  }

  @Get('services/:serviceId/suggest')
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: 'پیشنهاد کارمند منصفانه (HR-05)' })
  suggest(
    @CurrentUser('tenantId') tenantId: string,
    @Param('serviceId') serviceId: string,
    @Query('at') at?: string,
  ) {
    return this.staff.suggestStaff(tenantId, serviceId, at ? new Date(at) : new Date());
  }
}
