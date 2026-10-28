import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { DocumentsExtraService } from './documents-extra.service.js';
import {
  createConsentFormSchema,
  expiryReminderSchema,
  listConsentFormsSchema,
  signConsentFormSchema,
  type CreateConsentFormDto,
  type ExpiryReminderDto,
  type ListConsentFormsDto,
  type SignConsentFormDto,
} from './dto/document-extra.schemas.js';

@ApiTags('documents-extra')
@Controller('documents')
@RequireModule('DOC')
export class DocumentsExtraController {
  constructor(private readonly documents: DocumentsExtraService) {}

  @Post('consent-forms')
  @RequirePermissions(PERMISSIONS.DOC_WRITE)
  @ApiOperation({ summary: 'ثبت رضایت‌نامه (DOC-05)' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createConsentFormSchema)) dto: CreateConsentFormDto,
  ) {
    return this.documents.createConsentForm(tenantId, dto);
  }

  @Get('consent-forms')
  @RequirePermissions(PERMISSIONS.DOC_READ)
  @ApiOperation({ summary: 'فهرست رضایت‌نامه‌ها' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listConsentFormsSchema)) dto: ListConsentFormsDto,
  ) {
    return this.documents.listConsentForms(tenantId, dto);
  }

  @Patch('consent-forms/:id/sign')
  @RequirePermissions(PERMISSIONS.DOC_WRITE)
  @ApiOperation({ summary: 'امضای رضایت‌نامه' })
  sign(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(signConsentFormSchema)) dto: SignConsentFormDto,
  ) {
    return this.documents.signConsentForm(tenantId, id, dto);
  }

  @Patch('consent-forms/:id/revoke')
  @RequirePermissions(PERMISSIONS.DOC_WRITE)
  @ApiOperation({ summary: 'لغو رضایت‌نامه' })
  revoke(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.documents.revokeConsentForm(tenantId, id);
  }

  @Post('expiry-reminders/run')
  @RequirePermissions(PERMISSIONS.DOC_WRITE)
  @ApiOperation({ summary: 'اجرای یادآور انقضا (DOC-04)' })
  reminders(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(expiryReminderSchema)) dto: ExpiryReminderDto,
  ) {
    return this.documents.runExpiryReminders(tenantId, dto);
  }
}
