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
| ۹ | به‌روزرسانی مستندات (STATUS/DEV_ACCOUNTS) و ثبت آن در این جدول           | `b85ef03` | `docs: status + dev accounts for landing/register/customer portal`      |
| ۱۰ | شفاف‌سازی «ثبت‌نام مشتری» در پنل `/me`                                   | `a1a3fd7` | `feat(web): make consumer signup explicit in the /me portal`            |
| ۱۱ | ثبت ردیف‌های ۹ و ۱۰ در همین جدول                                        | `3cc7e24` | `docs(agent): log landing/register commits in registry`                 |
| ۱۲ | کامنت «✅ تکمیل شد» زیر همهٔ تسک‌های انجام‌شدهٔ `TaskForMyAgent.md`        | `6279c25` | `docs(taskfile): mark every completed task with a completion comment`   |
| ۱۳ | قانون ثبت کامنت تکمیل در قوانین ایجنت + `AGENTS.md`                      | `d8f8137` | `docs(agent): require a completion comment under every finished task`   |
| ۱۴ | ثبت ردیف‌های ۱۲ و ۱۳ در همین جدول                                        | `257050f` | `docs(agent): log taskfile annotation commits`                          |
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
| ۳۲ | ثبت ردیف ۳۱ در همین جدول                                              | `a62c485` | `docs(agent): register the data-driven-industry log commit`             |
| ۳۳ | نام کاربران نهایی هر صنف در کل پنل کسب‌وکار (زبان‌آموز/زبان‌آموزان …)      | `b98b629` | `feat(web): name end-users after their industry across the business panel` |
| ۳۴ | حذف فیلد «شهر» از فرم مشتری جدید                                       | `635655a` | `feat(web-crm): remove the city field from the new-customer form`       |
| ۳۵ | ثبت ردیف‌های ۳۳ و ۳۴ + مستندات وضعیت و کامنت‌های تسک‌فایل                   | `c6565da` | `docs(agent): log industry-naming and customer-form commits`            |
| ۳۶ | ثبت ردیف ۳۵ در همین جدول                                              | `6e9bdc4` | `docs(agent): register the industry-naming log commit`                  |
| ۳۷ | ورود با رمز عبور در کنار کد یکبار مصرف در صفحهٔ `/login`                 | `2f1b83f` | `feat(web): password login next to OTP in the business-panel login page` |
| ۳۸ | ثبت ردیف ۳۷ + مستندات وضعیت/اکانت‌ها و کامنت تسک‌فایل                       | `f8e1a2c` | `docs(agent): log the password-login commit`                            |
| ۳۹ | ثبت ردیف ۳۸ در همین جدول                                              | `5b22f61` | `docs(agent): register the password-login log commit`                    |
| ۴۰ | آزادسازی شمارهٔ موبایل پس از حذف نرم مشتری                            | `615404f` | `feat(api): release the phone number when a customer is soft-deleted`    |
| ۴۱ | ثبت ردیف ۴۰ + مستندات وضعیت و کامنت تسک‌فایل                            | `a08579a` | `docs(agent): log the soft-delete phone-release commit`                  |
| ۴۲ | نام کاربران نهایی صنف در صفحهٔ اشتراک (رفع «اشتراک هنرجو» ثابت)         | `b875fff` | `fix(web): name the subscription header after the industry's end-users`  |
| ۴۳ | نام محل هر صنف («آموزشگاه»/«شعبه») + پیوند کاربر نهایی به محل            | `1dff2c6` | `feat(shared,db): name each industry's locations and link end-users to one` |
| ۴۴ | ثبت/نمایش واژهٔ محل در رجیستری صنف و شعبهٔ پیش‌فرض صنفی                 | `60197dc` | `feat(api): register and expose the location noun of every industry`     |
| ۴۵ | مدیریت شعبه‌ها (ویرایش/حذف/شمارش) + انتساب کاربر نهایی به شعبه            | `62355ed` | `feat(api): manage branches and file each end-user under one`            |
| ۴۶ | کارت مدیریت شعبه‌ها در پنل + فیلد شعبه در فرم کاربر نهایی               | `5da9dd0` | `feat(web): manage a business's locations from the panel, named per industry` |
| ۴۷ | ثبت ردیف‌های ۴۲ تا ۴۶ + مستندات و کامنت تسک‌فایل                          | `2e92880` | `docs(agent): log the location-noun and branch-management commits`       |
| ۴۸ | تنظیم/تغییر رمز عبور توسط خود کاربر (API)                                 | `7c7f0e9` | `feat(api): let members set or change their own password`                |
| ۴۹ | کارت رمز عبور در پنل و پورتال + تب ورود با رمز در پورتال                   | `375a267` | `feat(web): password card in the settings panel and the customer portal` |
| ۵۰ | کانفیگ تخت ESLint و سبزکردن `pnpm lint` در همهٔ بسته‌ها                    | `3408943` | `chore(lint): add a flat ESLint config and wire lint in every package`   |
| ۵۱ | کارت محل‌ها در ابتدای داشبورد + توضیح «هسته است، نه ماژول»                 | `d6fd7ad` | `feat(web): put the locations KPI first on the dashboard and explain it is core` |
| ۵۲ | ماژول APP برای صنف‌های آموزشی + اصلاح اسکریپت `db:deploy`                  | `c8b9903` | `fix(shared,db): give the education verticals the end-user portal`       |
| ۵۳ | تغییر کسب‌وکار فعال کاربر نهایی + پیام کامل «عدم عضویت»                    | `8b0aaf1` | `feat(api): switch the active club of a portal user and say "no membership" clearly` |
| ۵۴ | پنل کاربری بخش‌بندی‌شده + سوئیچ عضویت + حذف لود مداوم حاضری                 | `c7d8230` | `feat(web): turn the customer panel into a sectioned panel with club switching` |
| ۵۵ | ثبت ردیف‌های ۴۷ تا ۵۴ + مستندات و کامنت تسک‌فایل                          | `368b504` | `docs(agent): log the password, lint and portal commits`                 |
| ۵۶ | تکمیل هش ردیف‌های ۹، ۱۴ و ۵۵ (ردیف‌های خودارجاع «این کامیت»)              | `4be33f8` | `docs(agent): fill the self-referential commit rows in the registry`     |
| ۵۷ | بازگرداندن گیت ثبت‌نام صنف‌ها در دادهٔ توسعه + ثبت ردیف ۵۶                 | `e386435` | `docs(agent): record the dev-data reset and register the registry commit` |
| ۵۸ | نمایش تمامی صنف‌های کاربر در پنل `/me` (استریپ + بخش گروه‌بندی‌شده)        | `07dde8b` | `feat(web): show every industry the portal user belongs to`              |
| ۵۹ | کامنت «✅ تکمیل شد» زیر تسک چت در `TaskForMyAgent.md`                   | `e38b9e0` | `docs(taskfile): mark the portal industries task as done`                |
| ۶۰ | ثبت ردیف‌های ۵۸ و ۵۹ + مستندات وضعیت/اکانت‌ها + ردیف تست جدید             | `0154071` | `docs(agent): log the portal-industries commit and dev account`          |
| ۶۱ | افزودن `joinedAt` (تاریخ عضویت) به فهرست عضویت‌های کاربر نهایی            | `681a6a3` | `feat(api): expose when each of the portal user's memberships started`   |
| ۶۲ | بخش «پروفایل من» با اطلاعات تماس + انتقال کارت رمز به آن                 | `0b0fa9b` | `feat(web): add a profile section with contact details to the portal`    |
| ۶۳ | کامنت «✅ تکمیل شد» زیر تسک پروفایل در `TaskForMyAgent.md`              | `f7bc8ed` | `docs(taskfile): mark the portal profile-page task as done`              |
| ۶۴ | ثبت ردیف‌های ۶۱ تا ۶۳ + مستندات وضعیت + ردیف‌های تست پروفایل              | `1d2e4cc` | `docs(agent): log the portal profile section and membership date`        |
| ۶۵ | `GET /app/overview`: خلاصهٔ حضور/شهریه/اطلاعیه/نوبت هر مجموعهٔ کاربر      | `77bc3db` | `feat(api): summarise every club of a portal user with its own numbers`  |
| ۶۶ | هم‌گام‌کردن پیش‌فرض‌های صنف‌های آموزشی (کلید گم‌شدهٔ `MSG`)               | `ed7e78b` | `fix(db): re-sync the education verticals' default modules (MSG was missing)` |
| ۶۷ | کارت هر مجموعه با اعداد خودش + بخش «اطلاعیه‌ها» + نام مجموعه در عنوان‌ها  | `edb8edc` | `feat(web): show every club's own attendance, tuition and notices in the portal` |
| ۶۸ | کامنت «✅ تکمیل شد» زیر تسک «هر مجموعه با دادهٔ خودش»                      | `81f1696` | `docs(taskfile): mark the per-club portal task as done`                  |
| ۶۹ | ثبت ردیف‌های ۶۵ تا ۶۸ + مستندات وضعیت/اکانت‌ها + ردیف‌های تست              | `18921e7` | `docs(agent): log the per-club portal commits and demo data`             |
| ۷۰ | کلیدگذاری کوئری‌های پنل `/me` به مجموعهٔ فعال (رفع کش مجموعهٔ قبلی در سوئیچ) | `3602adf` | `fix(web): key the portal queries by the active club`                    |
| ۷۱ | نام واقعی کاربر از پروندهٔ مشتری/زبان‌آموز به عضو پورتال                    | `c43700f` | `fix(api): take the portal member name from the customer file`           |
| ۷۲ | ثبت نتیجهٔ تست دو-صنفی + کامنت‌های ✅ جاافتاده در تسک‌فایل                  | `833b4e1` | `docs(taskfile): record the two-club verification test`                  |
| ۷۳ | ثبت ردیف‌های ۷۰ تا ۷۲ + مستندات وضعیت/اکانت‌ها + ردیف‌های تست              | `5694d66` | `docs(agent): log the portal query-key fix and the two-club test`        |
| ۷۴ | کلید نقش و مجوزهای پیش‌فرض نقش‌های سیستمی در `@repo/shared`                | `aafebdd` | `feat(shared): give the system roles their tenant key and defaults`      |
| ۷۵ | پیوند/ساخت ردیف نقش برای کاربر پنل (رفع کاربر بی‌مجوز)                      | `c7735f1` | `fix(api): link the tenant role of a panel member`                       |
| ۷۶ | ستون «عملیات» و حذف کاربر با تأیید در `/customers`                         | `f944978` | `feat(web): let the manager delete a user from /customers`               |
| ۷۷ | انتخاب نقش سفارشی در فرم افزودن کاربر `/team`                              | `71fb55f` | `feat(web): pick a custom role when adding a panel member`               |
| ۷۸ | ثبت تسک «حذف کاربر» در تسک‌فایل + کامنت ✅                                  | `e351205` | `docs(taskfile): mark the delete-user task as done`                      |
| ۷۹ | ثبت ردیف‌های ۷۴ تا ۷۸ + ردیف‌های تست حذف کاربر                             | `28afc5e` | `docs(agent): log the customer-delete task and the role-linking fix`     |
| ۸۰ | بازارگاه — فیلدهای انتشار، مهاجرت و دادهٔ نمونه                          | `55b6e63` | `feat(db): marketplace visibility fields and demo publishing`            |
| ۸۱ | API بازارگاه عمومی چند-صنفی + خرید مهمان                                | `4ae3ab4` | `feat(api): public multi-industry marketplace + guest checkout`          |
| ۸۲ | وب بازارگاه (محصولات، خدمات، سبد، پیگیری)                                | `46c1c62` | `feat(web): public marketplace pages, cart and order tracking`           |
| ۸۳ | کنترل انتشار بازارگاه در پنل کسب‌وکار                                    | `d2e74e5` | `feat(web): marketplace publishing controls in the business panel`       |
| ۸۴ | سئوی ساختاریافته و پاک‌سازی پاسخ‌های بازارگاه                             | `013f745` | `refactor(marketplace): structured SEO data and response cleanup`        |
| ۸۵ | مستندات بازارگاه + وضعیت + ثبت قوانین و تکمیل تسک                        | `caea040` | `docs(marketplace): document the public marketplace and log the work`     |
| ۸۶ | فاز ۲ — اتصال پرداخت به سفارش، رزرو و بازگشت موجودی                       | `c94b724` | `feat(shop): link payments to orders with stock reservation`              |
| ۸۷ | فاز ۲ — اعلان دوطرفهٔ سفارش (خریدار/فروشنده)                              | `1f1ffbd` | `feat(shop): two-way order notifications`                                 |
| ۸۸ | فاز ۲ — روش‌های ارسال واقعی هر کسب‌وکار                                   | `a2e4978` | `feat(shop): real per-business shipping methods`                          |
| ۸۹ | فاز ۲ — «سفارش‌های من» در پنل کاربری                                      | `5285e2f` | `feat(portal): my orders tab with pay and cancel`                         |
| ۹۰ | فاز ۲ — نظرات و امتیاز خریداران                                           | `e15847f` | `feat(marketplace): verified-purchase reviews and ratings`                |
| ۹۱ | فاز ۲ — کنسول مدیریت بازارگاه                                             | `b1cbc0c` | `feat(admin): marketplace console with moderation queue`                  |

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
| ۳۳ — نام کاربران نهایی صنف | زنده (Chrome/CDP) | ۱۳/۱۳ بررسی: پنل زبان («زبان‌آموزان» در عنوان/سایدبار/جدول/KPI/فاکتور/مجوزها) + پنل باشگاه همچنان «شاگردان» | ✅ ۱۳/۱۳ |
| ۳۳ — نام‌گذاری در پنل‌های دیگر | زنده (Chrome/CDP) | ۷/۷ بررسی: زیرعنوان حضور و غیاب، مالی، بازاریابی، گزارش‌ها و پورتال عمومی `/portal/[slug]` («پورتال زبان‌آموزان») | ✅ ۷/۷ |
| ۳۴ — فرم مشتری جدید      | زنده (Chrome/CDP) | فرم فقط «نام و نام خانوادگی» + «شماره موبایل»؛ جدول بدون ستون «شهر»؛ ثبت بدون شهر → ۲۰۰ و نمایش در فهرست | ✅ |
| ۳۳/۳۴ — تایپ و بیلد      | typecheck/build | `pnpm typecheck` (۶/۶)، `pnpm test`، `pnpm build`                                             | ✅ |
| ۳۷ — ورود با رمز عبور (API) | زنده (HTTP)    | `/auth/login` → رمز درست: ۲۰۰ (OWNER)؛ رمز غلط: ۴۰۰ `INVALID_PASSWORD`؛ بدون رمز: ۴۰۰ `NO_PASSWORD` | ✅ |
| ۳۷ — ورود با رمز عبور (UI) | زنده (Chrome/CDP) | ۱۰/۱۰ بررسی: تب رمز، ورود موفق → `/dashboard`، ذخیرهٔ توکن، خطای رمز غلط، پیام `NO_PASSWORD`     | ✅ ۱۰/۱۰ |
| ۳۷ — تایپ و بیلد         | typecheck/build | `pnpm typecheck` (۶/۶)، `pnpm test`، `pnpm build`                                             | ✅ |
| ۴۰ — واحد (حذف/افزودن دوباره) | واحد        | `apps/api/src/modules/crm/customers.service.spec.ts` (۷ تست: تشخیص تکراری روی پروندهٔ زنده، آزادسازی شماره، بایگانی در `meta`) | ✅ ۷/۷ |
| ۴۰ — واحد (زنده‌شدن پروندهٔ پورتال) | واحد | `apps/api/src/modules/app/app.service.spec.ts` (۴ تست: استفادهٔ مجدد، زنده‌شدن، عدم تصاحب شمارهٔ گرفته‌شده، ساخت پروندهٔ نو) | ✅ ۴/۴ |
| ۴۰ — زنده (HTTP)        | زنده (HTTP)     | افزودن → ۴۰۹ روی پروندهٔ فعال → حذف → `phone=NULL`/`meta.archivedPhone` → افزودن دوبارهٔ همان شماره موفق → بازگشت عضو پورتال با همان `customerId` | ✅ |
| ۴۰ — کل بستهٔ API        | واحد           | `pnpm test` → ۱۴۲ پاس (API، ۲۳ فایل)                                                            | ✅ |
| ۴۰ — تایپ و بیلد         | typecheck/build | `pnpm typecheck` (۶/۶)، `pnpm build`                                                            | ✅ |
| ۴۰ — اسموک روی API زنده  | e2e            | `vitest run test/smoke.e2e.spec.ts`                                                              | ✅ ۴ پاس |
| ۴۲ — نام کاربران نهایی (کل پنل) | زنده (Chrome/CDP) | ۳۱/۳۱ بررسی: پنل زبان «زبان‌آموزان» و پنل باشگاه «شاگردان»؛ نبود «زبان‌آموز»/«هنرجو» در ۱۵ صفحهٔ پنل باشگاه | ✅ ۳۱/۳۱ |
| ۴۲ — صفحهٔ اشتراک          | زنده (Chrome/CDP) | ۴/۴ بررسی: «اشتراک زبان‌آموزان» (آموزشگاه زبان) و «اشتراک شاگردان» (باشگاه)                     | ✅ ۴/۴ |
| ۴۲ — واژهٔ محل هر صنف       | واحد           | `packages/shared/src/industries.spec.ts` (۴ تست: آموزشگاه/مهدکودک، پیش‌فرض شعبه، نبود نشت)      | ✅ ۴/۴ |
| ۴۳/۴۴ — مهاجرت‌ها           | دستی (psql)    | `prisma migrate deploy` → `industries.branchNoun` + `customers.branchId` و پرکردن ۳ صنف آموزشی  | ✅ |
| ۴۴ — شعبهٔ پیش‌فرض صنفی     | واحد + زنده    | `admin-tenant.service.spec.ts`؛ ساخت کسب‌وکار ART_MUSIC از کنسول ادمین → شعبهٔ «آموزشگاه مرکزی»   | ✅ |
| ۴۵ — مدیریت شعبه (API)     | واحد           | `apps/api/src/modules/tenants/tenants.service.spec.ts` (۱۷ تست: فهرست/شمارش، ویرایش، ردِ صنف دیگر، حذف نرم، کد تکراری) | ✅ ۱۷/۱۷ |
| ۴۵ — انتساب کاربر به شعبه   | واحد           | `apps/api/src/modules/crm/customers.service.spec.ts` (۱۳ تست: انتساب، `INVALID_BRANCH`، آزادسازی شماره) | ✅ ۱۳/۱۳ |
| ۴۵ — چرخهٔ شعبه (HTTP)     | زنده (HTTP)    | ۲ محل → ۲+۱ زبان‌آموز → شمارش درست → نام‌گذاری/غیرفعال‌سازی → ۴۰۹ حذف محل پر → ۴۰۰ محل صنف دیگر → حذف محل خالی | ✅ |
| ۴۵ — کل بستهٔ API          | واحد           | `pnpm test` → ۱۵۳ پاس (API، ۲۳ فایل) + ۲۰ پاس (`@repo/shared`)                                  | ✅ |
| ۴۶ — کارت شعبه‌ها (UI)      | زنده (Chrome/CDP) | ۲۱/۲۱ بررسی: عنوان «آموزشگاه‌ها»/«شعبه‌ها»، ساخت/ویرایش/غیرفعال‌سازی/حذف فقط روی همان ردیف، فیلد انتخاب آموزشگاه در فرم زبان‌آموز جدید | ✅ ۲۱/۲۱ |
| ۴۲–۴۶ — اسموک روی API زنده | e2e            | `vitest run test/smoke.e2e.spec.ts`                                                              | ✅ ۴ پاس |
| ۴۲–۴۶ — تایپ و بیلد        | typecheck/build | `pnpm typecheck` (۶/۶)، `pnpm test`، `pnpm build`                                              | ✅ |
| ۴۸ — تغییر رمز (واحد)      | واحد           | `apps/api/src/modules/auth/auth.service.spec.ts` (۶ تست: تنظیم رمز اول، رمز فعلی نادرست/ناقص، تکرار رمز، ابطال نشست) | ✅ ۶/۶ |
| ۴۸ — تغییر رمز (زنده)      | زنده (HTTP)    | تنظیم رمز اول شاگرد → ورود با رمز → `CURRENT_PASSWORD_REQUIRED`/`INVALID_PASSWORD`/`SAME_PASSWORD` → چرخش رمز مالک و بازگشت | ✅ ۲۴/۲۴ |
| ۴۸/۴۹ — UI رمز عبور       | زنده (Chrome/CDP) | ۲۴/۲۴ بررسی: کارت «تغییر رمز/تنظیم رمز»، خطای رمز نادرست، تب ورود با رمز در پورتال، خروج پس از تغییر، تنظیم رمز اول با OTP | ✅ ۲۴/۲۴ |
| ۵۰ — لینت کل ورک‌اسپیس     | lint           | `pnpm lint` → ۶ تسک سبز، ۰ خطا (۶ هشدار API + ۱۱ هشدار وب از قواعد advisory)                     | ✅ |
| ۵۱ — ترتیب کارت محل‌ها      | زنده (Chrome/CDP) | ۵/۵: اولین KPI (راست‌ترین) «شعبه‌ها» و پیش از «شاگردان کل»، زیرنویس شمارش، لینک `/settings`، متن «هسته … نه ماژول» | ✅ ۵/۵ |
| ۵۲ — مهاجرت + واحد          | واحد + psql    | `pnpm --filter @repo/db run deploy` (۱۷ مهاجرت)؛ `@repo/shared` ۲۱ پاس (شامل تست APP برای صنف‌های آموزشی) | ✅ |
| ۵۲ — فعال‌سازی APP          | دستی (psql)    | پیش‌فرض `LANGUAGE_SCHOOL`/`ART_MUSIC`/`EARLY_CHILD` شامل APP شد و APP برای `biz-زبان-آموزان-تنکا` فعال گردید | ✅ |
| ۵۳ — چندعضویتی (واحد)      | واحد           | `apps/api/src/modules/app/app-switch-club.service.spec.ts` (۳ تست: توکن سوئیچ‌شده، ۴۰۳ غیرعضو، کاربر بی‌شماره) | ✅ ۳/۳ |
| ۵۳ — چندعضویتی (زنده)      | زنده (HTTP)    | ۲۰/۲۰: عضویت یک شماره در دو کسب‌وکار، فهرست دو عضویت، سوئیچ و بازگشت (claim `tid`)، ۴۰۳ `NOT_A_MEMBER`، ۴۰۱، پیام کامل ۴۰۴ `NO_MEMBERSHIP` | ✅ ۲۰/۲۰ |
| ۵۴ — پنل بخش‌بندی‌شده       | زنده (Chrome/CDP) | ۲۱/۲۱: پنج بخش، نبود ویجت حاضری در خانه، صفر درخواست targets در خانه، نمایش هر کارت در بخش خودش، سوئیچ کسب‌وکار فعال | ✅ ۲۱/۲۱ |
| ۴۸–۵۴ — کل بسته‌ها         | واحد           | `pnpm test` → ۱۶۲ پاس (API، ۲۵ فایل) + ۲۱ پاس (`@repo/shared`)                                  | ✅ |
| ۴۸–۵۴ — تایپ/بیلد/اسموک    | typecheck/build/e2e | `pnpm typecheck` (۶/۶)، `pnpm build`، اسموک زندهٔ API (۴ پاس)                                   | ✅ |
| بازنشانی دادهٔ توسعه (پیش از تست کاربر) | دستی + زنده (HTTP) | `update industries set "isRegistrationEnabled"=true where …` برای ۱۳ صنفِ باقی‌مانده‌از تست + پاک‌سازی کلیدهای `otp:*`؛ سپس `GET /industries` → ۱۸ صنف با `registration OFF = 0` | ✅ |
| ۵۸ — چند صنفی‌بودن کاربر (API) | زنده (HTTP) | حساب دو-صنفی `09117818389`: `POST /app/auth/otp/verify-global` → `clubs` = `LANGUAGE_SCHOOL` + `SPORTS_COACHING`؛ `GET /app/clubs` → ۲ عضو در ۲ صنف؛ `POST /app/auth/switch-club` → ۲۰۰ | ✅ ۲/۲ |
| ۵۸ — استریپ و بخش صنف‌ها (UI) | زنده (Chrome/CDP) | `/tmp/cdp-verify-my-industries.mjs` → ۲۲/۲۲: استریپ همیشه-دیده با شمارش «۲ صنف و ۲ مجموعه»، چیپ هر صنف با واژهٔ صنف («زبان‌آموز»/«شاگرد»)، نوار ۶ بخشی، بخش «صنف‌ها و مجموعه‌ها» با گروه‌بندی صنفی و «۱ مجموعه» به‌ازای هر گروه، جابه‌جایی به باشگاه (توست «به باشگاه مربی‌گری منتقل شدید») و باقی‌ماندن استریپ در بخش حضور و غیاب | ✅ ۲۲/۲۲ |
| ۵۸ — تایپ/لینت وب          | typecheck/lint | `pnpm --filter @repo/web typecheck` ✅؛ `pnpm --filter @repo/web lint` → ۰ خطا (همان ۱۱ هشدار advisory قبلی) | ✅ |
| ۶۱ — تاریخ عضویت (واحد)     | واحد           | `apps/api/src/modules/app/app-switch-club.service.spec.ts` → `joinedAt` هر دو عضویت بررسی می‌شود | ✅ |
| ۶۱ — تاریخ عضویت (زنده)     | زنده (HTTP)    | `GET /app/clubs` → `joinedAt` برای دو عضویت (`2026-10-28T19:34:50Z` آموزش زبان، `2026-10-28T20:35:40Z` ورزش) | ✅ |
| ۶۲ — بخش پروفایل (UI)       | زنده (Chrome/CDP) | `/tmp/cdp-verify-me-profile.mjs` → ۱۵/۱۵: نوار ۷ بخشی با «پروفایل من»، کارت «اطلاعات من» (نام، شمارهٔ موبایل، صنف، مجموعهٔ فعال، تاریخ شمسی عضویت، وضعیت ورود)، انتقال کارت رمز به پروفایل و نبودش در خانه، «عضو از …» در ردیف‌های عضویت، پیروی کارت از مجموعهٔ فعال پس از سوئیچ | ✅ ۱۵/۱۵ |
| ۵۸/۶۲ — رگرسیون صنف‌ها      | زنده (Chrome/CDP) | `/tmp/cdp-verify-my-industries.mjs` دوباره پس از افزودن بخش پروفایل → ۲۱/۲۱ | ✅ ۲۱/۲۱ |
| ۶۱/۶۲ — کل بسته‌ها          | واحد + typecheck/build | `pnpm test` → API ۱۶۲ پاس (۲۵ فایل) + `@repo/shared` ۲۱ پاس (۳ فایل)؛ `pnpm --filter @repo/web build` ✅ (۳۶ روت) | ✅ |
| ۶۵ — خلاصهٔ مجموعه‌ها (واحد) | واحد           | `apps/api/src/modules/app/app-overview.service.spec.ts` (۳ تست: تفکیک اعداد دو مجموعه، عضویت بدون پروندهٔ مشتری، شمارهٔ بدون عضویت) | ✅ ۳/۳ |
| ۶۵ — خلاصهٔ مجموعه‌ها (زنده) | زنده (HTTP)    | `GET /app/overview` برای حساب سه‌صنفی: آموزش زبان (حضور ۶۷٪، مانده ۱٬۵۰۰٬۰۰۰، ۱ اطلاعیهٔ نخوانده، نوبت بعدی) جدا از باشگاه (۱۰۰٪، تسویه، اطلاعیهٔ دیگر) و موسیقی (۰) | ✅ |
| ۶۶ — رفع drift پیش‌فرض‌ها    | مهاجرت + psql  | `pnpm --filter @repo/db run deploy` (۱۹ مهاجرت)؛ مقایسهٔ `industry_default_modules` با ثابت `INDUSTRY_DEFAULT_MODULES` → پیش از رفع ۳ صنف با کلید گم‌شدهٔ `MSG`، پس از رفع `drift = 0` | ✅ |
| ۶۷ — پنل چند-مجموعه‌ای (UI)  | زنده (Chrome/CDP) | `/tmp/cdp-verify-me-clubs.mjs` → ۲۴/۲۴: کارت جدا برای هر مجموعه با اعداد خودش، میان‌بُرهای مجموعهٔ فعال، بخش تازهٔ «اطلاعیه‌ها» با «جدید» و «خوانده شد»، پاک شدن شمارندهٔ خانه، نام مجموعه در عنوان بخش‌ها و پیروی اطلاعیه‌ها از مجموعهٔ فعال | ✅ ۲۴/۲۴ |
| ۶۵/۶۷ — رگرسیون پنل         | زنده (Chrome/CDP) | `/tmp/cdp-verify-my-industries.mjs` → ۲۱/۲۱ (اکنون با حساب سه‌صنفی) و `/tmp/cdp-verify-me-profile.mjs` → ۱۵/۱۵ | ✅ |
| ۶۵/۶۷ — کل بسته‌ها          | واحد + typecheck/build | `pnpm --filter @repo/api test` → ۱۶۵ پاس (۲۶ فایل)؛ `pnpm test` → `@repo/shared` ۲۱ پاس؛ `pnpm --filter @repo/web typecheck|lint|build` ✅ | ✅ |
| ۷۰ — رفع کش پنل (زنده)      | زنده (Chrome/CDP) | `/tmp/cdp-verify-me-2clubs.mjs` → ۳۳/۳۳: سوئیچ موسیقی↔زبان و عوض‌شدن درست «اطلاعیه‌ها» (پیش از رفع، زیر تیتر مجموعهٔ تازه پیام‌های مجموعهٔ قبلی می‌ماند) | ✅ ۳۳/۳۳ |
| ۷۰ — رگرسیون پنل            | زنده (Chrome/CDP) | `/tmp/cdp-verify-me-clubs.mjs` → ۲۴/۲۴ و `/tmp/cdp-verify-my-industries.mjs` → ۲۱/۲۱ (اسکریپت صنف‌ها حالا صبر می‌کند تا استریپ پر شود، نه خواندن حالت خالی) | ✅ |
| ۷۱ — نام عضو پورتال (واحد)   | واحد           | `apps/api/src/modules/app/app.service.spec.ts` → ۲ تست تازه: ارث‌بری نام پروندهٔ کارکنان و ارتقای نام جانشین «کاربر» | ✅ ۲/۲ |
| ۷۱ — نام عضو پورتال (زنده)   | زنده (HTTP)    | `POST /app/auth/otp/verify-global` با ۰۹۰۲۰۰۰۰۰۰۰ → `user.fullName = "زبان‌آموز نمونه"` (قبلاً «کاربر») | ✅ |
| ۷۰/۷۱ — کل بسته‌ها           | واحد + typecheck/lint/build | `pnpm --filter @repo/api test` → ۱۶۷ پاس (۲۶ فایل)؛ `pnpm --filter @repo/api|web typecheck` ✅؛ `pnpm --filter @repo/web lint` → ۰ خطا؛ `pnpm --filter @repo/web build` ✅ | ✅ |
| ۷۲ — تست دو-صنفی (زنده)      | زنده (HTTP)    | دو کسب‌وکار (زبان آوا/موسیقی نوا) + عضویت مشترک ۰۹۰۲۰۰۰۰۰۰۰؛ `verify-global` → ۲ مجموعه، `GET /app/clubs|overview` → اعداد تفکیک‌شده (زبان ۶۷٪/۳٬۰۰۰٬۰۰۰ مانده، موسیقی ۱۰۰٪/تسویه) | ✅ |
| ۷۵ — نقش کاربر پنل (واحد)   | واحد           | `apps/api/src/modules/tenants/tenants-ext.service.spec.ts` → ۶ تست: پیوند نقش مدیر، نبود `crm:write` برای مربی، تقدم نقش سفارشی، شمارهٔ تکراری، تغییر مجوز با تغییر نقش، دست‌نزدن وقتی نقشی ارسال نشده | ✅ ۶/۶ |
| ۷۴ — پیش‌فرض نقش‌ها (واحد)   | واحد           | `packages/shared/src/permissions.spec.ts` → ۳ تست: یکتایی کلید نقش‌ها، وجود پیش‌فرض برای هر نقش، `crm:write` مدیر/پذیرش و نبودش برای مربی | ✅ ۳/۳ |
| ۷۵ — مجوز حذف (زندهٔ HTTP)   | زنده (HTTP)    | `DELETE /customers/:id` → مدیر `MANAGER` (پس از پیوند نقش) ۲۰۰ و «مربی» `STAFF` ۴۰۳ `FORBIDDEN`؛ افزودن دوبارهٔ شمارهٔ حذف‌شده → ۲۰۱؛ `deletedAt` ست و `meta.archivedPhone` پر | ✅ |
| ۷۶/۷۷ — حذف کاربر (UI)      | زنده (Chrome/CDP) | `/tmp/cdp-verify-customer-delete.mjs` → ۱۶/۱۶: ستون «عملیات»، aria-label «حذف شاگرد»، متن تأیید داده‌محور (بایگانی + آزادشدن شماره)، انصراف بدون حذف، تأیید → ناپدیدشدن ردیف و نبودن در جست‌وجو، توست «شاگرد حذف شد»، و حذف موفق با حساب «مدیر» | ✅ ۱۶/۱۶ |
| ۷۴/۷۵/۷۶ — کل بسته‌ها        | واحد + typecheck/lint/build | `pnpm test` → API ۱۷۳ پاس (۲۷ فایل) + shared ۲۴ پاس؛ `pnpm lint` → ۶ تسک سبز، ۰ خطا؛ `pnpm --filter @repo/web build` ✅ (۳۶ روت) | ✅ |
| بازارگاه — واحد             | واحد           | `apps/api/src/modules/marketplace/marketplace.service.spec.ts` (۸ تست: فیلتر tenant/module، ترتیب قیمت، عدم سفارش برای کسب‌وکار غیرفعال، موجودی ناکافی، جمع سرور-محور، عدم افشای سفارش) → `pnpm --filter @repo/api test` ۱۸۱ پاس/۲۸ فایل | ✅ ۸/۸ |
| بازارگاه — API زنده         | زنده (HTTP)    | products/services/businesses/facets ۲۰۰ با دادهٔ دمو؛ OTP ۲۰۱؛ checkout → `ORD-00002` + پرداخت mock؛ track با موبایل درست ۲۰۰ و نامرتبط ۴۰۴ | ✅ |
| بازارگاه — UI عمومی         | زنده (Chrome/CDP) | `/tmp/cdp-verify-marketplace.mjs` → ۲۱/۲۱: خانه، فهرست محصول، افزودن به سبد و شمارنده، سبد، OTP، ثبت سفارش، پرداخت، پیگیری، خدمات و ویترین کسب‌وکار | ✅ ۲۱/۲۱ |
| بازارگاه — UI پنل           | زنده (Chrome/CDP) | `/tmp/cdp-verify-marketplace-panel.mjs` → ۱۱/۱۱: توکن مالک، صفحهٔ خدمات، ستون‌های بازارگاه، ثبت و انتشار خدمت، تنظیمات و لینک ویترین | ✅ ۱۱/۱۱ |
| بازارگاه — کل بسته‌ها        | typecheck/lint/build | `pnpm --filter @repo/api typecheck` ✅؛ `pnpm --filter @repo/web typecheck` ✅؛ `pnpm --filter @repo/web lint` → ۰ خطا (۲۱ هشدار advisory)؛ `pnpm --filter @repo/web build` ✅ (۴۱ روت، ۸ روت بازارگاه) | ✅ |
| بازارگاه فاز۲ — واحد         | واحد           | `apps/api/src/modules/shop/shop-payment.spec.ts` (۱۱ تست: رزرو اتمیک، کمبود موجودی، پرداخت→CONFIRMED بدون کسر دوباره، لغو→RELEASED، idempotency، مبلغ از سفارش، استرداد، اعلان‌ها) | ✅ ۱۱/۱۱ |
| بازارگاه فاز۲ — زنده         | زنده (HTTP+DB) | checkout ۲ عدد → stock ۳۰→۲۸ و `RESERVED` → callback mock → `CONFIRMED/COMMITTED` → استرداد → `CANCELED/RELEASED` و stock=۳۰؛ حرکت‌های `RESERVATION`/`RELEASE` ثبت شد | ✅ |
| بازارگاه فاز۲ — اعلان       | زنده (DB)      | پس از checkout: پیام «سفارش جدید» برای مالک (`order.created`) + «سفارش شما ثبت شد» و «وضعیت سفارش» برای خریدار (`order.confirmed`) در `messages` | ✅ |
| بازارگاه فاز۲ — ارسال       | واحد           | همان اسپک: `shippingCostFor` (آستانهٔ ارسال رایگان) + ثبت `shippingMethodId`/هزینه در سفارش → ۱۳/۱۳ | ✅ ۱۳/۱۳ |
| بازارگاه فاز۲ — ارسال زنده  | زنده (HTTP)    | `GET /public/marketplace/businesses/coach-demo/shipping` دو روش (پیک ۵۰٬۰۰۰ / پست ۸۰٬۰۰۰)؛ checkout با `shippingMethodId` → `total=300000` برای کالای ۲۵۰٬۰۰۰ | ✅ |
| بازارگاه فاز۲ — سفارش پورتال | واحد          | `apps/api/src/modules/app/portal-orders.service.spec.ts` (۶ تست: اسکوپ مشتری، پورتال بدون پرونده، لغو PENDING، رد CONFIRMED، پرداخت با tenant سفارش، عدم دسترسی به سفارش دیگر) | ✅ ۶/۶ |
| بازارگاه فاز۲ — پورتال زنده | زنده (HTTP+DB) | `GET /app/orders` سفارش خریدار را برگرداند؛ `POST /app/orders/:id/pay` → callback → `CONFIRMED/COMMITTED`؛ سفارش دوم → `cancel` → `CANCELED/RELEASED` و stock ۲۷→۲۹ | ✅ |
| بازارگاه فاز۲ — نظرات واحد  | واحد           | `apps/api/src/modules/app/portal-review.service.spec.ts` (۴ تست: انتشار فوری خرید تأییدشده، صف تأیید برای بقیه، رد سفارش تحویل‌نشده، جلوگیری از نظر تکراری) | ✅ ۴/۴ |
| بازارگاه فاز۲ — نظرات زنده  | زنده (HTTP)    | امتیاز محصول ۵/۱ نظر از دادهٔ نمونه؛ خرید+پرداخت+تحویل → ثبت نظر از پورتال → `isVerified/isPublic` و امتیاز ۵/۲؛ نظر تکراری ۴۰۹؛ `GET /products/:id/reviews` ۲۰۰ | ✅ |
| بازارگاه فاز۲ — ادمین واحد | واحد           | `apps/api/src/modules/admin/admin-marketplace.service.spec.ts` (۴ تست: آمار، قطع انتشار + audit، تأیید نظر، فیلتر صف) | ✅ ۴/۴ |
| بازارگاه فاز۲ — ادمین زنده | زنده (HTTP)    | ورود ادمین → `overview` (۱ کسب‌وکار، ۵ کالا، ۴ سفارش، GMV ۲٬۶۹۰٬۰۰۰)؛ `businesses?search=coach`؛ نظر بدون خرید → صف pending → تأیید → در `products/:id/reviews` عمومی؛ تغییر انتشار با audit | ✅ |
| بازارگاه فاز۲ — سئو        | زنده (HTTP)    | `/robots.txt` با Disallow ادمین/پنل/پرداخت و `Sitemap`؛ `/sitemap.xml` با ۱۲ URL (۵ صفحه + ۳ محصول + ۳ خدمت + ۱ ویترین)؛ متادیتای OG بازارگاه در head | ✅ |

### نکتهٔ عملیاتی (کش Next در حالت توسعه)

اگر در `packages/shared` چیزی اضافه/تغییر دادید و در وب خطای
`Cannot read properties of undefined` یا `is not a function` دیدید، کش حالت توسعهٔ
Next (`apps/web/.next`) را خالی و سرور dev را دوباره اجرا کنید؛ Next فایل‌های
`dist` پکیج‌های workspace را همیشه دوباره نمی‌خواند.
