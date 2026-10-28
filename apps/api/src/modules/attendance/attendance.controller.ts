import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PERMISSIONS } from '@repo/shared';
import { AttendanceService } from './attendance.service.js';
import {
  listAttendanceSchema,
  markAttendanceSchema,
  type ListAttendanceDto,
  type MarkAttendanceDto,
} from './dto/attendance.schemas.js';

@ApiTags('attendance')
@Controller('attendance')
@RequireModule('ATT')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ATT_WRITE)
  @ApiOperation({ summary: 'ثبت حضور' })
  mark(@CurrentUser('tenantId') tenantId: string, @Body(new ZodValidationPipe(markAttendanceSchema)) dto: MarkAttendanceDto) {
    return this.attendance.mark(tenantId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ATT_READ)
  @ApiOperation({ summary: 'فهرست حضور و غیاب' })
  list(@CurrentUser('tenantId') tenantId: string, @Query(new ZodValidationPipe(listAttendanceSchema)) dto: ListAttendanceDto) {
    return this.attendance.list(tenantId, dto);
  }

  @Get('summary/:customerId')
  @RequirePermissions(PERMISSIONS.ATT_READ)
  @ApiOperation({ summary: 'خلاصه حضور مشتری' })
  summary(@CurrentUser('tenantId') tenantId: string, @Param('customerId') customerId: string) {
    return this.attendance.summary(tenantId, customerId);
  }
}
