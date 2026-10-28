import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SchedulingExtraService } from './scheduling-extra.service.js';
import {
  availabilityQuerySchema,
  cancelAppointmentSchema,
  connectCalendarSchema,
  createGroupBookingSchema,
  joinGroupBookingSchema,
  type AvailabilityQueryDto,
  type CancelAppointmentDto,
  type ConnectCalendarDto,
  type CreateGroupBookingDto,
  type JoinGroupBookingDto,
} from './dto/scheduling-extra.schemas.js';

@ApiTags('scheduling-extra')
@Controller('scheduling')
@RequireModule('SCH')
export class SchedulingExtraController {
  constructor(private readonly scheduling: SchedulingExtraService) {}

  @Get('availability')
  @RequirePermissions(PERMISSIONS.SCH_READ)
  @ApiOperation({ summary: 'زمان‌های آزاد (SCH-03)' })
  availability(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(availabilityQuerySchema)) dto: AvailabilityQueryDto,
  ) {
    return this.scheduling.availability(tenantId, dto);
  }

  @Patch('appointments/:id/cancel')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'لغو نوبت با سیاست جریمه (SCH-04)' })
  cancel(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelAppointmentSchema)) dto: CancelAppointmentDto,
  ) {
    return this.scheduling.cancelAppointment(tenantId, id, dto);
  }

  @Patch('appointments/:id/no-show')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'ثبت عدم حضور و علامت‌گذاری مشتری پرریسک (SCH-04)' })
  noShow(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.scheduling.markNoShow(tenantId, id);
  }

  @Post('group-bookings')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'ایجاد رزرو گروهی (SCH-06)' })
  createGroup(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createGroupBookingSchema)) dto: CreateGroupBookingDto,
  ) {
    return this.scheduling.createGroupBooking(tenantId, dto);
  }

  @Get('group-bookings')
  @RequirePermissions(PERMISSIONS.SCH_READ)
  @ApiOperation({ summary: 'فهرست رزروهای گروهی' })
  listGroups(@CurrentUser('tenantId') tenantId: string) {
    return this.scheduling.listGroupBookings(tenantId);
  }

  @Post('group-bookings/:id/join')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'افزودن مشتری به رزرو گروهی' })
  joinGroup(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(joinGroupBookingSchema)) dto: JoinGroupBookingDto,
  ) {
    return this.scheduling.joinGroupBooking(tenantId, id, dto);
  }

  @Patch('group-bookings/:id/close')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'بستن رزرو گروهی' })
  closeGroup(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.scheduling.closeGroupBooking(tenantId, id);
  }

  @Get('calendar-connections')
  @RequirePermissions(PERMISSIONS.SCH_READ)
  @ApiOperation({ summary: 'فهرست اتصال‌های تقویم خارجی (SCH-09)' })
  listConnections(@CurrentUser('tenantId') tenantId: string) {
    return this.scheduling.listConnections(tenantId);
  }

  @Post('calendar-connections')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'اتصال تقویم گوگل/اوتلوک (SCH-09)' })
  connectCalendar(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(connectCalendarSchema)) dto: ConnectCalendarDto,
  ) {
    return this.scheduling.connectCalendar(tenantId, dto);
  }

  @Delete('calendar-connections/:id')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'قطع اتصال تقویم خارجی' })
  disconnectCalendar(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.scheduling.disconnectCalendar(tenantId, id);
  }
}
