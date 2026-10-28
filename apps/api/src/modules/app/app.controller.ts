import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthenticatedUser } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AppService } from './app.service.js';
import {
  appAvailabilitySchema,
  appBookSchema,
  appBusinessDirectorySchema,
  appCancelSchema,
  appGlobalOtpRequestSchema,
  appGlobalOtpVerifySchema,
  appOtpRequestSchema,
  appOtpVerifySchema,
  appPaySchema,
  appReadNotificationSchema,
  appReviewSchema,
  type AppAvailabilityDto,
  type AppBookDto,
  type AppBusinessDirectoryDto,
  type AppCancelDto,
  type AppGlobalOtpRequestDto,
  type AppGlobalOtpVerifyDto,
  type AppOtpRequestDto,
  type AppOtpVerifyDto,
  type AppPayDto,
  type AppReadNotificationDto,
  type AppReviewDto,
} from './dto/app.schemas.js';
import { appCheckInSchema, type AppCheckInDto } from '../attendance/dto/attendance-qr.schemas.js';
import {
  createAbsenceRequestSchema,
  type CreateAbsenceRequestDto,
} from '../attendance/dto/attendance-extra.schemas.js';

@ApiTags('app')
@Controller('app')
@RequireModule('APP')
export class AppController {
  constructor(private readonly app: AppService) {}

  // ----- APP-01 login -----

