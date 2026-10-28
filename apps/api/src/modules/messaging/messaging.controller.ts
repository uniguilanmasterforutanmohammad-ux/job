import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PERMISSIONS } from '@repo/shared';
import { MessagingService } from './messaging.service.js';
import { MessageTemplateService } from './template.service.js';
import {
  bulkSendSchema,
  createTemplateSchema,
  listMessagesSchema,
  sendMessageSchema,
  setConsentSchema,
  type BulkSendDto,
  type CreateTemplateDto,
  type ListMessagesDto,
  type SendMessageDto,
  type SetConsentDto,
} from './dto/message.schemas.js';

@ApiTags('messaging')
@Controller('messages')
@RequireModule('MSG')
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly templates: MessageTemplateService,
  ) {}

  @Post('templates/seed')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'ایجاد قالب‌های پیش‌فرض' })
  seedTemplates(@CurrentUser('tenantId') tenantId: string) {
    return this.templates.seedDefaults(tenantId);
  }

  @Post('templates')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'ثبت قالب پیام' })
  createTemplate(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createTemplateSchema)) dto: CreateTemplateDto,
  ) {
    return this.templates.create(tenantId, dto);
  }

  @Get('templates')
  @RequirePermissions(PERMISSIONS.MSG_READ)
  @ApiOperation({ summary: 'فهرست قالب‌ها' })
  listTemplates(@CurrentUser('tenantId') tenantId: string) {
    return this.templates.list(tenantId);
  }

  @Patch('templates/:id')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'ویرایش قالب' })
  updateTemplate(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateTemplateDto>,
  ) {
    return this.templates.update(tenantId, id, dto);
  }

  @Delete('templates/:id')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'حذف قالب' })
  removeTemplate(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.templates.remove(tenantId, id);
  }

  @Post('consent')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'ثبت/لغو رضایت دریافت پیام' })
  setConsent(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(setConsentSchema)) dto: SetConsentDto,
  ) {
    return this.messaging.setConsent(tenantId, dto);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'ارسال پیام' })
  send(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) dto: SendMessageDto,
  ) {
    return this.messaging.send(tenantId, dto);
  }

  @Post('bulk')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'ارسال گروهی' })
  bulkSend(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(bulkSendSchema)) dto: BulkSendDto,
  ) {
    return this.messaging.bulkSend(tenantId, dto);
  }

  @Get('stats')
  @RequirePermissions(PERMISSIONS.MSG_READ)
  @ApiOperation({ summary: 'آمار ارسال' })
  stats(@CurrentUser('tenantId') tenantId: string) {
    return this.messaging.stats(tenantId);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.MSG_READ)
  @ApiOperation({ summary: 'فهرست پیام‌ها' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listMessagesSchema)) dto: ListMessagesDto,
  ) {
    return this.messaging.list(tenantId, dto);
  }
}
