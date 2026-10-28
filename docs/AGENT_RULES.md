# قوانین ایجنت (Agent Rules) — الزامی

این فایل **جزئی از قوانین ایجنت** است: در `AGENTS.md` به آن ارجاع داده شده و در
هر اجرا باید رعایت شود. اگر بین این فایل و یک درخواست مستقیم کاربر تناقض بود،
درخواست کاربر اولویت دارد.

---

## ۱) کامیت بعد از هر تسک — حتی هر مرحلهٔ مستقل

- هر تسک، و اگر تسک چند مرحله‌ای است **هر مرحلهٔ آن**، جداگانه و بلافاصله
  کامیت می‌شود؛ کار تمام‌شده نباید بدون کامیت بماند.
- قالب پیام کامیت:
  ```
  <type>(<scope>): <خلاصهٔ کوتاه>

  بدنه: چه چیزی تغییر کرد و چرا (فارسی).

  تست‌شده: <دستورها و نتیجه>
  ```
  `type` ∈ `feat | fix | refactor | docs | test | chore | perf`
- `node_modules`، `dist`، فایل‌های `.env` و دادهٔ خروجی هرگز کامیت نمی‌شوند.
- هر کامیت در جدول «ثبت کامیت‌ها» در همین فایل ثبت می‌شود (لاگ هر کامیت
  حداکثر در کامیت بعدی اضافه می‌شود؛ کامیت ثبت لاگ خودش در تسک بعدی ثبت می‌گردد).

## ۲) هر تست را با یک کامنت مشخص کن

- هر فایل تست که برای یک تسک ساخته یا تغییر می‌دهی، بالای فایل یک کامنت مرجع
  تسک داشته باشد:
  ```ts
  // TaskForMyAgent — <عنوان تسک>
  ```
- برای تست‌های دستی/زنده (HTTP، دیتابیس، UI) هم نتیجه‌اش در جدول «تست‌های
  اجراشده» (یا جدول لاگ همان `docs/*.md`) با تاریخ و نتیجه ثبت می‌شود.
- تا وقتی تست‌ها سبز نشده‌اند، تسک «تمام‌شده» اعلام نمی‌شود.

## ۳) ثبت کامنت «تکمیل شد» در `TaskForMyAgent.md`

- هر تسکی که از `TaskForMyAgent.md` دریافت و تمام شد، **بلافاصله** در همان فایل و
  دقیقاً **زیر همان تسک** یک خط کامنت اضافه می‌شود:
  ```
      ✅ **تکمیل شد** — <تاریخ جلالی> — کامیت: `<hash>` — <چه کاری انجام شد / تست>
  ```
- تسک چندبخشی (a، b، c، …): زیر هر زیربند هم یک خط `✅` جداگانه گذاشته می‌شود.
- متن خود کاربر هرگز تغییر نمی‌کند؛ فقط خطوط جدید اضافه می‌شود (تأیید با
  `git diff` که باید فقط insert باشد).
- بعد از افزودن کامنت‌ها، `TaskForMyAgent.md` کامیت می‌شود.

## ۴) پایان هر اجرا: خواندن دوبارهٔ `TaskForMyAgent.md`

- در انتهای کار — پس از اتمام کامل همهٔ مراحل و وقتی کار بازی نمی‌ماند — **یک
  بار** فایل `TaskForMyAgent.md` دوباره خوانده می‌شود (و کامنت‌های بند ۳ هم
  بررسی می‌شوند که زیر همهٔ تسک‌های انجام‌شده ثبت شده باشند).
- اگر تسک جدیدی به آن اضافه شده باشد، همان اجرا و به‌صورت خودکار انجام، تست و
  کامیت می‌شود، در جدول زیر ثبت می‌گردد و کامنت تکمیل آن زیر تسک گذاشته می‌شود.
- اگر تسک بازی نماند، در پاسخ نهایی صریحاً گفته می‌شود «تسک بازی نمانده».

## ۵) قواعد پروژه (خلاصه)

- جزئیات کامل در `AGENTS.md`؛ مهم‌ترین‌ها: ESM + پسوند `.js` در importها،
  ایزوله‌سازی با `tenantId`، اعتبارسنجی Zod در سطح پارامتر، و env schema.

## ۶) مسیرهای مرجع

