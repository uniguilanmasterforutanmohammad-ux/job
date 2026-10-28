import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { InventoryService } from './inventory.service.js';
import {
  createMovementSchema,
  createProductSchema,
  createSupplierSchema,
  listMovementsSchema,
  listProductsSchema,
  stockCountSchema,
  transferStockSchema,
  updateProductSchema,
  type CreateMovementDto,
  type CreateProductDto,
  type CreateSupplierDto,
  type ListMovementsDto,
  type ListProductsDto,
  type StockCountDto,
  type TransferStockDto,
  type UpdateProductDto,
} from './dto/inventory.schemas.js';

@ApiTags('inventory')
@Controller('inventory')
@RequireModule('INV')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post('suppliers')
  @RequirePermissions(PERMISSIONS.INV_WRITE)
  @ApiOperation({ summary: 'ثبت تأمین‌کننده' })
  createSupplier(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createSupplierSchema)) dto: CreateSupplierDto,
  ) {
    return this.inventory.createSupplier(tenantId, dto);
  }

  @Get('suppliers')
  @RequirePermissions(PERMISSIONS.INV_READ)
  @ApiOperation({ summary: 'فهرست تأمین‌کنندگان' })
  listSuppliers(@CurrentUser('tenantId') tenantId: string) {
    return this.inventory.listSuppliers(tenantId);
  }

  @Post('products')
  @RequirePermissions(PERMISSIONS.INV_WRITE)
  @ApiOperation({ summary: 'ثبت کالا/خدمت (INV-01)' })
  createProduct(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductDto,
  ) {
    return this.inventory.createProduct(tenantId, dto);
  }

  @Get('products')
  @RequirePermissions(PERMISSIONS.INV_READ)
  @ApiOperation({ summary: 'فهرست کالاها' })
  listProducts(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listProductsSchema)) dto: ListProductsDto,
  ) {
    return this.inventory.listProducts(tenantId, dto);
  }

  @Get('products/barcode/:barcode')
  @RequirePermissions(PERMISSIONS.INV_READ)
  @ApiOperation({ summary: 'جست‌وجو با بارکد (INV-07)' })
  findByBarcode(@CurrentUser('tenantId') tenantId: string, @Param('barcode') barcode: string) {
    return this.inventory.findByBarcode(tenantId, barcode);
  }

  @Get('products/low-stock')
  @RequirePermissions(PERMISSIONS.INV_READ)
  @ApiOperation({ summary: 'هشدار حداقل موجودی (INV-03)' })
  lowStock(@CurrentUser('tenantId') tenantId: string) {
    return this.inventory.lowStock(tenantId);
  }

  @Get('products/expiring')
  @RequirePermissions(PERMISSIONS.INV_READ)
  @ApiOperation({ summary: 'کالاهای نزدیک انقضا (INV-06)' })
  expiring(@CurrentUser('tenantId') tenantId: string, @Query('days') days?: string) {
    return this.inventory.expiring(tenantId, days ? Number(days) : 30);
  }

  @Patch('products/:id')
  @RequirePermissions(PERMISSIONS.INV_WRITE)
  @ApiOperation({ summary: 'ویرایش کالا' })
  updateProduct(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) dto: UpdateProductDto,
  ) {
    return this.inventory.updateProduct(tenantId, id, dto);
  }

  @Delete('products/:id')
  @RequirePermissions(PERMISSIONS.INV_WRITE)
  @ApiOperation({ summary: 'حذف کالا' })
  removeProduct(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.inventory.removeProduct(tenantId, id);
  }

  @Post('movements')
  @RequirePermissions(PERMISSIONS.INV_WRITE)
  @ApiOperation({ summary: 'ثبت سند ورود/خروج (INV-04/05)' })
  createMovement(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createMovementSchema)) dto: CreateMovementDto,
  ) {
    return this.inventory.createMovement(tenantId, dto);
  }

  @Get('movements')
  @RequirePermissions(PERMISSIONS.INV_READ)
  @ApiOperation({ summary: 'فهرست اسناد انبار' })
  listMovements(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listMovementsSchema)) dto: ListMovementsDto,
  ) {
    return this.inventory.listMovements(tenantId, dto);
  }

  @Post('transfer')
  @RequirePermissions(PERMISSIONS.INV_WRITE)
  @ApiOperation({ summary: 'انتقال بین شعبه (INV-02)' })
  transfer(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(transferStockSchema)) dto: TransferStockDto,
  ) {
    return this.inventory.transfer(tenantId, dto);
  }

  @Post('reconcile')
  @RequirePermissions(PERMISSIONS.INV_WRITE)
  @ApiOperation({ summary: 'انبارگردانی (INV-08)' })
  reconcile(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(stockCountSchema)) dto: StockCountDto,
  ) {
    return this.inventory.reconcile(tenantId, dto);
  }
}
