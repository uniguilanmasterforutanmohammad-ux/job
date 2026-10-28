import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { StaffService } from './staff.service.js';
import {
  createLeaveSchema,
  createStaffSchema,
  generatePayrollSchema,
  listStaffSchema,
  reviewLeaveSchema,
  updatePayrollSchema,
  updateStaffSchema,
  type CreateLeaveDto,
  type CreateStaffDto,
  type GeneratePayrollDto,
  type ListStaffDto,
  type ReviewLeaveDto,
  type UpdatePayrollDto,
  type UpdateStaffDto,
} from './dto/staff.schemas.js';

@ApiTags('staff')
@Controller('staff')
@RequireModule('HR')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'ثبت پروفایل کارمند (HR-01)' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createStaffSchema)) dto: CreateStaffDto,
  ) {
    return this.staff.create(tenantId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: 'فهرست کارکنان' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listStaffSchema)) dto: ListStaffDto,
  ) {
    return this.staff.list(tenantId, dto);
  }

  @Get(':id/scorecard')
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: 'کارنامه کارمند (HR-04)' })
  scorecard(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.staff.scorecard(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'ویرایش کارمند' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStaffSchema)) dto: UpdateStaffDto,
  ) {
    return this.staff.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'حذف کارمند' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.staff.remove(tenantId, id);
  }

  @Post('leaves')
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'ثبت درخواست مرخصی (HR-03)' })
  createLeave(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createLeaveSchema)) dto: CreateLeaveDto,
  ) {
    return this.staff.createLeave(tenantId, dto);
  }

  @Get('leaves/all')
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: 'فهرست مرخصی‌ها' })
  listLeaves(
    @CurrentUser('tenantId') tenantId: string,
    @Query('staffId') staffId?: string,
    @Query('status') status?: string,
  ) {
    return this.staff.listLeaves(tenantId, staffId, status);
  }

  @Patch('leaves/:id')
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'تأیید/رد مرخصی' })
  reviewLeave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reviewLeaveSchema)) dto: ReviewLeaveDto,
  ) {
    return this.staff.reviewLeave(user.tenantId, id, dto, user.memberId);
  }

  @Post('payroll/generate')
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'تولید فیش حقوقی دوره (HR-02/06)' })
  generatePayroll(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(generatePayrollSchema)) dto: GeneratePayrollDto,
  ) {
    return this.staff.generatePayroll(tenantId, dto);
  }

  @Get('payroll/all')
  @RequirePermissions(PERMISSIONS.HR_READ)
  @ApiOperation({ summary: 'فهرست فیش‌های حقوقی' })
  listPayroll(@CurrentUser('tenantId') tenantId: string, @Query('staffId') staffId?: string) {
    return this.staff.listPayroll(tenantId, staffId);
  }

  @Patch('payroll/:id')
  @RequirePermissions(PERMISSIONS.HR_WRITE)
  @ApiOperation({ summary: 'ویرایش/نهایی‌سازی فیش حقوقی' })
  updatePayroll(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePayrollSchema)) dto: UpdatePayrollDto,
  ) {
    return this.staff.updatePayroll(tenantId, id, dto);
  }
}
