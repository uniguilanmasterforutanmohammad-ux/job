import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ShopExtraService } from './shop-extra.service.js';
import { checkoutSchema, type CheckoutDto } from './dto/shop-extra.schemas.js';

@ApiTags('shop-extra')
@Controller('shop')
@RequireModule('SHOP')
export class ShopExtraController {
  constructor(private readonly shop: ShopExtraService) {}

  @Post('cart/quote')
  @RequirePermissions(PERMISSIONS.SHOP_READ)
  @ApiOperation({ summary: 'محاسبه سبد خرید (SHOP-02)' })
  quote(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(checkoutSchema)) dto: CheckoutDto,
  ) {
    return this.shop.quoteCart(tenantId, dto);
  }

  @Post('checkout')
  @RequirePermissions(PERMISSIONS.SHOP_WRITE)
  @ApiOperation({ summary: 'پرداخت سبد خرید (SHOP-02)' })
  checkout(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(checkoutSchema)) dto: CheckoutDto,
  ) {
    return this.shop.checkout(tenantId, dto);
  }
}
