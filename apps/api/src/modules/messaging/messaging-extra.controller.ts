import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { MessagingExtraService } from './messaging-extra.service.js';
import {
  createSmsPackageSchema,
  listChatSchema,
  markChatReadSchema,
  sendChatSchema,
  type CreateSmsPackageDto,
  type ListChatDto,
  type MarkChatReadDto,
  type SendChatDto,
} from './dto/messaging-extra.schemas.js';
import { z } from 'zod';

const usageQuerySchema = z.object({
  from: z.coerce.date().default(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  to: z.coerce.date().default(() => new Date()),
});
type UsageQueryDto = z.infer<typeof usageQuerySchema>;

@ApiTags('messaging-extra')
@Controller('messages')
@RequireModule('MSG')
export class MessagingExtraController {
  constructor(private readonly messaging: MessagingExtraService) {}

  @Get('chats')
  @RequirePermissions(PERMISSIONS.MSG_READ)
  @ApiOperation({ summary: 'صندوق گفتگوها (MSG-05)' })
  inbox(@CurrentUser('tenantId') tenantId: string) {
    return this.messaging.chatInbox(tenantId);
  }

  @Get('chats/messages')
  @RequirePermissions(PERMISSIONS.MSG_READ)
  @ApiOperation({ summary: 'پیام‌های یک گفتگو' })
  listChat(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listChatSchema)) dto: ListChatDto,
  ) {
    return this.messaging.listChat(tenantId, dto);
  }

  @Post('chats')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'ارسال پیام گفتگوی فردی + فایل' })
  sendChat(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('memberId') memberId: string,
    @Body(new ZodValidationPipe(sendChatSchema)) dto: SendChatDto,
  ) {
    return this.messaging.sendChat(tenantId, memberId, dto);
  }

  @Patch('chats/read')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'علامت‌گذاری گفتگو به‌عنوان خوانده‌شده' })
  markRead(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(markChatReadSchema)) dto: MarkChatReadDto,
  ) {
    return this.messaging.markChatRead(tenantId, dto);
  }

  @Post('sms-packages')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'ثبت بسته پیامکی (MSG-07)' })
  createPackage(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createSmsPackageSchema)) dto: CreateSmsPackageDto,
  ) {
    return this.messaging.createSmsPackage(tenantId, dto);
  }

  @Get('sms-packages')
  @RequirePermissions(PERMISSIONS.MSG_READ)
  @ApiOperation({ summary: 'بسته‌های پیامکی و مصرف' })
  listPackages(@CurrentUser('tenantId') tenantId: string) {
    return this.messaging.listSmsPackages(tenantId);
  }

  @Get('sms-usage')
  @RequirePermissions(PERMISSIONS.MSG_READ)
  @ApiOperation({ summary: 'گزارش مصرف پیامک (MSG-07)' })
  usage(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(usageQuerySchema)) dto: UsageQueryDto,
  ) {
    return this.messaging.smsUsageReport(tenantId, dto.from, dto.to);
  }
}