| مورد                   | فایل                                |
| ---------------------- | ----------------------------------- |
| صندوق تسک‌ها            | `TaskForMyAgent.md`                 |
| اکانت‌های محیط توسعه    | `docs/DEV_ACCOUNTS.md`              |
| وضعیت پروژه            | `docs/STATUS.md`                    |
| راهنمای تست            | `docs/TESTING.md`                   |
| مدل تهدید / امنیت      | `docs/SECURITY.md`                  |

---

## ثبت کامیت‌ها (Commit Registry)

| # | تسک                                                                 | کامیت     | توضیح                                                                 |
| - | ------------------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| ۱ | بررسی `.gitignore` و نخستین کامیت پروژه                             | `799d2cd` | `feat: initial commit — multi-tenant business platform`                |
| ۲ | ماژول حضور و غیاب — درخواست غیبت موجه شاگرد + بررسی/تأیید مربی      | `bed46a0` | `feat(att): student absence/excuse requests with coach review (ATT-03)` |
| ۳ | پنل کاربر نهایی (شاگرد) + حاضری از پنل/لینک — همراه کامیت اول        | `799d2cd` | در همان کامیت اولیه (`/student`, `/app/*`, `public check-in`)          |
| ۴ | رفع باگ تاریخ یک‌روز-عقب در ستون‌های `@db.Date`                       | `13afc8c` | `fix(attendance): store calendar days at UTC midnight`                 |
| ۵ | فایل راهنمای اکانت‌های محیط توسعه                                    | `20466e2` | `docs(dev): add development accounts guide`                            |
| ۶ | فایل قوانین ایجنت + ارجاع در `AGENTS.md` + کامنت تسک روی تست‌ها       | `c943115` | `docs(agent): add agent rules file with commit/test registry`          |
| ۷ | ثبت کامیت‌ها در جدول لاگ + به‌روزرسانی `TaskForMyAgent.md`               | `27ad93f` | `chore(agent): register task commits and task-file update`             |
| ۸ | صفحهٔ اصلی (لندینگ) + ثبت‌نام کسب‌وکار + نام‌گذاری درست پنل مشتری (۳ مرحله) | `cde87ec`، `11dc556`، `4b59393` | `refactor(naming)` → `feat(web): landing` → `feat(web): register` |
| ۹ | به‌روزرسانی مستندات (STATUS/DEV_ACCOUNTS) و ثبت آن در این جدول           | این کامیت | `docs: status + dev accounts for landing/register/customer portal`      |
| ۱۰ | شفاف‌سازی «ثبت‌نام مشتری» در پنل `/me`                                   | `a1a3fd7` | `feat(web): make consumer signup explicit in the /me portal`            |
| ۱۱ | ثبت ردیف‌های ۹ و ۱۰ در همین جدول                                        | `3cc7e24` | `docs(agent): log landing/register commits in registry`                 |
| ۱۲ | کامنت «✅ تکمیل شد» زیر همهٔ تسک‌های انجام‌شدهٔ `TaskForMyAgent.md`        | `6279c25` | `docs(taskfile): mark every completed task with a completion comment`   |
| ۱۳ | قانون ثبت کامنت تکمیل در قوانین ایجنت + `AGENTS.md`                      | `d8f8137` | `docs(agent): require a completion comment under every finished task`   |
| ۱۴ | ثبت ردیف‌های ۱۲ و ۱۳ در همین جدول                                        | این کامیت | `docs(agent): log taskfile annotation commits`                          |
| ۱۵ | ماژول پیش‌فرض صنف مشترک (`defaultModulesForIndustry`)                    | `5a9a0a6` | `feat(shared): add defaultModulesForIndustry helper`                    |
| ۱۶ | ساخت کسب‌وکار در API ادمین + نمایش پیش‌فرض‌های صنف                       | `0374bc0` | `feat(admin): create businesses and surface industry default modules`   |
| ۱۷ | فهرست عمومی کسب‌وکارهای فعال برای ثبت‌نام کاربر جدید                      | `0fd023e` | `feat(app): active-only business directory for new-user signup`         |
| ۱۸ | UI کنسول ادمین: ساخت کسب‌وکار، ماژول‌ها، فعال/غیرفعال‌سازی                | `1a3b16d` | `feat(web-admin): business creation, module defaults and status toggle` |
| ۱۹ | انتخاب کسب‌وکار از فهرست فعال در پنل مشتری `/me`                          | `b414c6f` | `feat(web-me): pick a business from the active directory on signup`     |
| ۲۰ | ثبت ردیف‌های ۱۵ تا ۱۹ + مستندات وضعیت و کامنت‌های تسک‌فایل                | `44525fe` | `docs(agent): log admin-console commits, status and taskfile completion notes` |
| ۲۱ | جدول‌های رجیستری صنف + مهاجرت seed (۱۷ صنف، ۸۳ ماژول پیش‌فرض)            | `c43332e` | `feat(db): industry settings + editable default modules`                |
| ۲۲ | API رجیستری صنف + گیت ثبت‌نام + اندپوینت‌های ادمین/عمومی                   | `af88110` | `feat(api): industry registry — per-industry registration gate + editable default modules` |
| ۲۳ | صفحهٔ `/admin/industries` (سوییچ ثبت‌نام + ویرایش ماژول‌های پیش‌فرض)        | `78a6c8d` | `feat(web-admin): industry console — registration gate + default module editor` |
| ۲۴ | صفحهٔ `/register` متصل به رجیستری صنف‌ها                                  | `783adb6` | `feat(web): register page reads the industry registry`                  |
| ۲۵ | ثبت ردیف‌های ۲۱ تا ۲۴ + مستندات وضعیت و کامنت‌های تسک‌فایل                | `02e94c3` | `docs(agent): log industry-registry commits, status and taskfile notes`  |
| ۲۶ | پیش‌انتخاب پیش‌فرض‌های رجیستری در دیالوگ «کسب‌وکار جدید»                  | `c498352` | `fix(web-admin): preselect the registry defaults in the create-business dialog` |
| ۲۷ | ثبت ردیف ۲۶ در همین جدول                                              | `b3f9183` | `docs(agent): register the create-dialog fix commit`                    |
| ۲۸ | صنف داده‌محور: جدول `industries`، مهاجرت و API ساخت/ویرایش/حذف صنف       | `2972e0b` | `feat(api): data-driven industry registry with admin CRUD`              |
| ۲۹ | کنسول ادمین: ساخت/ویرایش/حذف صنف + ماژول‌های پیش‌فرض                     | `38614a4` | `feat(web-admin): build/rename/delete industries from the console`      |
| ۳۰ | نام صنف و کاربران نهایی از رجیستری در همهٔ صفحات وب                     | `d9bb9fc` | `feat(web): name industries and their end-users from the registry`      |
| ۳۱ | ثبت ردیف‌های ۲۷ تا ۳۰ + مستندات وضعیت و کامنت‌های تسک‌فایل               | `a6bab1f` | `docs(agent): log data-driven-industry commits and update status`       |
| ۳۲ | ثبت ردیف ۳۱ در همین جدول                                              | این کامیت | `docs(agent): register the data-driven-industry log commit`             |

