# مدل امنیتی

این سند تصمیم‌های امنیتی کلیدی پلتفرم و محل پیاده‌سازی آن‌ها را ثبت می‌کند.

## ۱) جداسازی دامنه‌ی توکن (کسب‌وکار ↔ پلتفرم)

توکن بنل ادمین کل و توکن کسب‌وکار هرگز قابل استفاده‌ی متقابل نیستند:

- توکن پلتفرم با کلید امضای جداگانه (`platformJwt.secret`) و claim
  `scope: 'platform'` صادر می‌شود (`PlatformTokenService` →
  `apps/api/src/modules/admin/platform-token.service.ts`).
- `PlatformAuthGuard` هر توکنی که scope آن `platform` نباشد را رد می‌کند.
- توکن چالش ۲FA با `typ: '2fa_challenge'` امضا می‌شود و **عمداً** توسط
  `PlatformAuthGuard` رد می‌شود (`validate()` روی `typ` چک می‌کند).
  این رفتار در `platform-token.service.spec.ts` تست شده است.

## ۲) احراز دو مرحله‌ای اجباری مدیران (TOTP)

- مقدار با `PLATFORM_2FA_REQUIRED` کنترل می‌شود (پیش‌فرض: production روشن، dev خاموش).
- فیلدهای `twoFactorEnabled` / `twoFactorSecret` / `twoFactorConfirmedAt` /
  `twoFactorLastTimeStep` روی `PlatformMember`.
- **ضدتکرار (replay):** هر `timeStep` مصرف‌شده ذخیره و کد تکراری رد می‌شود
  (`totp.service.ts` با `afterTimeStep`).
- گارد `TwoFactorEnforcementGuard` روی `AdminController`؛ در صورت نیاز به ثبت‌نام،
  پاسخ `403` با کد `TWO_FACTOR_SETUP_REQUIRED` و فرانت به `/admin/account` هدایت می‌کند.
- مسیرهای ثبت‌نام (`setup`/`confirm`/`disable`/`account`) استثنا هستند تا کاربر
  بتواند الزام را برآورده کند.

## ۳) گیتینگ ماژول در زمان درخواست

- `ModuleAccessService` با کش کوتاه Redis کلید `module-access:<tenantId>`.
- دکوراتور `@RequireModule('XX')` + گارد سراسری `ModuleAccessGuard` (پس از
  `PermissionsGuard`). مسیرهای `@Public()` / `@ModuleOptional()` / بدون دکوراتور
  آزاد می‌مانند (مثلاً `/auth/me`، marketplace ماژول‌ها، روت‌های عمومی).
- خطای ماژول غیرفعال: `403` با کد `MODULE_DISABLED` (متمایز از `FORBIDDEN` عمومی
  تا فرانت پیام مناسب نشان دهد).
- هر تغییر دسترسی ماژول (خود کسب‌وکار یا ادمین) کش را بی‌اعتبار می‌کند تا اثر
  فوری باشد.

## ۴) ایزوله‌سازی چندمستأجری

- `tenantId` و `branchId` همیشه از کاربر احراز‌شده (`@CurrentUser`) گرفته می‌شود،
  هرگز از ورودی کلاینت.
- هر کوئری کسب‌وکار با `tenantId` محدود می‌شود.
- در بنل ادمین، `tenantId` از URL گرفته می‌شود اما دسترسی با نقش‌های
  `SUPER_ADMIN` / `ADMIN` / `SUPPORT` کنترل می‌شود (`PlatformRolesGuard`).

## ۵) اعتبارسنجی و خطا

- همه‌ی بدنه‌ها با Zod (`ZodValidationPipe`) در سطح پارامتر اعتبارسنجی می‌شوند.
- فیلتر `AllExceptionsFilter` هیچ stack trace یا پیام داخلی را بیرون نمی‌دهد؛
  خطاهای ۵۰۰ فقط سرور‌ساید لاگ می‌شوند.
- نرخ‌بندی درخواست با `ThrottlerGuard`؛ مسیرهای حساس (OTP و ۲FA) با `@Throttle`
  سخت‌گیرانه‌تر محدود شده‌اند.

## ۶) رمزنگاری و نشست

- رمز عبور مدیران پلتفرم با **argon2** هش می‌شود.
- کدهای OTP فقط هش‌شده ذخیره می‌شوند و هرگز لاگ نمی‌شوند (`maskPhone`).
- refresh token به‌صورت تصادفی (`randomBytes(48)`) تولید و **هش‌شده** در دیتابیس
  ذخیره می‌شود؛ فقط access token کوتاه‌عمر امضا می‌شود.
- کوکی‌های احراز هویت httpOnly هستند (`bp_access`, `bp_refresh`,
  `bp_platform_access`, `bp_platform_refresh`).

## ۷) ممیزی

- تمام تغییرات مدیران پلتفرم در `PlatformAuditLog` (قبل/بعد، IP، user-agent) ثبت می‌شود.
- تغییرات کسب‌وکار در `AuditLog` توسط `AuditInterceptor` ثبت می‌شود؛ فیلدهای
  حساس (`password`, `code`, `refreshToken`, ...) پیش از ذخیره redact می‌شوند.

## موارد باز (تا خرید سرویس بیرونی)

- اعتبارنامه‌ی درگاه پرداخت واقعی و سرویس پیامک واقعی هنوز تنظیم نشده؛ حالت‌های
  `mock` و `console` برای توسعه فعال‌اند. پس از تهیه، فقط provider و env اضافه می‌شود.
