# ماژول بله، اطلاعیه‌ها و هم‌سان‌سازی (`MSG-BALE` / `MSG-ANN`)

هدف: هر اطلاعیه‌ای که مدیر کسب‌وکار در پنل منتشر می‌کند، هم در پنل کاربری
مشتریان (`/me`) دیده شود و هم به‌صورت خودکار در **گروه بیام‌رسان بله** ارسال گردد.
محدودهٔ MVP: یک کسب‌وکار ↔ یک گروه.

---

## ۱) تجربهٔ کاربری در پنل

### تنظیمات ← «اتصال به بیام‌رسان بله»

کارت تازه در `/settings` (فقط وقتی ماژول `MSG` فعال است) با این فیلدها:

| فیلد | توضیح |
|---|---|
| **توکن ربات** | توکن بازوی بله (مثل `123456789:AA…`). پس از ذخیره فقط **ماسک‌شده** برگردانده می‌شود. |
| **لینک گروه** | `ble.ir/join/…` — برای تشخیص گروه. |
| **شناسهٔ گروه** | اختیاری؛ با دکمهٔ «تشخیص گروه» پر می‌شود. |
| **تیک تأیید ادمین** | «تأیید می‌کنم ربات را به‌عنوان ادمین با دسترسی ارسال پیام افزوده‌ام». |

دکمه‌ها:

- **ذخیرهٔ اتصال** — توکن با `getMe` اعتبارسنجی، گروه با `getChat` و سطح دسترسی
  ربات با `getChatMember` بررسی می‌شود. اگر ربات واقعاً ادمین باشد، تیک به‌صورت
  خودکار تأیید و پیام «ربات با دسترسی «ادمین» در گروه … تأیید شد» نمایش داده می‌شود.
- **تشخیص گروه** — از `getUpdates` گروه‌هایی که ربات در آن‌هاست استخراج و برای
  هر کدام سطح دسترسی بررسی می‌شود. اگر لینک ورودی با لینک دعوت گروه بخواند،
  خودکار انتخاب می‌شود؛ در غیر این صورت (لینک بازتولیدشده) تنها گروهی که ربات در
  آن **ادمین** است پیشنهاد می‌گردد (`matchedBy: bot-membership`).
- **پیام آزمایشی** — یک پیام HTML به گروه می‌فرستد و نتیجه در `lastTestedAt`
  و `lastTestStatus` ثبت می‌شود.
- **قطع اتصال** — توکن از دیتابیس حذف می‌شود (نه فقط غیرفعال).

### پیام‌ها ← «اطلاعیه‌ها»

صفحهٔ `/messages` حالا فرم انتشار اطلاعیه + تاریخچه است:

- عنوان، متن (تا ۲۰۰۰ نویسه)، **روز رویداد** (اختیاری؛ معادل شمسی زیر فیلد نشان
  داده می‌شود) و انتخاب **گیرندگان**: همهٔ اعضای فعال یا انتخاب گروهی (جست‌وجو
  بین مشتریان).
- تیک «ارسال همین اطلاعیه به گروه بله».
- تاریخچه با تعداد گیرنده و وضعیت بله (`ارسال شد` / `ناموفق` / `فقط سایت`) و
  دکمهٔ **ارسال به بله** برای تلاش دوباره.

---

## ۲) مدل داده

```prisma
model BaleIntegration {          @@map("bale_integrations")
  tenantId       String  @unique
  botToken       String          // هرگز به کلاینت برنمی‌گردد
  botUsername    String?
  groupLink      String?         // آنچه مالک وارد کرده
  chatId         String?         // شناسهٔ عددی گروه برای Bot API
  chatTitle      String?
  adminConfirmed Boolean @default(false)
  isActive       Boolean @default(true)
  events         Json    @default("[\"announcement\"]")
  lastTestedAt   DateTime?
  lastTestStatus String?         // OK | FAILED
  lastError      String?
}

model Announcement {             @@map("announcements")
  tenantId    String
  title       String
  body        String
  audience    String   @default("ALL")     // ALL | SELECTED
  eventDate   DateTime?
  recipients  Int      @default(0)
  baleStatus  String   @default("SKIPPED") // SENT | FAILED | SKIPPED
  baleError   String?
  baleMessageId String?
  createdById String?
  publishedAt DateTime @default(now())
}
```

مهاجرت: `packages/db/prisma/migrations/20261029181904_bale_announcements`.

---

## ۳) API

همهٔ مسیرها با توکن کسب‌وکار و گارد `MSG` محافظت می‌شوند.

| متد | مسیر | دسترسی | کار |
|---|---|---|---|
| `GET` | `/bale/settings` | `msg:read` | وضعیت اتصال با توکن ماسک‌شده |
| `PUT` | `/bale/settings` | `msg:write` | ذخیرهٔ توکن/لینک/شناسه/تیک/رویدادها |
| `POST` | `/bale/discover` | `msg:write` | فهرست گروه‌های ربات + انتخاب خودکار |
| `POST` | `/bale/test` | `msg:write` | بررسی ادمین + ارسال پیام آزمایشی |
| `DELETE` | `/bale/settings` | `msg:write` | حذف توکن و قطع اتصال |
| `GET` | `/messages/announcements?take=20` | `msg:read` | تاریخچهٔ اطلاعیه‌ها |
| `POST` | `/messages/announcements` | `msg:write` | انتشار + آینه در بله |
| `POST` | `/messages/announcements/:id/bale` | `msg:write` | ارسال دوباره به بله |

