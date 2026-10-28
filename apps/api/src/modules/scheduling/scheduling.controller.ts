import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PERMISSIONS } from '@repo/shared';
import { SchedulingService } from './scheduling.service.js';
import {
  createAppointmentSchema,
  createServiceSchema,
  listAppointmentsSchema,
  updateAppointmentStatusSchema,
  updateServiceSchema,
  type CreateAppointmentDto,
  type CreateServiceDto,
  type ListAppointmentsDto,
  type UpdateAppointmentStatusDto,
  type UpdateServiceDto,
} from './dto/service.schemas.js';

@ApiTags('scheduling')
@Controller('scheduling')
@RequireModule('SCH')
export class SchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Post('services')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'ثبت خدمت' })
  createService(@CurrentUser('tenantId') tenantId: string, @Body(new ZodValidationPipe(createServiceSchema)) dto: CreateServiceDto) {
    return this.scheduling.createService(tenantId, dto);
  }

  @Get('services')
  @RequirePermissions(PERMISSIONS.SCH_READ)
  @ApiOperation({ summary: 'فهرست خدمات' })
  listServices(@CurrentUser('tenantId') tenantId: string) {
    return this.scheduling.listServices(tenantId);
  }

  @Patch('services/:id')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'ویرایش خدمت' })
  updateService(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) dto: UpdateServiceDto,
  ) {
    return this.scheduling.updateService(tenantId, id, dto);
  }

  @Post('appointments')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'ثبت نوبت' })
  createAppointment(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createAppointmentSchema)) dto: CreateAppointmentDto,
  ) {
    return this.scheduling.createAppointment(tenantId, dto);
  }

  @Get('appointments')
  @RequirePermissions(PERMISSIONS.SCH_READ)
  @ApiOperation({ summary: 'فهرست نوبت‌ها' })
  listAppointments(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listAppointmentsSchema)) dto: ListAppointmentsDto,
  ) {
    return this.scheduling.listAppointments(tenantId, dto);
  }

  @Patch('appointments/:id/status')
  @RequirePermissions(PERMISSIONS.SCH_WRITE)
  @ApiOperation({ summary: 'تغییر وضعیت نوبت' })
  updateStatus(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAppointmentStatusSchema)) dto: UpdateAppointmentStatusDto,
  ) {
    return this.scheduling.updateStatus(tenantId, id, dto);
  }
}
