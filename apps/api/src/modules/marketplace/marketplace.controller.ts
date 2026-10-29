import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MarketplaceService } from './marketplace.service.js';
import {
  marketplaceBusinessesQuerySchema,
  marketplaceCheckoutSchema,
  marketplaceIdParamSchema,
  marketplaceOtpRequestSchema,
  marketplaceProductsQuerySchema,
  marketplaceServicesQuerySchema,
  marketplaceSlugParamSchema,
  marketplaceTrackQuerySchema,
  type MarketplaceBusinessesQueryDto,
  type MarketplaceCheckoutDto,
  type MarketplaceOtpRequestDto,
  type MarketplaceProductsQueryDto,
  type MarketplaceServicesQueryDto,
  type MarketplaceTrackQueryDto,
} from './dto/marketplace.schemas.js';

/**
 * Public marketplace (no authentication).
 *
 * Everything here is read-only discovery plus a guest checkout that verifies
 * the buyer's phone with OTP. Cross-tenant reads are confined to opted-in
 * businesses and explicitly published items.
 */
@ApiTags('marketplace')
@Controller('public/marketplace')
@Public()
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('products')
  @Throttle({ default: { limit: 90, ttl: 60_000 } })
  @ApiOperation({ summary: 'کاتالوگ عمومی محصولات همهٔ اصناف' })
  products(@Query(new ZodValidationPipe(marketplaceProductsQuerySchema)) dto: MarketplaceProductsQueryDto) {
    return this.marketplace.products(dto);
  }

  @Get('products/:id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'جزئیات محصول عمومی' })
  product(@Param('id', new ZodValidationPipe(marketplaceIdParamSchema)) id: string) {
    return this.marketplace.product(id);
  }

  @Get('services')
  @Throttle({ default: { limit: 90, ttl: 60_000 } })
  @ApiOperation({ summary: 'خدمات عمومی همهٔ اصناف (کلاس، جلسه، درمان…)' })
  services(@Query(new ZodValidationPipe(marketplaceServicesQuerySchema)) dto: MarketplaceServicesQueryDto) {
    return this.marketplace.services(dto);
  }

  @Get('services/:id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'جزئیات خدمت عمومی' })
  service(@Param('id', new ZodValidationPipe(marketplaceIdParamSchema)) id: string) {
    return this.marketplace.service(id);
  }

  @Get('businesses')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'کسب‌وکارهای عضو بازارگاه' })
  businesses(
    @Query(new ZodValidationPipe(marketplaceBusinessesQuerySchema)) dto: MarketplaceBusinessesQueryDto,
  ) {
    return this.marketplace.businesses(dto);
  }

  @Get('businesses/:slug')
  @Throttle({ default: { limit: 90, ttl: 60_000 } })
  @ApiOperation({ summary: 'ویترین عمومی یک کسب‌وکار' })
  business(@Param('slug', new ZodValidationPipe(marketplaceSlugParamSchema)) slug: string) {
    return this.marketplace.business(slug);
  }

  @Get('businesses/:slug/shipping')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'روش‌های ارسال یک کسب‌وکار برای سبد خرید' })
  shipping(@Param('slug', new ZodValidationPipe(marketplaceSlugParamSchema)) slug: string) {
    return this.marketplace.shippingOptions(slug);
  }

  @Get('facets')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'فیلترهای موجود (دسته‌ها و صنف‌ها)' })
  facets() {
    return this.marketplace.facets();
  }

  @Post('otp/request')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'درخواست کد تأیید شماره برای خرید مهمان' })
  requestOtp(@Body(new ZodValidationPipe(marketplaceOtpRequestSchema)) dto: MarketplaceOtpRequestDto) {
    return this.marketplace.requestOtp(dto.phone);
  }

  @Post('checkout')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'ثبت سفارش خریدار عادی (با تأیید کد یکبار مصرف)' })
  checkout(@Body(new ZodValidationPipe(marketplaceCheckoutSchema)) dto: MarketplaceCheckoutDto) {
    return this.marketplace.checkout(dto);
  }

  @Get('orders/track')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'پیگیری سفارش با شمارهٔ سفارش و موبایل' })
  track(@Query(new ZodValidationPipe(marketplaceTrackQuerySchema)) dto: MarketplaceTrackQueryDto) {
    return this.marketplace.track(dto);
  }
}
