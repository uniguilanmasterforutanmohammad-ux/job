# بازارگاه عمومی (Marketplace)

بازارگاه، لایهٔ **کشف** بین کسب‌وکارها و کاربران عادی است: محصولات همهٔ
فروشگاه‌ها و خدمات همهٔ اصناف در یک ویترین دیده می‌شود، اما خرید و پرداخت
همیشه به همان کسب‌وکار می‌رسد. این طراحی، ایزولاسیون multi-tenant را حفظ
می‌کند و پول از حساب پلتفرم عبور نمی‌کند.

## عضویت کسب‌وکار (opt-in)

- سوییچ `Tenant.marketplaceEnabled` در **تنظیمات ← بازارگاه عمومی** روشن شود.
- هر محصول با `Product.isPublic` و هر خدمت با `Service.isPublic` جداگانه منتشر می‌شود.
- نمایش عمومی فقط وقتی رخ می‌دهد که همهٔ شرط‌ها برقرار باشند:
  کسب‌وکار `ACTIVE` و حذف‌نشده، ماژول مربوطه فعال (`SHOP` برای محصول، `SCH`
  برای خدمت)، آیتم `isActive` و `isPublic`، و برای محصول `salePrice > 0`.

## مدل داده

| فیلد | جدول | کاربرد |
| --- | --- | --- |
| `marketplaceEnabled` | `tenants` | عضویت کسب‌وکار در بازارگاه |
| `tagline`, `city` | `tenants` | متن و شهر کارت کسب‌وکار |
| `isPublic`, `description` | `products` | انتشار و توضیح محصول |
| `isPublic`, `category`, `imageUrl` | `services` | انتشار، فیلتر و تصویر خدمت |

مهاجرت: `packages/db/prisma/migrations/20261029155338_marketplace_public_catalog`.

## API عمومی

همهٔ مسیرها زیر `@Public()` و با محدودیت نرخ (`@Throttle`) هستند:

| متد | مسیر | توضیح |
| --- | --- | --- |
| GET | `/api/v1/public/marketplace/products` | کاتالوگ محصولات + فیلتر و صفحه‌بندی |
| GET | `/api/v1/public/marketplace/products/:id` | جزئیات محصول |
| GET | `/api/v1/public/marketplace/services` | کاتالوگ خدمات + فیلتر و صفحه‌بندی |
| GET | `/api/v1/public/marketplace/services/:id` | جزئیات خدمت |
| GET | `/api/v1/public/marketplace/businesses` | کسب‌وکارهای عضو + تعداد آیتم‌ها |
| GET | `/api/v1/public/marketplace/businesses/:slug` | ویترین یک کسب‌وکار |
| GET | `/api/v1/public/marketplace/facets` | دسته‌ها و صنف‌های موجود |
| POST | `/api/v1/public/marketplace/otp/request` | کد تأیید خرید مهمان |
| POST | `/api/v1/public/marketplace/checkout` | ثبت سفارش با کد تأیید |
| GET | `/api/v1/public/marketplace/orders/track` | پیگیری با شمارهٔ سفارش + موبایل |

فیلترهای محصول: `search`, `industry`, `tenantSlug`, `category`, `minPrice`,
`maxPrice`, `inStock`, `sort` (`newest` | `price_asc` | `price_desc` | `name`),
`page`, `pageSize` (حداکثر ۴۸).

## جریان خرید

1. کاربر محصولی را به سبد اضافه می‌کند (سبد در `localStorage`، **مخصوص یک کسب‌وکار**).
2. شمارهٔ موبایل را وارد و کد یکبار مصرف دریافت می‌کند.
3. `POST /checkout` با `tenantSlug`، کد و اقلام:
   - کسب‌وکار از `slug` پیدا می‌شود (هیچ `tenantId` از کلاینت پذیرفته نمی‌شود).
   - قیمت و موجودی از دیتابیس خوانده و جمع سرور-محور محاسبه می‌شود.
   - با تأیید OTP، حساب پورتال (member + customer) ساخته/وصل می‌شود تا سفارش در
     `/me` هم دیده شود.
   - سفارش در همان tenant با `ShopService.createOrder` ثبت می‌شود و در صورت
     `payOnline` لینک پرداخت درگاه برگردانده می‌شود.
4. پیگیری با شمارهٔ سفارش + همان موبایل.

> هزینهٔ ارسال در MVP صفر ثبت می‌شود و به عهدهٔ فروشنده/هماهنگی است؛ وضعیت
> `PENDING` سفارش با تأیید فروشنده به `CONFIRMED` می‌رسد و آن‌جا موجودی انبار
> کسر می‌شود.

## صفحات وب

| مسیر | توضیح |
| --- | --- |
| `/marketplace` | خانهٔ بازارگاه: آمار، صنف‌ها، تازه‌ها و کسب‌وکارها |
| `/marketplace/products` | فهرست محصولات با فیلتر |
| `/marketplace/products/[id]` | جزئیات محصول + JSON-LD |
| `/marketplace/services` | فهرست خدمات/کلاس‌ها با فیلتر |
| `/marketplace/services/[id]` | جزئیات خدمت + تماس/رزرو |
| `/marketplace/businesses` | فهرست کسب‌وکارها |
| `/marketplace/b/[slug]` | ویترین یک کسب‌وکار |
| `/marketplace/cart` | سبد و پرداخت مهمان |
| `/marketplace/orders` | پیگیری سفارش |

صفحات کاتالوگ سمت سرور با `revalidate: 60` رندر می‌شوند؛ تغییر انتشار در پنل
حداکثر یک دقیقه بعد در صفحات دیده می‌شود.

## پنل کسب‌وکار

- **تنظیمات ← بازارگاه عمومی**: سوییچ نمایش، شعار، شهر و لینک ویترین.
- **انبار**: ستون «بازارگاه» برای انتشار/برداشتن محصول + دسته، تصویر و توضیح.
- **خدمات** (`/services`): ثبت خدمت و انتشار آن در بازارگاه.

## امنیت و محدودیت‌ها

- تنها سطح مجاز خواندن بین‌tenant همین ماژول است و فقط فیلدهای عمومی را برمی‌گرداند.
- خروجی محصول/خدمت شامل موجودی دقیق، قیمت خرید، اطلاعات تماس مشتریان یا دادهٔ
  داخلی نیست.
- نرخ درخواست‌های عمومی (فهرست‌ها ۹۰، OTP ۵، چک‌اوت ۱۰ در دقیقه) محدود شده است.
- پیگیری سفارش بدون شمارهٔ موبایلِ همان خریدار ممکن نیست.

### خارج از MVP (فاز بعد)

سبد چندکسب‌وکاره با تقسیم سفارش و تسویه/کمیسیون، نظرات و امتیاز خریداران،
نمایش «ویژه» و مدیریت محتوای بازارگاه در کنسول ادمین. این موارد به زیرساخت
تسویه و قواعد مالیاتی جداگانه نیاز دارند و عمداً به بعد از اثبات تقاضا موکول شده‌اند.

## تست

```bash
pnpm --filter @repo/api test        # شامل marketplace.service.spec.ts
pnpm --filter @repo/api typecheck
pnpm --filter @repo/web typecheck
pnpm --filter @repo/web lint
pnpm --filter @repo/web build
```

تست زندهٔ UI (نیازمند API و وب در حال اجرا):

```bash
node /tmp/cdp-verify-marketplace.mjs        # ۲۱ بررسی: سبد، OTP، سفارش، پیگیری
node /tmp/cdp-verify-marketplace-panel.mjs  # ۱۱ بررسی: پنل انتشار
```
