import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AttendanceQrService } from './attendance-qr.service.js';
import {
  openQrSessionSchema,
  qrCheckInOtpRequestSchema,
  qrCheckInSchema,
  type OpenQrSessionDto,
  type QrCheckInDto,
  type QrCheckInOtpRequestDto,
} from './dto/attendance-qr.schemas.js';

/** Manager/teacher side — create and monitor rotating QR sessions (ATT-01). */
@ApiTags('attendance-qr')
@Controller('attendance/qr')
@RequireModule('ATT')
export class AttendanceQrAdminController {
  constructor(private readonly qr: AttendanceQrService) {}

  @Post('sessions')
  @RequirePermissions(PERMISSIONS.ATT_WRITE)
  @ApiOperation({ summary: 'ایجاد جلسه حاضری QR (ATT-01)' })
  open(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('memberId') memberId: string,
    @Body(new ZodValidationPipe(openQrSessionSchema)) dto: OpenQrSessionDto,
  ) {
    return this.qr.openSession(tenantId, memberId, dto);
  }

  @Get('sessions')
  @RequirePermissions(PERMISSIONS.ATT_READ)
  @ApiOperation({ summary: 'فهرست جلسه‌های حاضری QR' })
  list(@CurrentUser('tenantId') tenantId: string) {
    return this.qr.listSessions(tenantId);
  }

  @Get('sessions/:id')
  @RequirePermissions(PERMISSIONS.ATT_READ)
  @ApiOperation({ summary: 'وضعیت زنده یک جلسه (QR چرخشی)' })
  get(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.qr.getSession(tenantId, id);
  }

  @Get('sessions/:id/attendances')
  @RequirePermissions(PERMISSIONS.ATT_READ)
  @ApiOperation({ summary: 'افراد حاضرشده در یک جلسه' })
  attendances(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.qr.sessionAttendances(tenantId, id);
  }

  @Post('sessions/:id/close')
  @RequirePermissions(PERMISSIONS.ATT_WRITE)
  @ApiOperation({ summary: 'بستن جلسه حاضری QR' })
  close(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.qr.closeSession(tenantId, id);
  }
}

/** Student side — public scan + OTP-confirmed check-in (no login required). */
@ApiTags('public')
@Controller('public/attendance')
export class AttendanceQrPublicController {
  constructor(private readonly qr: AttendanceQrService) {}

  @Public()
  @Get(':code')
  @ApiOperation({ summary: 'اطلاعات عمومی جلسه حاضری QR' })
  lookup(@Param('code') code: string, @Query('t') token?: string) {
    return this.qr.lookupByCode(code, token);
  }

  @Public()
  @Post('otp')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: 'درخواست کد تأیید برای حاضری' })
  requestOtp(@Body(new ZodValidationPipe(qrCheckInOtpRequestSchema)) dto: QrCheckInOtpRequestDto) {
    return this.qr.requestCheckInOtp(dto);
  }

  @Public()
  @Post('check-in')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @ApiOperation({ summary: 'ثبت حاضری شاگرد با QR چرخشی/لینک + کد تأیید (ATT-01)' })
  checkIn(@Body(new ZodValidationPipe(qrCheckInSchema)) dto: QrCheckInDto) {
    return this.qr.checkIn(dto);
  }
}
