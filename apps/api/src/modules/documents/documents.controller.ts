import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { DocumentsService } from './documents.service.js';
import {
  createContractSchema,
  createContractTemplateSchema,
  createDocumentSchema,
  listContractsSchema,
  listDocumentsSchema,
  signContractSchema,
  updateContractStatusSchema,
  updateContractTemplateSchema,
  type CreateContractDto,
  type CreateContractTemplateDto,
  type CreateDocumentDto,
  type ListContractsDto,
  type ListDocumentsDto,
  type SignContractDto,
  type UpdateContractStatusDto,
  type UpdateContractTemplateDto,
} from './dto/document.schemas.js';

@ApiTags('documents')
@Controller('documents')
@RequireModule('DOC')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('templates')
  @RequirePermissions(PERMISSIONS.DOC_WRITE)
  @ApiOperation({ summary: 'ثبت قالب قرارداد (DOC-01)' })
  createTemplate(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createContractTemplateSchema)) dto: CreateContractTemplateDto,
  ) {
    return this.documents.createTemplate(tenantId, dto);
  }

  @Get('templates')
  @RequirePermissions(PERMISSIONS.DOC_READ)
  @ApiOperation({ summary: 'فهرست قالب‌های قرارداد' })
  listTemplates(@CurrentUser('tenantId') tenantId: string) {
    return this.documents.listTemplates(tenantId);
  }

  @Patch('templates/:id')
  @RequirePermissions(PERMISSIONS.DOC_WRITE)
  @ApiOperation({ summary: 'ویرایش قالب قرارداد' })
  updateTemplate(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateContractTemplateSchema)) dto: UpdateContractTemplateDto,
  ) {
    return this.documents.updateTemplate(tenantId, id, dto);
  }

  @Delete('templates/:id')
  @RequirePermissions(PERMISSIONS.DOC_WRITE)
  @ApiOperation({ summary: 'حذف قالب قرارداد' })
  removeTemplate(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.documents.removeTemplate(tenantId, id);
  }

  @Post('contracts')
  @RequirePermissions(PERMISSIONS.DOC_WRITE)
  @ApiOperation({ summary: 'ایجاد قرارداد (DOC-01)' })
  createContract(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createContractSchema)) dto: CreateContractDto,
  ) {
    return this.documents.createContract(tenantId, dto);
  }

  @Get('contracts')
  @RequirePermissions(PERMISSIONS.DOC_READ)
  @ApiOperation({ summary: 'فهرست قراردادها' })
  listContracts(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listContractsSchema)) dto: ListContractsDto,
  ) {
    return this.documents.listContracts(tenantId, dto);
  }

  @Post('contracts/:id/sign')
  @RequirePermissions(PERMISSIONS.DOC_WRITE)
  @ApiOperation({ summary: 'امضای الکترونیکی (DOC-02)' })
  sign(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(signContractSchema)) dto: SignContractDto,
  ) {
    return this.documents.sign(tenantId, id, dto);
  }

  @Patch('contracts/:id/status')
  @RequirePermissions(PERMISSIONS.DOC_WRITE)
  @ApiOperation({ summary: 'تغییر وضعیت قرارداد' })
  updateStatus(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateContractStatusSchema)) dto: UpdateContractStatusDto,
  ) {
    return this.documents.updateStatus(tenantId, id, dto);
  }

  @Get('expiring')
  @RequirePermissions(PERMISSIONS.DOC_READ)
  @ApiOperation({ summary: 'یادآور انقضا (DOC-04)' })
  expiring(@CurrentUser('tenantId') tenantId: string, @Query('days') days?: string) {
    return this.documents.expiring(tenantId, days ? Number(days) : 30);
  }

  @Post('files')
  @RequirePermissions(PERMISSIONS.DOC_WRITE)
  @ApiOperation({ summary: 'ثبت سند در بایگانی (DOC-03)' })
  createDocument(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createDocumentSchema)) dto: CreateDocumentDto,
  ) {
    return this.documents.createDocument(tenantId, dto);
  }

  @Get('files')
  @RequirePermissions(PERMISSIONS.DOC_READ)
  @ApiOperation({ summary: 'فهرست اسناد' })
  listDocuments(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listDocumentsSchema)) dto: ListDocumentsDto,
  ) {
    return this.documents.listDocuments(tenantId, dto);
  }

  @Delete('files/:id')
  @RequirePermissions(PERMISSIONS.DOC_WRITE)
  @ApiOperation({ summary: 'حذف سند' })
  removeDocument(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.documents.removeDocument(tenantId, id);
  }
}
