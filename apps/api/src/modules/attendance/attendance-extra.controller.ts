import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AttendanceExtraService } from './attendance-extra.service.js';
import {
  attendanceAlertSchema,
  createMakeupSchema,
  geofenceCheckInSchema,
  listMakeupSchema,
  useMakeupSchema,
  type AttendanceAlertDto,
  type CreateMakeupDto,
  type GeofenceCheckInDto,
  type ListMakeupDto,
  type UseMakeupDto,
} from './dto/attendance-extra.schemas.js';

@ApiTags('attendance-extra')
@Controller('attendance')
@RequireModule('ATT')
export class AttendanceExtraController {
  constructor(private readonly attendance: AttendanceExtraService) {}

  @Post('makeup')
  @RequirePermissions(PERMISSIONS.ATT_WRITE)
  @ApiOperation({ summary: 'ایجاد اعتبار جبران جلسه (ATT-04)' })
  createMakeup(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createMakeupSchema)) dto: CreateMakeupDto,
  ) {
    return this.attendance.createMakeup(tenantId, dto);
  }

  @Get('makeup')
  @RequirePermissions(PERMISSIONS.ATT_READ)
  @ApiOperation({ summary: 'فهرست اعتبارهای جبران جلسه' })
  listMakeup(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listMakeupSchema)) dto: ListMakeupDto,
  ) {
    return this.attendance.listMakeup(tenantId, dto);
  }

  @Patch('makeup/:id/use')
  @RequirePermissions(PERMISSIONS.ATT_WRITE)
  @ApiOperation({ summary: 'استفاده از اعتبار جبران جلسه' })
  useMakeup(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(useMakeupSchema)) dto: UseMakeupDto,
  ) {
    return this.attendance.useMakeup(tenantId, id, dto);
  }

  @Get('alerts/attendance-drop')
  @RequirePermissions(PERMISSIONS.ATT_READ)
  @ApiOperation({ summary: 'هشدار افت حضور مشتریان (ATT-05)' })
  alerts(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(attendanceAlertSchema)) dto: AttendanceAlertDto,
  ) {
    return this.attendance.attendanceAlerts(tenantId, dto);
  }

  @Post('geofence-check-in')
  @RequirePermissions(PERMISSIONS.ATT_WRITE)
  @ApiOperation({ summary: 'ثبت ورود با محدوده مکانی (ATT-07)' })
  geofence(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(geofenceCheckInSchema)) dto: GeofenceCheckInDto,
  ) {
    return this.attendance.geofenceCheckIn(tenantId, dto);
  }
}