  @Public()
  @Post('auth/otp/request')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'درخواست کد ورود اپ کاربر نهایی (APP-01)' })
  requestOtp(@Body(new ZodValidationPipe(appOtpRequestSchema)) dto: AppOtpRequestDto) {
    return this.app.requestOtp(dto);
  }

  @Public()
  @Post('auth/otp/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'ورود اپ کاربر نهایی (APP-01)' })
  verifyOtp(
    @Body(new ZodValidationPipe(appOtpVerifySchema)) dto: AppOtpVerifyDto,
    @Req() req: Request,
  ) {
    return this.app.verifyOtp(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }

  @Public()
  @Post('auth/otp/request-global')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'درخواست کد ورود سراسری مشتری (بدون انتخاب کسب‌وکار)' })
  requestGlobalOtp(
    @Body(new ZodValidationPipe(appGlobalOtpRequestSchema)) dto: AppGlobalOtpRequestDto,
  ) {
    return this.app.requestGlobalOtp(dto);
  }

  @Public()
  @Get('businesses')
  @ApiOperation({ summary: 'فهرست کسب‌وکارهای فعال برای ثبت‌نام کاربر جدید (APP-01)' })
  listBusinesses(
    @Query(new ZodValidationPipe(appBusinessDirectorySchema)) dto: AppBusinessDirectoryDto,
  ) {
    return this.app.listBusinesses(dto);
  }

  @Public()
  @Post('auth/otp/verify-global')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'ورود سراسری مشتری و دریافت فهرست کسب‌وکارها (APP-01)' })
  verifyGlobalOtp(
    @Body(new ZodValidationPipe(appGlobalOtpVerifySchema)) dto: AppGlobalOtpVerifyDto,
    @Req() req: Request,
  ) {
    return this.app.verifyGlobalOtp(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }

  @Get('profile')
  @RequirePermissions('app:read')
  @ApiOperation({ summary: 'پروفایل کاربر نهایی' })
  profile(@CurrentUser() user: AuthenticatedUser) {
    return {
      memberId: user.memberId,
      tenantId: user.tenantId,
      fullName: user.fullName,
      phone: user.phone,
    };
  }

  // ----- APP-01 clubs (multi-tenant student dashboard) -----

  @Get('clubs')
  @RequireModule('APP')
  @RequirePermissions('app:read')
  @ApiOperation({ summary: 'کسب‌وکارهایی که مشتری در آن‌ها عضو است (APP-01)' })
  myClubs(@CurrentUser('memberId') memberId: string) {
    return this.app.myClubs(memberId);
  }

  // ----- APP-02 booking -----

  @Get('availability')
  @RequirePermissions('app:read')
  @ApiOperation({ summary: 'زمان‌های آزاد (APP-02)' })
  availability(
    @CurrentUser('memberId') memberId: string,
    @Query(new ZodValidationPipe(appAvailabilitySchema)) dto: AppAvailabilityDto,
  ) {
    return this.app.availability(memberId, dto);
  }

  @Post('appointments')
  @RequirePermissions('app:write')
  @ApiOperation({ summary: 'رزرو نوبت (APP-02)' })
  book(
    @CurrentUser('memberId') memberId: string,
    @Body(new ZodValidationPipe(appBookSchema)) dto: AppBookDto,
  ) {
    return this.app.book(memberId, dto);
  }

  @Get('appointments')
  @RequirePermissions('app:read')
  @ApiOperation({ summary: 'نوبت‌های من (APP-02)' })
  myAppointments(@CurrentUser('memberId') memberId: string) {
    return this.app.myAppointments(memberId);
  }

  @Patch('appointments/:id/cancel')
  @RequirePermissions('app:write')
  @ApiOperation({ summary: 'لغو نوبت (APP-02)' })
  cancel(
    @CurrentUser('memberId') memberId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(appCancelSchema)) dto: AppCancelDto,
  ) {
    return this.app.cancelAppointment(memberId, id, dto);
  }

  // ----- APP-03 invoices & payment -----

  @Get('invoices')
  @RequirePermissions('app:read')
  @ApiOperation({ summary: 'فاکتورهای من (APP-03)' })
  myInvoices(@CurrentUser('memberId') memberId: string) {
    return this.app.myInvoices(memberId);
  }

  @Post('payments')
  @RequirePermissions('app:write')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'پرداخت فاکتور (APP-03)' })
  pay(
    @CurrentUser('memberId') memberId: string,
    @Body(new ZodValidationPipe(appPaySchema)) dto: AppPayDto,
  ) {
    return this.app.payInvoice(memberId, dto);
  }

  // ----- APP-04 history -----

  @Get('history')
  @RequirePermissions('app:read')
  @ApiOperation({ summary: 'تاریخچه شخصی (APP-04)' })
  history(@CurrentUser('memberId') memberId: string) {
    return this.app.myHistory(memberId);
  }

  // ----- ATT (student attendance view + panel self check-in) -----

  @Get('attendance')
  @RequirePermissions('app:read')
  @ApiOperation({ summary: 'سوابق حضور و غیاب مشتری در کسب‌وکار (ATT-06)' })
  attendance(@CurrentUser('memberId') memberId: string) {
    return this.app.myAttendance(memberId);
  }

  @Get('attendance/targets')
  @RequirePermissions('app:read')
  @ApiOperation({ summary: 'جلسه‌های حاضری باز برای ثبت حضور از پنل (ATT-01)' })
  attendanceTargets(@CurrentUser('memberId') memberId: string) {
    return this.app.checkInTargets(memberId);
  }

  @Post('attendance/check-in')
  @RequirePermissions('app:write')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'ثبت حاضری از پنل کاربری مشتری (بدون کد تأیید) (ATT-01)' })
  panelCheckIn(
    @CurrentUser('memberId') memberId: string,
    @Body(new ZodValidationPipe(appCheckInSchema)) dto: AppCheckInDto,
  ) {
    return this.app.panelCheckIn(memberId, dto);
  }

  // ----- ATT-03 absence/excuse requests -----

  @Get('absence-requests')
  @RequirePermissions('app:read')
  @ApiOperation({ summary: 'درخواست‌های غیبت موجه من و وضعیت بررسی (ATT-03)' })
  myAbsenceRequests(@CurrentUser('memberId') memberId: string) {
    return this.app.myAbsenceRequests(memberId);
  }

  @Post('absence-requests')
  @RequirePermissions('app:write')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'ثبت درخواست غیبت موجه/عدم حضور یک جلسه (ATT-03)' })
  createAbsenceRequest(
    @CurrentUser('memberId') memberId: string,
    @Body(new ZodValidationPipe(createAbsenceRequestSchema)) dto: CreateAbsenceRequestDto,
  ) {
    return this.app.createAbsenceRequest(memberId, dto);
  }

  // ----- APP-05 messages -----

  @Get('notifications')
  @RequirePermissions('app:read')
  @ApiOperation({ summary: 'پیام‌ها و اعلان‌ها (APP-05)' })
  notifications(@CurrentUser('memberId') memberId: string) {
    return this.app.myNotifications(memberId);
  }

  @Patch('notifications/read')
  @RequirePermissions('app:write')
  @ApiOperation({ summary: 'خوانده‌شدن اعلان (APP-05)' })
  readNotification(
    @CurrentUser('memberId') memberId: string,
    @Body(new ZodValidationPipe(appReadNotificationSchema)) dto: AppReadNotificationDto,
  ) {
    return this.app.markNotificationRead(memberId, dto.messageId);
  }

  // ----- APP-06 loyalty -----

  @Get('loyalty')
  @RequirePermissions('app:read')
  @ApiOperation({ summary: 'باشگاه و کیف پول (APP-06)' })
  loyalty(@CurrentUser('memberId') memberId: string) {
    return this.app.myLoyalty(memberId);
  }

  // ----- APP-07 reviews -----

  @Post('reviews')
  @RequirePermissions('app:write')
  @ApiOperation({ summary: 'ثبت نظر (APP-07)' })
  review(
    @CurrentUser('memberId') memberId: string,
    @Body(new ZodValidationPipe(appReviewSchema)) dto: AppReviewDto,
  ) {
    return this.app.submitReview(memberId, dto);
  }
}

@ApiTags('public')
@Controller('public/portal')
export class PublicPortalController {
  constructor(private readonly app: AppService) {}

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'اطلاعات عمومی پورتال کسب‌وکار (APP)' })
  profile(@Param('slug') slug: string) {
    return this.app.tenantProfile(slug);
  }
}
