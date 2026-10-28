import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PERMISSIONS } from '@repo/shared';
import { CustomersService } from './customers.service.js';
import {
  createCustomerSchema,
  listCustomersSchema,
  updateCustomerSchema,
  type CreateCustomerDto,
  type ListCustomersDto,
  type UpdateCustomerDto,
} from './dto/customer.schemas.js';

@ApiTags('crm')
@Controller('customers')
@RequireModule('CRM')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: 'ثبت مشتری جدید' })
  create(@CurrentUser('tenantId') tenantId: string, @Body(new ZodValidationPipe(createCustomerSchema)) dto: CreateCustomerDto) {
    return this.customers.create(tenantId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: 'فهرست مشتریان' })
  list(@CurrentUser('tenantId') tenantId: string, @Query(new ZodValidationPipe(listCustomersSchema)) dto: ListCustomersDto) {
    return this.customers.list(tenantId, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CRM_READ)
  @ApiOperation({ summary: 'پرونده مشتری' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.customers.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: 'ویرایش مشتری' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) dto: UpdateCustomerDto,
  ) {
    return this.customers.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  @ApiOperation({ summary: 'حذف مشتری' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.customers.remove(tenantId, id);
  }
}