> کامیت ثبت لاگ هر ردیف در اجرای بعدی در جدول ثبت می‌شود؛ چون
> هیچ کامیتی نمی‌تواند هش خودش را درون خودش داشته باشد.

## تست‌های اجراشده (Test Log)

| تسک                    | نوع تست        | مسیر / دستور                                                                 | نتیجه |
| ---------------------- | -------------- | ---------------------------------------------------------------------------- | ----- |
| ۲ — درخواست غیبت       | واحد           | `apps/api/src/modules/attendance/absence-request.service.spec.ts` (۶ تست)      | ✅ |
| ۲ — بررسی مربی         | زنده (HTTP)    | ساخت درخواست شاگرد → اینباکس مربی → تأیید → رکورد `EXCUSED`                    | ✅ |
| ۳ — پنل شاگرد          | زنده (HTTP)    | `POST /app/auth/otp/verify-global`، `GET /app/clubs\|attendance\|absence-requests` | ✅ |
| ۴ — رفع باگ تاریخ      | واحد           | `apps/api/src/common/dto/date-only.dto.spec.ts` (۶ تست)                        | ✅ ۶/۶ |
| ۴ — رگرسیون تاریخ      | واحد           | `attendance-qr.service.spec.ts`، `absence-request.service.spec.ts`             | ✅ |
| ۴ — کل بستهٔ API        | واحد           | `pnpm --filter @repo/api test`                                                | ✅ ۹۷ پاس |
| ۴ — تایپ و بیلد        | typecheck/build | `pnpm typecheck` و `pnpm build`                                              | ✅ |
| ۴ — اسموک روی API زنده  | e2e            | `vitest run test/smoke.e2e.spec.ts`                                           | ✅ ۴ پاس |
| ۴ — بررسی زندهٔ دیتابیس | دستی (psql)    | ثبت درخواست برای `2026-11-20` و کنترل `absence_requests."absenceDate"`          | ✅ بدون جابه‌جایی روز |
| ۵ — اکانت‌های توسعه      | زنده (HTTP)    | ۹ اکانت: مالک/عضو تیم/۳ شاگرد/۳ اپراتور (جدول `docs/DEV_ACCOUNTS.md`)           | ✅ |
| ۶ — قوانین ایجنت         | واحد           | `pnpm --filter @repo/api test` پس از افزودن کامنت‌های تسک                       | ✅ ۹۷ پاس |
| ۷ — ثبت لاگ              | بازبینی دستی    | بررسی خروجی `git log` و تطابق هش‌ها با جدول بالا                                | ✅ |
| ۸ — نام‌گذاری `/me`       | زنده (HTTP)    | `/me`=200، `/student`=308→`/me`، `/login`=200                                  | ✅ |
| ۸ — لندینگ               | زنده (HTTP+SSR)| `/`=200 با ۱۰۶ گره متن فارسی در SSR (بدون خطای رندر)                            | ✅ |
| ۸ — ثبت‌نام کسب‌وکار       | زنده (HTTP)    | `POST /auth/register` با OTP نامعتبر → خطای `OTP_NOT_FOUND` (قرارداد فیلدها درست) | ✅ |
| ۸ — کل بسته              | typecheck/build | `pnpm typecheck`، `pnpm test` (۹۷ پاس)، `pnpm build`                          | ✅ |
| ۱۰ — ثبت‌نام مشتری        | زنده (HTTP)    | `/me`=200 (کارت «ورود یا ثبت‌نام با موبایل») + `pnpm --filter @repo/web typecheck` | ✅ |
| ۱۱ — وضعیت نهایی         | بازبینی دستی    | `git status` پاک + بررسی همهٔ مسیرها (`/`، `/register`، `/me`، `/login`، `/admin/login`=200، `/student`=308) | ✅ |
| ۱۲ — کامنت‌های تسک‌فایل    | بازبینی diff   | `git diff --stat TaskForMyAgent.md` → فقط ۲۶ خط insert، بدون تغییر متن کاربر                        | ✅ |
| ۱۳ — قوانین ایجنت         | بازبینی دستی    | خواندن `docs/AGENT_RULES.md` و `AGENTS.md` (۴ وظیفهٔ الزامی)                                        | ✅ |
| ۱۴ — پنل ادمین (ماژول پیش‌فرض) | واحد       | `packages/shared/src/modules.spec.ts` (۳ تست `defaultModulesForIndustry`)                        | ✅ |
| ۱۴ — ساخت کسب‌وکار       | واحد           | `apps/api/src/modules/admin/admin-tenant.service.spec.ts` (۶ تست) + کاتالوگ پیش‌فرض در `admin-module.service.spec.ts` | ✅ |
| ۱۴ — فهرست فعال         | واحد           | `apps/api/src/modules/app/app-businesses.service.spec.ts` (۳ تست: فقط `ACTIVE`)                   | ✅ |
| ۱۴ — کل بستهٔ API        | واحد           | `pnpm test` → ۱۰۸ پاس (API) و ۱۶ پاس (`@repo/shared`)                                            | ✅ |
| ۱۴ — بررسی زندهٔ API     | زنده (HTTP)    | `POST /admin/tenants` (ماژول SHOP+ATT → فعال‌شده: ATT, CRM, FIN, INV, SHOP) → نمایش در `/app/businesses` → SUSPENDED → حذف از فهرست و `NOT_FOUND` در اسلاگ مستقیم → ACTIVE | ✅ |
| ۱۴ — UI کنسول ادمین      | زنده (Chrome/CDP) | ۱۵ بررسی: دکمهٔ «کسب‌وکار جدید»، ستون ماژول‌ها، باز شدن دیالوگ با ۸ ماژول پیش‌انتخاب‌شده، برچسب «پیش‌فرض صنف» در تب ماژول‌ها، فهرست کسب‌وکارهای فعال در `/me` و مخفی بودن کسب‌وکار SUSPENDED | ✅ ۱۵/۱۵ |
| ۱۴ — اسموک روی API زنده  | e2e           | `vitest run test/smoke.e2e.spec.ts`                                                              | ✅ ۴ پاس |
| ۱۴ — تایپ و بیلد         | typecheck/build | `pnpm typecheck`، `pnpm test`، `pnpm build`                                                    | ✅ |
| ۱۵ — مهاجرت رجیستری صنف  | دستی (psql)    | `prisma migrate deploy` + شمارش: ۱۷ ردیف `industry_settings` و ۸۳ ردیف `industry_default_modules` | ✅ |
| ۱۵ — رجیستری صنف         | واحد           | `apps/api/src/modules/industries/industry-registry.service.spec.ts` (۹ تست)                      | ✅ |
| ۱۵ — سرویس ادمین صنف     | واحد           | `apps/api/src/modules/admin/admin-industry.service.spec.ts` (۲ تست)                               | ✅ |
| ۱۵ — کل بستهٔ API        | واحد           | `pnpm test` → ۱۱۹ پاس (API) و ۱۶ پاس (`@repo/shared`)                                             | ✅ |
| ۱۵ — گیت ثبت‌نام صنف     | زنده (HTTP)    | غیرفعال‌سازی BEAUTY → `403 INDUSTRY_REGISTRATION_DISABLED` در `/auth/register`؛ کاهش پیش‌فرض به `[CRM]` → کسب‌وکار جدید با یک ماژول → بازگردانی | ✅ |
| ۱۵ — UI ادمین و ثبت‌نام   | زنده (Chrome/CDP) | ۱۲ بررسی صفحهٔ صنف‌ها/دیالوگ ماژول‌ها + ۸ بررسی چرخهٔ غیرفعال‌کردن از UI → حذف صنف از `/register` (۱۶ گزینه) → فعال‌سازی → بازگشت به ۱۷ | ✅ ۲۰/۲۰ |
| ۱۵ — اسموک روی API زنده  | e2e            | `vitest run test/smoke.e2e.spec.ts`                                                              | ✅ ۴ پاس |
| ۱۵ — تایپ و بیلد         | typecheck/build | `pnpm typecheck`، `pnpm test`، `pnpm build`                                                     | ✅ |
| ۲۸ — مهاجرت صنف داده‌محور | دستی (psql)    | `prisma migrate deploy` → جدول `industries` با ۱۷ صنف سیستمی و ۸۳ ردیف ماژول پیش‌فرض              | ✅ |
| ۲۸ — رجیستری صنف (بازنویسی) | واحد        | `apps/api/src/modules/industries/industry-registry.service.spec.ts` (۱۸ تست: CRUD، کلید یکتا، گیت ثبت‌نام، ماژول‌ها) | ✅ |
| ۲۸ — سرویس ادمین صنف     | واحد           | `apps/api/src/modules/admin/admin-industry.service.spec.ts` (۵ تست: create/update/remove/registration/modules + ممیزی) | ✅ |
| ۲۸ — کل بستهٔ API        | واحد           | `pnpm test` → ۱۳۱ پاس (API، ۲۱ فایل) + ۱۶ پاس (`@repo/shared`)                                    | ✅ |
| ۲۸ — چرخهٔ صنف سفارشی    | زنده (HTTP)    | ساخت «کلاس‌های شنا» → ثبت‌نام کسب‌وکار با همان ماژول‌های `[CRM, FIN]` → ۴۰۹ در حذف صنف دارای کسب‌وکار → ۴۰۳ پس از غیرفعال‌سازی ثبت‌نام | ✅ |
| ۲۹ — UI کنسول صنف‌ها     | زنده (Chrome/CDP) | ۲۰/۲۰ بررسی: فهرست ۱۸ صنف، دیالوگ ساخت (۵ فیلد متنی + ۱۴ چک‌باکس ماژول + سوییچ ثبت‌نام)، ساخت/ویرایش/حذف صنف، ظهور در `/register`، نبود دکمهٔ حذف برای صنف سیستمی | ✅ ۲۰/۲۰ |
| ۲۹/۳۰ — اسموک روی API زنده | e2e          | `vitest run test/smoke.e2e.spec.ts`                                                              | ✅ ۴ پاس |
| ۲۹/۳۰ — تایپ و بیلد      | typecheck/build | `pnpm typecheck`، `pnpm test`، `pnpm build`                                                    | ✅ |

### نکتهٔ عملیاتی (کش Next در حالت توسعه)

اگر در `packages/shared` چیزی اضافه/تغییر دادید و در وب خطای
`Cannot read properties of undefined` یا `is not a function` دیدید، کش حالت توسعهٔ
Next (`apps/web/.next`) را خالی و سرور dev را دوباره اجرا کنید؛ Next فایل‌های
`dist` پکیج‌های workspace را همیشه دوباره نمی‌خواند.
