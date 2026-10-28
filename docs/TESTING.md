# راهنمای تست

تست‌های این پروژه با **Vitest** نوشته شده‌اند و در دو بسته اجرا می‌شوند:

| بسته           | مسیر تست‌ها                                                | دستور                             |
| -------------- | ---------------------------------------------------------- | --------------------------------- |
| `@repo/api`    | `apps/api/src/**/*.spec.ts` و `apps/api/test/**/*.spec.ts` | `pnpm --filter @repo/api test`    |
| `@repo/shared` | `packages/shared/src/**/*.spec.ts`                         | `pnpm --filter @repo/shared test` |

اجرای همه با یک دستور:

```bash
pnpm test          # turbo run test (هر دو بسته)
```

## لایه‌های تست

### ۱) تست واحد (Unit)

بدون I/O واقعی و با دوبل‌های ساده (`vi.fn()`). سریع‌اند و در CI همیشه اجرا
می‌شوند. تمرکز فعلی روی منطق حساس است:

| فایل                                                                     | چه‌چیزی را تضمین می‌کند                          |
| ------------------------------------------------------------------------ | ------------------------------------------------ |
| `apps/api/src/common/pipes/zod-validation.pipe.spec.ts`                  | اعتبارسنجی Zod، coercion، پیام خطای مسیردار      |
| `apps/api/src/common/filters/all-exceptions.filter.spec.ts`              | نگاشت خطاها، عدم افشای جزئیات ۵۰۰                |
| `apps/api/src/common/guards/module-access.guard.spec.ts`                 | گیتینگ ماژول و کد `MODULE_DISABLED`              |
| `apps/api/src/modules/admin/guards/two-factor-enforcement.guard.spec.ts` | اجبار ۲FA و کد `TWO_FACTOR_SETUP_REQUIRED`       |
| `apps/api/src/modules/admin/platform-token.service.spec.ts`              | جداسازی توکن پلتفرم از توکن چالش ۲FA (امنیت)     |
| `apps/api/src/modules/admin/admin-module.service.spec.ts`                | حل وابستگی، آبشار معکوس، ممیزی، بی‌اعتبارسازی کش |
| `apps/api/src/modules/tenants/module-access.service.spec.ts`             | کش ۶۰ثانیه‌ای و invalidate                       |
| `apps/api/src/modules/tenants/tenants.service.spec.ts`                   | فعال/غیرفعال‌سازی ماژول توسط خود کسب‌وکار        |
| `apps/api/src/modules/auth/totp.service.spec.ts`                         | تولید/تأیید TOTP و ضدتکرار (replay)              |
| `apps/api/src/modules/auth/otp.service.spec.ts`                          | هش کد، انقضا، سقف تلاش، throttle                 |
| `apps/api/src/modules/payments/providers/*.spec.ts`                      | رجیستری درگاه + رفتار provider شبیه‌ساز          |
| `packages/shared/src/*.spec.ts`                                          | رجیستری ماژول، حل وابستگی، مجوزها                |
| `apps/api/src/common/dto/date-only.dto.spec.ts`                           | روز تقویمی UTC برای ستون‌های `@db.Date` (بدون یک‌روز‌جابه‌جایی) |
| `apps/api/src/modules/attendance/absence-request.service.spec.ts`        | چرخهٔ درخواست غیبت موجه شاگرد و تأیید/رد مربی     |
| `apps/api/src/modules/attendance/attendance-qr.service.spec.ts`          | حاضری QR/لینک و پنل شاگرد، توکن چرخشی، ضدتکرار   |

### ۲) تست دودی زنده (Live smoke)

فایل `apps/api/test/smoke.e2e.spec.ts` چند مسیر کلیدی را روی **API در حال اجرا**
می‌سنجد: سلامت، ورود OTP کسب‌وکار، رد درخواست بدون توکن، و ورود بنل ادمین.

این تست‌ها وقتی API در دسترس نباشد **به‌صورت خودکار skip** می‌شوند، پس `pnpm test`
در CI بدون دیتابیس هم سبز می‌ماند؛ اما اگر استک را بالا آورده باشی، همان تست‌ها
واقعاً اجرا می‌شوند:

```bash
docker compose -f docker-compose.dev.yml up -d
pnpm db:migrate && pnpm db:seed
(setsid node apps/api/dist/main.js > /tmp/api.log 2>&1 < /dev/null &)
pnpm --filter @repo/api test        # تست‌های زنده اجرا می‌شوند
```

آدرس API با `SMOKE_API_URL` قابل تغییر است (پیش‌فرض `http://localhost:4000`).

## قواعد افزودن تست

- فایل تست کنار سورس با پسوند `.spec.ts` قرار می‌گیرد.
- ایمپورت‌ها ESM با پسوند `.js` (مطابق کانوانسیون پروژه).
- برای منطق جدید (guard/service/pipe)، حداقل یک مسیر موفق و یک مسیر خطا تست شود.
- هر فایل تست برای یک تسک، در بالای فایل کامنت مرجع تسک دارد
  (`// TaskForMyAgent — <عنوان تسک>`) و نتیجهٔ اجرا در `docs/AGENT_RULES.md`
  ثبت می‌شود. اکانت‌های لازم برای تست دستی در `docs/DEV_ACCOUNTS.md` است.
- از تماس شبکه‌ای یا دیتابیس واقعی در تست واحد پرهیز کن؛ آن را به لایه smoke بسپار.

## چیزهایی که هنوز تست E2E کامل ندارند

فلوی کامل پرداخت آنلاین (callback درگاه) و جریان چندمرحله‌ای ۲FA در سطح HTTP
فعلاً فقط دستی و از طریق smoke تست می‌شوند؛ افزودن تست E2E خودکار برای این دو
نیازمند راه‌اندازی دیتابیس تست مستقل است.
