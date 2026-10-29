import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AnnouncementsService } from './announcements.service.js';
import {
  listAnnouncementsSchema,
  publishAnnouncementSchema,
  type ListAnnouncementsDto,
  type PublishAnnouncementDto,
} from './dto/announcement.schemas.js';

@ApiTags('announcements')
@Controller('messages/announcements')
@RequireModule('MSG')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MSG_READ)
  @ApiOperation({ summary: 'فهرست اطلاعیه‌های منتشرشده' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listAnnouncementsSchema)) dto: ListAnnouncementsDto,
  ) {
    return this.announcements.list(tenantId, dto);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'انتشار اطلاعیه برای مشتریان + آینه در گروه بله' })
  publish(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('memberId') userId: string,
    @Body(new ZodValidationPipe(publishAnnouncementSchema)) dto: PublishAnnouncementDto,
  ) {
    return this.announcements.publish(tenantId, dto, userId);
  }

  @Post(':id/bale')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'ارسال دوبارهٔ اطلاعیه به گروه بله' })
  resend(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.announcements.resendToBale(tenantId, id);
  }
}
