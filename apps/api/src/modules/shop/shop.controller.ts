import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ShopService } from './shop.service.js';
import {
  catalogQuerySchema,
  createOrderSchema,
  listOrdersSchema,
  updateOrderStatusSchema,
  updateShippingSchema,
  type CatalogQueryDto,
  type CreateOrderDto,
  type ListOrdersDto,
  type UpdateOrderStatusDto,
  type UpdateShippingDto,
} from './dto/shop.schemas.js';

@ApiTags('shop')
@Controller('shop')
@RequireModule('SHOP')
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get('catalog')
  @RequirePermissions(PERMISSIONS.SHOP_READ)
  @ApiOperation({ summary: 'کاتالوگ محصولات (SHOP-01)' })
  catalog(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(catalogQuerySchema)) dto: CatalogQueryDto,
  ) {
    return this.shop.catalog(tenantId, dto);
  }

  @Post('orders')
  @RequirePermissions(PERMISSIONS.SHOP_WRITE)
  @ApiOperation({ summary: 'ثبت سفارش (SHOP-02)' })
  createOrder(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createOrderSchema)) dto: CreateOrderDto,
  ) {
    return this.shop.createOrder(tenantId, dto);
  }

  @Get('orders')
  @RequirePermissions(PERMISSIONS.SHOP_READ)
  @ApiOperation({ summary: 'فهرست سفارش‌ها' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listOrdersSchema)) dto: ListOrdersDto,
  ) {
    return this.shop.list(tenantId, dto);
  }

  @Get('orders/:id')
  @RequirePermissions(PERMISSIONS.SHOP_READ)
  @ApiOperation({ summary: 'جزئیات سفارش' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.shop.findOnePublic(tenantId, id);
  }

  @Get('orders/:id/slip')
  @RequirePermissions(PERMISSIONS.SHOP_READ)
  @ApiOperation({ summary: 'برگه سفارش (SHOP-05)' })
  slip(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.shop.slip(tenantId, id);
  }

  @Patch('orders/:id/status')
  @RequirePermissions(PERMISSIONS.SHOP_WRITE)
  @ApiOperation({ summary: 'تغییر وضعیت سفارش (SHOP-03)' })
  updateStatus(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateOrderStatusSchema)) dto: UpdateOrderStatusDto,
  ) {
    return this.shop.updateStatus(tenantId, id, dto);
  }

  @Patch('orders/:id/shipping')
  @RequirePermissions(PERMISSIONS.SHOP_WRITE)
  @ApiOperation({ summary: 'ثبت ارسال و رهگیری (SHOP-04)' })
  updateShipping(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateShippingSchema)) dto: UpdateShippingDto,
  ) {
    return this.shop.updateShipping(tenantId, id, dto);
  }
}
