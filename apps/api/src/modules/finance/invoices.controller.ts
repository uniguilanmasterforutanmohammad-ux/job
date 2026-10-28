import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PERMISSIONS } from '@repo/shared';
import { InvoicesService } from './invoices.service.js';
import {
  createInvoiceSchema,
  listInvoicesSchema,
  type CreateInvoiceDto,
  type ListInvoicesDto,
} from './dto/invoice.schemas.js';
import { convertProformaSchema, type ConvertProformaDto } from './dto/finance-extra.schemas.js';

@ApiTags('finance')
@Controller('invoices')
@RequireModule('FIN')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'صدور فاکتور' })
  create(@CurrentUser('tenantId') tenantId: string, @Body(new ZodValidationPipe(createInvoiceSchema)) dto: CreateInvoiceDto) {
    return this.invoices.create(tenantId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'فهرست فاکتورها' })
  list(@CurrentUser('tenantId') tenantId: string, @Query(new ZodValidationPipe(listInvoicesSchema)) dto: ListInvoicesDto) {
    return this.invoices.list(tenantId, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.FIN_READ)
  @ApiOperation({ summary: 'جزئیات فاکتور' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.invoices.findOne(tenantId, id);
  }

  @Patch(':id/cancel')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'لغو فاکتور' })
  cancel(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.invoices.cancel(tenantId, id);
  }

  @Patch(':id/convert')
  @RequirePermissions(PERMISSIONS.FIN_WRITE)
  @ApiOperation({ summary: 'تبدیل پیش‌فاکتور به فاکتور (FIN-02)' })
  convert(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(convertProformaSchema)) dto: ConvertProformaDto,
  ) {
    return this.invoices.convertProforma(tenantId, id, dto.dueDate);
  }
}