بدنهٔ انتشار:

```json
{
  "title": "تعطیلی باشگاه — یکشنبه",
  "body": "باشگاه روز یکشنبه ۱۰ آبان تعطیل است…",
  "audience": "ALL",
  "eventDate": "2026-11-01T00:00:00.000Z",
  "mirrorToBale": true
}
```

`audience: "SELECTED"` نیازمند `customerIds` است (حداکثر ۲۰۰۰ نفر).

---

## ۴) رویدادهای قابل هم‌سان‌سازی

پیش‌فرض فقط `announcement`. بقیه از کارت تنظیمات با یک کلیک روشن می‌شوند:

`announcement`، `order.created`، `order.canceled`، `order.shipped`،
`appointment_reminder`، `document.expiring`.

`NotificationService.notify()` پس از ثبت اعلان درون‌برنامه‌ای، رویداد را
fire-and-forget به `BaleService.mirror()` می‌دهد؛ خطای بله هرگز جریان اصلی
(ثبت سفارش، پرداخت، …) را نمی‌شکند و در `lastError` ثبت می‌شود.

فقط وقتی ارسال انجام می‌شود که **هر چهار** شرط برقرار باشد: توکن ذخیره شده،
`isActive`، `adminConfirmed` و `chatId` موجود، و رویداد در فهرست `events` باشد.

---

## ۵) قالب پیام

```
📢 <b>{عنوان}</b>

{متن}

🗓 {تاریخ شمسی روز رویداد}     ← فقط اگر وارد شده باشد

— {نام کسب‌وکار}
```

متن با `escapeHtml` ایمن می‌شود (کاراکترهای `<`, `>`, `&`) و پیام با
`parse_mode: HTML` و بدون پیش‌نمایش لینک ارسال می‌گردد. تاریخ با
`Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran' })` شمسی می‌شود.

---

## ۶) امنیت

- توکن ربات فقط سمت سرور استفاده می‌شود؛ در پاسخ‌های API فقط `botTokenMasked`
  برمی‌گردد (`406463380:wmR…fU`).
- الگوی توکن (`^\d{5,}:[A-Za-z0-9_-]{20,}$`) پیش از هر فراخوانی بررسی می‌شود تا
  مسیر URL قابل دستکاری نباشد.
- خطاهای بله به پیام فارسی نگاشت می‌شوند و متن خام (که ممکن است بخشی از URL
  توکن را داشته باشد) به UI نمی‌رسد.
- همهٔ کوئری‌ها با `tenantId` گرفته‌شده از توکن احراز هویت محدود می‌شوند.

---

## ۷) تست‌ها

- واحد: `apps/api/src/modules/bale/bale.service.spec.ts` (۹ تست) و
  `apps/api/src/modules/messaging/announcements.service.spec.ts` (۴ تست) —
  اعتبارسنجی توکن، تأیید ادمین، تشخیص گروه با لینک و با «تنها گروه ادمین»،
  ارسال آزمایشی، skip رویداد غیرفعال، escape/تاریخ شمسی، خطای بله و انتشار.
- زندهٔ HTTP (با ربات واقعی `@testforsitebot` و گروه «گروه تست اتصال به سایت»):
  `PUT /bale/settings` → تأیید ادمین، `POST /bale/discover` → `bot-membership`،
  `POST /bale/test` → `message_id=6`، `POST /messages/announcements` → ۱۲ گیرنده و
  `baleMessageId=7`، و مشاهدهٔ اطلاعیه در `/app/overview` با `unreadNotices=1`.
- UI با Chrome/CDP (`/tmp/cdp-verify-bale.mjs`) → ۱۹/۱۹.

---

## ۸) عیب‌یابی

| پیام | علت | راه‌حل |
|---|---|---|
| «توکن ربات نامعتبر است» | توکن اشتباه/باطل | توکن تازه از پنل بازو |
| «گروه پیدا نشد…» | ربات هنوز به گروه اضافه نشده | ربات را اضافه و یک پیام در گروه بفرستید، سپس «تشخیص گروه» |
| «ربات … عضو است، نه ادمین» | دسترسی ادمین داده نشده | در بله: مدیریت گروه ← اعضا ← ربات ← ادمین + «ارسال پیام» |
| «ربات اجازهٔ ارسال پیام ندارد» | ادمین بدون مجوز ارسال | مجوز «ارسال پیام» را فعال کنید |
| `matchedBy: bot-membership` | لینک دعوت بازتولید شده و با لینک قدیمی نمی‌خواند | طبیعی است؛ گروه بر اساس عضویت ربات انتخاب شده |
