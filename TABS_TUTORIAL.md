# آموزش جامع سیستم تب‌های کارخانه (Factory Tabs)

> یک فایل — صفر تا صد. از ساختن تب و ورودی/خروجی تا ثبت رکورد، تعریف گزارش، ساخت ویجت و
> اجرای گزارش + خروجی PDF. همه مثال‌ها واقعی و قابل کپی‌ به API هستند.

**مدل‌ها:** `machines/models.py` · **فرمول:** `machines/formula.py` · **تب:** `machines/factory_tabs.py` ·
**گزارش:** `machines/tab_reports.py` · **API:** `machines/views.py` + `machines/urls.py` ·
**فرانت:** `pages/FactoryTabs.tsx` + `components/factoryTabs/*` · **سید:** `seed_tabs_demo.py` + `seed_mega_factory.py`

---

## فهرست

1. [معماری در یک نگاه](#1-معماری-در-یک-نگاه)
2. [ساخت تب جدید](#2-ساخت-تب-جدید)
3. [ورودی‌ها (Inputs) — سه نوع](#3-ورودیها-inputs)
4. [خروجی‌ها (Outputs) و موتور فرمول](#4-خروجیها-outputs-و-موتور-فرمول)
5. [ارجاع بین‌تبی (Cross-Tab)](#5-ارجاع-بینتبی-crosstab)
6. [رکوردها (Records) — daily vs range](#6-رکوردها-records)
7. [گزارش‌ها (Reports) — فیلتر + متریک](#7-گزارشها-reports)
8. [ویجت‌ها (Widgets) — هر ۴ نوع با کانفیگ کامل](#8-ویجتها-widgets)
9. [اجرای گزارش (Run) و خروجی](#9-اجرای-گزارش-run)
10. [API کامل (جدول)](#10-api-کامل)
11. [فرانت‌اند — سه زبانهٔ صفحه تب](#11-فرانتاند)
12. [PDF و سایر خروجی‌ها](#12-pdf-و-سایر-خروجیها)
13. [دسترسی‌ها (RBAC)](#13-دسترسیها-rbac)
14. [سناریوی کامل گام‌به‌گام (تب تناژ از صفر)](#14-سناریوی-کامل-گامبهگام)
15. [فرمول‌ها — توابع و عملگرهای مجاز](#15-فرمولها)
16. [خطاهای رایج و رفع](#16-خطاهای-رایج-و-رفع)
17. [توسعهٔ ویجت جدید](#17-توسعهٔ-ویجت-جدید)
18. [تست و سید](#18-تست-و-سید)

---

## 1. معماری در یک نگاه

```
Factory (کارخانه)
 ├─ ProductionLine / Device / Shift / Contractor / FailureReason
 └─ FactoryTab (تب داینامیک)  ← هر تب یک «فرم + فرمول» مستقل است
      ├─ FactoryTabInput  (ورودی: number/text/select)
      ├─ FactoryTabOutput (خروجی: key + formula)
      ├─ FactoryTabRecord (رکورد ثبت‌شده: inputs JSON + outputs محاسبه‌شده)
      └─ FactoryTabReport (گزارش قابل‌تنظیم)
           └─ FactoryTabWidget (ویجت: kpi/stat_table/group_table/chart)
```

- هر تب متعلق به **یک کارخانه** است. `key` در آن کارخانه یکتا (`uniq_tab_key_per_factory`).
- سایدبار: تب‌های فعال (`is_active=True`) به‌صورت خودکار زیر «توقفات» اضافه می‌شوند.
- حذف تب → همه رکوردها/گزارش‌ها/ویجت‌هایش CASCADE حذف می‌شوند.

---

## 2. ساخت تب جدید

### از UI

**تنظیمات → تب‌های کارخانه → افزودن تب** — فقط نام/کلید/توضیحات را می‌گیرد.
بعد از ساخت، روی نام تب کلیک کنید تا وارد صفحهٔ `/factory-tabs/<id>` شوید؛
بقیهٔ تنظیمات (ورودی/خروجی/گزارش) همان‌جا در زبانهٔ «تنظیمات تب» است.

### فیلدهای FactoryTab

| فیلد | نوع | توضیح |
|------|-----|-------|
| `factory` | FK | کارخانه |
| `key` | SlugField(60) | کلید انگلیسی یکتا در کارخانه. در فرمول تب‌های دیگر با **زیرخط** صدا زده می‌شود: `tonnage-delivery` → `tonnage_delivery` |
| `name` | CharField(100) | نام نمایشی (سایدبار/هدر) |
| `description` | TextField | توضیح |
| `icon` | Choice(27) | `layers, truck, gauge, flask, activity, bar-chart, trending-up, box, clipboard-list, database, filter, layers-3, pie-chart, line-chart, package, factory, scale, clock, map-pin, cpu, wrench, zap, droplet, thermometer, settings, target, grid` |
| `color` | Choice(12) | `slate, orange, emerald, violet, sky, rose, teal, amber, indigo, lime, cyan, fuchsia` |
| `record_type` | `range` / `daily` | `range`: بازه (date_from→date_to). `daily`: روزی چند رکورد با **ساعت** |
| `require_line` | bool | خط تولید الزامی باشد؟ |
| `contractor_required` | bool | پیمانکار الزامی باشد؟ |
| `order` | int | ترتیب در سایدبار |
| `is_active` | bool | غیرفعال = در سایدبار/گزارش دیده نمی‌شود |

> **نکته کلید:** اگر `key` را `my-tonnage` بگذارید، در فرمول تب دیگر باید `my_tonnage.field` بنویسید (چون `-` عملگر تفریق است). تابع `norm_tab_key` این تبدیل را انجام می‌دهد.

### API

```http
POST /api/factory-tabs/
{
  "factory": 42,
  "key": "mega-tonnage",
  "name": "تناژ تحویلی روزانه",
  "description": "تحویل روزانه ساعتی",
  "record_type": "daily",
  "require_line": true,
  "contractor_required": true,
  "order": 0,
  "is_active": true,
  "icon": "truck",
  "color": "emerald",
  "inputs": [ ... ],   // اختیاری — هم‌زمان با تب می‌شود فرستاد
  "outputs": [ ... ]
}
```

`inputs`/`outputs` اگر همراه تب فرستاده شوند، در `FactoryTabSerializer._sync_tab_nested` همگام می‌شوند
(ایجاد/به‌روزرسانی/حذف بر اساس `key`). بعد از sync، `full_clean()` فرمول‌ها و چرخه را چک می‌کند.

---

## 3. ورودی‌ها (Inputs)

`FactoryTabInput` — هر ردیف یک فیلد فرم ثبت رکورد.

| فیلد | توضیح |
|------|-------|
| `key` | Slug یکتا در تب (`uniq_tab_input_key_per_tab`) |
| `name` | نام نمایشی |
| `input_type` | `number` / `text` / `select` |
| `options` | فقط برای `select`: لیست رشته‌ای. `normalize_select_options` چک می‌کند |
| `unit` | واحد (مثلاً `تن`, `درصد`) |
| `required` | الزامی؟ |
| `order` | ترتیب در فرم |

### اعتبارسنجی `select`

`machines/models.py: normalize_select_options`

- باید `list` غیرخالی باشد، حداکثر ۵۰ گزینه
- هر گزینه `str/int/float` (نه `bool`)، بعد از `strip` غیرخالی، حداکثر ۱۰۰ کاراکتر
- تکراری ممنوع
- اگر `dict` باشد (`{value,label}`) مقدار `value`/`label` برداشته می‌شود
- برای `number`/`text` مقدار `options` به `[]` نرمال می‌شود

### مثال — تب تناژ روزانه (۷ ورودی، همه حالات)

```json
[
  {"key": "tonnage",    "name": "تناژ تحویلی",    "input_type": "number", "unit": "تن",     "required": true},
  {"key": "cars",       "name": "تعداد کامیون",   "input_type": "number", "unit": "دستگاه", "required": true},
  {"key": "moisture",   "name": "رطوبت",          "input_type": "number", "unit": "درصد",  "required": false},
  {"key": "grade",      "name": "نام مواد",       "input_type": "text",                    "required": false},
  {"key": "vehicle",    "name": "نوع خودرو",      "input_type": "select", "options": ["کفی","بونوس","تریلی","جرثقیل","کمپرسی"], "required": true},
  {"key": "shift_type", "name": "شیفت تحویل",     "input_type": "select", "options": ["صبح","عصر","شب"],                    "required": false},
  {"key": "note_extra", "name": "توضیح تکمیلی",   "input_type": "text",                    "required": false}
]
```

> فقط `number`ها در فرمول و تجمیع گزارش قابل استفاده‌اند. `text`/`select` فقط ذخیره و
> در `group_by: field_value` گروه‌بندی می‌شوند.

### در فرانت (TabSettingsPanel — گام ۲)

- فیلد `key` خودکار `_` جایگزین فاصله می‌کند.
- برای `select` یک input کاما-جدا (`کفی، بونوس، تریلی`) → `parseOptions` به لیست تبدیل می‌شود.
- «الزامی» و «ترتیب» هر ردیف قابل تنظیم است.

---

## 4. خروجی‌ها (Outputs) و موتور فرمول

`FactoryTabOutput`: `key` + `name` + `unit` + `formula` (الزامی).

**فرمول هنگام ثبت رکورد** روی `inputs` همان رکورد (+ مقادیر بین‌تبی) ارزیابی و در
`record.outputs` ذخیره می‌شود (`validate_and_compute` → `_compute_outputs`). ترتیب محاسبه با
**ترتیب توپولوژیک** است، پس خروجی می‌تواند به خروجی قبلی همین تب ارجاع دهد.

### ترتیب محاسبه (وابستگی زنجیره‌ای)

```json
[
  {"key": "avg_per_car", "name": "میانگین هر خودرو", "formula": "tonnage / cars"},
  {"key": "dry_tonnage", "name": "تناژ خشک",        "formula": "tonnage * (100 - moisture) / 100"},
  {"key": "eff_idx",     "name": "شاخص بهره‌وری",    "formula": "round(avg_per_car * 2 + dry_tonnage / 100, 2)"}
]
```

`eff_idx` به `avg_per_car` و `dry_tonnage` وابسته است — موتور خودکار اول آن دو را حساب می‌کند.
وابستگی دایره‌ای (`a → b → a`) خطای `وابستگی دایره‌ای بین خروجی‌ها` می‌دهد
(`validate_outputs_no_cycle_tab`).

### اعتبارسنجی فرمول

- `validate_expr` (نحوی) → اگر `()` خالی یا `1 2` بدون عملگر یا تابع ناشناخته باشد خطا.
- `variables(expr)` متغیرها را استخراج می‌کند.
- `_validate_vars` چک می‌کند: تک‌بخشی (`tonnage`) باید ورودی/خروجی همین تب باشد؛
  دو بخشی (`other_tab.field`) باید تب دیگر همین کارخانه و فیلد عددی آن باشد؛
  ورودی `select` در فرمول ممنوع.
- در UI: هر خروجی دکمهٔ «اعتبارسنجی فرمول» دارد + چیپ‌های قابل کلیک همه متغیرهای مجاز
  (`GET /factory-tabs/<id>/formula-vars/`).

### API اعتبارسنجی آنی

```http
POST /api/formula/validate-tab/
{"tab_id": 27, "expression": "tonnage / cars"}
→ {"ok": true, "errors": []}
→ {"ok": false, "errors": ["متغیر «foo» در این تب تعریف نشده است."]}
```

---

## 5. ارجاع بین‌تبی (Cross-Tab)

هر تب می‌تواند به **ورودی/خروجی عددی تب‌های دیگر همان کارخانه** ارجاع دهد.

| بافت | نوشتار | مثال | مقدار در زمان اجرا |
|------|--------|------|-------------------|
| **فرمول خروجی** | `<norm_key>.<field>` (زیرخط) | `mega_tonnage.dry_tonnage * 0.1 + recovery` | **میانگین** آن فیلد در رکوردهای هم‌بازه/هم‌خط تب دیگر (`build_cross_context` — تا ۵۰۰ رکورد اخیر) |
| **گزارش (متریک/ویجت)** | `<norm_key>.in.<k>` / `<norm_key>.out.<k>` + `__sum/avg/...` | `mega_tonnage.in.tonnage__sum` | تجمیع روی همه رکوردهای تب دیگر در بازهٔ گزارش |

> مقدار بین‌تبی در فرمول خروجی اگر رکوردی در هم‌بازه نباشد، متغیر اصلاً در `env` نیست →
> `FormulaError: متغیر ... وجود ندارد`. در سید مگا برای همین fallback گذاشته شده:
> `if "mega_tonnage.dry_tonnage" not in cross: cross["..."] = 110`.

فهرست متغیرهای مجاز همان تب:

```http
GET /api/factory-tabs/27/formula-vars/
→ [{"var": "tonnage", "label": "تناژ تحویلی", "group": "ورودی‌های این تب"},
    {"var": "avg_per_car", "label": "میانگین هر خودرو", "group": "خروجی‌های این تب"},
    {"var": "mega_performance.recovery", "label": "بازیابی (عملکرد فرآوری)", "group": "خروجی‌های تب عملکرد فرآوری"}]
```

---

## 6. رکوردها (Records)

`FactoryTabRecord`:

| فیلد | توضیح |
|------|-------|
| `tab` | FK تب |
| `line` | FK خط (nullable؛ اگر `tab.require_line=True` الزامی) |
| `contractor` | FK پیمانکار (nullable؛ اگر `tab.contractor_required=True` الزامی) |
| `date_from` / `date_to` | بازه. برای `daily` هر دو برابر `date_from` می‌شود |
| `hour` | فقط `daily` الزامی (`HH:MM`). مقدار `08:30` → ذخیره `08:30:00` |
| `inputs` | JSON ورودی‌های تمیز (`{tonnage: 120, vehicle: "کفی"}`) |
| `outputs` | JSON خروجی‌های محاسبه‌شده (`{avg_per_car: 30, dry_tonnage: 114}`) |
| `note` | یادداشت |
| `created_by` / `created_at` | ثبت‌کننده |

### اعتبارسنجی رکورد (`clean` + `_make_record` در ViewSet)

1. `tab` الزامی.
2. `line` اگر `require_line` الزامی، وگرنه اختیاری؛ اگر داده شد باید `line.factory == tab.factory`.
3. `contractor` مشابه (اگر `contractor_required` الزامی).
4. `date_from`/`date_to` الزامی، `YYYY-MM-DD`، `date_to >= date_from`.
5. برای `daily`: `hour` الزامی `HH:MM`، و `date_to = date_from`.
6. `inputs`: کلید ناشناخته → ۴۰۰؛ `required` خالی → ۴۰۰؛ `number` غیرعددی/bool → ۴۰۰؛ `select` خارج از `options` → ۴۰۰.
7. ورودی‌های `number` اختیاری اگر نفرستاده شوند اصلاً در `env` نیستند — فرمولی که به آن‌ها ارجاع دهد خطا می‌دهد. پس اگر فرمول به `moisture` وابسته است، ورودی را `required=False` نگذارید یا فرمول را `if`-دار بنویسید.

### ثبت رکورد — مثال‌ها

**مثال ۱ — daily (تناژ):**

```http
POST /api/factory-tab-records/
{
  "tab": 27,
  "line": 104,
  "contractor": 18,
  "date_from": "2026-09-20",
  "date_to": "2026-09-20",
  "hour": "10:30",
  "inputs": {"tonnage": 120, "cars": 4, "moisture": 5, "vehicle": "کفی"},
  "note": "تحویل نمونه"
}
→ 201 {id, tab, line, contractor, date_from, date_to, hour:"10:30:00", inputs:{...}, outputs:{avg_per_car:30, dry_tonnage:114, eff_idx:61.14}}
```

**مثال ۲ — range (عملکرد):**

```http
POST /api/factory-tab-records/
{
  "tab": 28,
  "line": 105,
  "date_from": "2026-09-18",
  "date_to": "2026-09-20",
  "inputs": {"feed_fe": 48.5, "product_fe": 62.3, "sio2": 6.2, "method": "مغناطیسی"},
  "note": ""
}
→ outputs {recovery:128.45, grade_gap:13.8, adj_recovery:124.47, score:138.27, tonnage_ref: ...}
```

**مثال ۳ — بدون خط/پیمانکار (تب آزاد):**

```http
POST /api/factory-tab-records/
{
  "tab": 29,
  "date_from": "2026-09-20",
  "date_to": "2026-09-20",
  "inputs": {"downtime_h": 2.5, "shift_name": "صبح", "status": "خرابی", "overtime": 0.5}
}
```

### فیلتر و صفحه‌بندی

```http
GET /api/factory-tab-records/?tab=27&line=104&contractor=18&date_from=2026-09-01&date_to=2026-09-20&page=1&page_size=30
→ {"count":182, "next":"...", "previous":null, "results":[...]}
```

اسکیمای فرم (برای رندر داینامیک):

```http
GET /api/factory-tabs/27/schema/
→ {
  "tab": {"id":27, "key":"mega-tonnage", "name":"تناژ تحویلی روزانه", "record_type":"daily", "require_line":true},
  "contractor": {"required":true, "options":[{"id":18,"name":"پیمانکار الف - فعال"}]},
  "lines": [{"id":104,"name":"خط خردایش ۱"}],
  "inputs": [{"id":1,"key":"tonnage","name":"تناژ تحویلی","type":"number","options":[],"required":true,"unit":"تن"}, ...],
  "outputs": [{"id":1,"key":"avg_per_car","name":"میانگین هر خودرو","unit":"تن"}],
  "defined": true
}
```

کپی در فرانت: `components/factoryTabs/TabRecordForm.tsx`.

---

## 7. گزارش‌ها (Reports)

`FactoryTabReport` — هر تب می‌تواند چند گزارش داشته باشد (یکی می‌تواند `is_default=True`).

| فیلد | توضیح |
|------|-------|
| `tab` | FK تب |
| `name` | نام گزارش |
| `description` | توضیح |
| `is_default` | پیش‌فرض تب (در صفحه تب اول نمایش داده می‌شود) |
| `order` | ترتیب |
| `is_active` | فعال |
| `filters` | لیست زیرمجموعهٔ `["line","contractor","date_from","date_to"]` — خالی = همه. `normalize_report_filters` ترتیب کانونی می‌دهد |
| `metrics` | لیست `{key,label,formula,unit}` — فرمول گزارش (تجمیعی) |
| `widgets` | ویجت‌ها (جدا) |

### متریک‌ها (Metrics)

متریک = عدد محاسباتی سطح گزارش، روی **تجمیع رکوردهای فیلترشده** حساب می‌شود.

- فرمول متریک با همان موتور امن `formula.py` است.
- متغیر مجاز:

  ```
  in.<key>__sum | __avg | __min | __max | __count   (ورودی عددی همین تب)
  out.<key>__sum | __avg | __min | __max | __count  (خروجی همین تب)
  <norm_key>.in.<k>__<stat> / <norm_key>.out.<k>__<stat>  (تب دیگر — در گزارش سه‌بخشی)
  record_count                                      (تعداد رکورد فیلترشده)
  <key متریک دیگر>                                   (ارجاع زنجیره‌ای)
  ```

  مثال:

  ```json
  {"key": "avg_per_car_m", "label": "میانگین هر خودرو", "unit": "تن", "formula": "in.tonnage__sum / in.cars__sum"}
  {"key": "total_tonnage", "label": "جمع تناژ", "unit": "تن", "formula": "in.tonnage__sum"}
  {"key": "recovery_w",    "label": "بازیابی وزنی", "unit": "درصد", "formula": "out.recovery__avg"}
  ```

- `key` باید `^[A-Za-z_][A-Za-z0-9_]*$`، یکتا در گزارش، حداکثر ۳۰ متریک.
- وابستگی دایره‌ای بین متریک‌ها خطا می‌دهد (`_topo_sort`).
- تقسیم بر صفر / NaN در `evaluate` → مقدار متریک `null` و `error` پر می‌شود؛ بقیهٔ گزارش سالم می‌ماند.
- گرد کردن: ۴ رقم اعشار (`ROUND_DIGITS=4`).

### مثال ساخت گزارش (API)

```http
POST /api/factory-tab-reports/
{
  "tab": 27,
  "name": "گزارش تحویل روزانه — کامل",
  "description": "KPI + تفکیک خودرو + توزیع ساعتی",
  "is_default": true,
  "order": 0,
  "is_active": true,
  "filters": ["line","contractor","date_from","date_to"],
  "metrics": [
    {"key":"total_tonnage","label":"جمع تناژ","unit":"تن","formula":"in.tonnage__sum"},
    {"key":"avg_per_car_m","label":"میانگین هر خودرو","unit":"تن","formula":"in.tonnage__sum / in.cars__sum"}
  ]
}
→ 201 {id, tab:27, name, filters, metrics, widgets:[]}
```

---

## 8. ویجت‌ها (Widgets)

`FactoryTabWidget` — هر گزارش چند ویجت. `widget_type` از رجیستری `WIDGET_TYPES` (`machines/tab_reports.py`).
`config` JSON مختص نوع ویجت است و در `validate_widget_config` نرمال می‌شود.
در `run_report` هم دوباره نرمال می‌شود تا کانفیگ‌های قدیمی/دستی هم کار کنند.

**فهرست نوع‌ها:** `GET /api/factory-tab-reports/types/`

```json
{"widget_types":["chart","group_table","kpi","stat_table"],
 "widget_labels":{"kpi":"شاخص‌ها (KPI)","stat_table":"جدول آماری فیلدها","group_table":"جدول گروه‌بندی","chart":"نمودار"},
 "aggregations":["sum","avg","min","max","count"],
 "group_bys":["line","contractor","date","week","month","hour","field_value"],
 "filters":["line","contractor","date_from","date_to"]}
```

### 8.1 kpi — کارت‌های شاخص

```json
{
  "widget_type": "kpi",
  "title": "شاخص‌ها",
  "config": {
    "cards": [
      {"kind": "count",  "label": "تعداد تحویل"},
      {"kind": "stat",   "field": "in.tonnage",     "stat": "sum", "label": "جمع تناژ",         "sub_stats": ["avg","min","max"]},
      {"kind": "stat",   "field": "out.avg_per_car","stat": "avg", "label": "میانگین هر خودرو", "sub_stats": ["avg","min","max"]},
      {"kind": "metric", "metric": "avg_per_car_m","label": "میانگین محاسباتی"}
    ]
  }
}
```

- `cards`: ۱..۱۲.
- `kind`: `count` (تعداد رکورد) / `stat` (آمار یک فیلد) / `metric` (مقدار یک متریک گزارش).
- `field` برای `stat` باید `in.<k>` یا `out.<k>` یا `<norm>.in.<k>` / `<norm>.out.<k>`.
- `stat`: یکی از `sum/avg/min/max/count`. `sub_stats` زیرمجموعهٔ همان‌ها.
- خروجی `run`: `{"cards":[{"label","value","sub":{avg,min,max}}]}`.

### 8.2 stat_table — جدول آماری هر فیلد

«برای هر فیلد، جمع/میانگین/...»

```json
{
  "widget_type": "stat_table",
  "title": "آمار فیلدها",
  "config": {
    "sources": ["out","in"],
    "fields": ["in.tonnage","in.cars","out.avg_per_car","out.dry_tonnage"],
    "stats": ["sum","avg","min","max","count"]
  }
}
```

- `sources`: زیرمجموعهٔ `["out","in"]`.
- `fields`: اگر نفرستید، همه عددی‌های همان `sources`. حداکثر ۵۰.
- `stats`: زیرمجموعهٔ `AGG_STATS`.
- خروجی: `{"columns":["field","label","sum","avg",...], "rows":[{"field":"in.tonnage","label":"تناژ تحویلی","sum":1234,...}]}`.

### 8.3 group_table — جدول گروه‌بندی

تفکیک رکوردها بر اساس `line` / `contractor` / `date` / `week` / `month` / `hour` / `field_value`.

```json
{
  "widget_type": "group_table",
  "title": "تفکیک نوع خودرو",
  "config": {
    "group_by": "field_value",
    "field": "in.vehicle",
    "fields": ["in.tonnage","in.cars","out.avg_per_car"],
    "stats": ["sum","avg","count"],
    "sort": "value_desc",
    "sort_field": "in.tonnage",
    "sort_stat": "sum",
    "limit": 20,
    "include_total": true
  }
}
```

| پارامتر | توضیح |
|---------|-------|
| `group_by` | یکی از `GROUP_BYS` |
| `field` | فقط برای `field_value` الزامی؛ `in.<k>` (select/text) یا عددی، یا `out.<k>` |
| `fields` | فیلدهای عددی برای تجمیع (۱..۲۰) |
| `stats` | تجمیع‌ها |
| `sort` | `count_desc` / `label_asc` / `value_desc` |
| `sort_field`/`sort_stat` | برای `value_desc` الزامی |
| `limit` | ۱..۲۰۰ |
| `include_total` | ردیف «جمع کل» اضافه شود؟ |

خروجی: `{"columns":["label","count","in.tonnage__sum",...], "rows":[...], "total":{"label":"جمع کل",...}}`.

### 8.4 chart — نمودار (bar/line/pie)

```json
{
  "widget_type": "chart",
  "title": "روند روزانه تناژ",
  "config": {
    "chart": "line",
    "group_by": "date",
    "value": {"field": "in.tonnage", "stat": "sum"},
    "sort": "label_asc",
    "limit": 30
  }
}
```

```json
{
  "widget_type": "chart",
  "title": "سهم خودرو",
  "config": {
    "chart": "pie",
    "group_by": "field_value",
    "field": "in.vehicle",
    "value": {"field": "in.tonnage", "stat": "sum"},
    "sort": "value_desc",
    "limit": 10
  }
}
```

| پارامتر | توضیح |
|---------|-------|
| `chart` | `bar` / `line` / `pie` |
| `group_by` / `field` | مثل `group_table` |
| `value` | `"count"` یا `{"field":"in.tonnage","stat":"sum"}` |
| `sort` | `count_desc`/`label_asc`/`value_desc` (پیش‌فرض: برای `date/week/month/hour` → `label_asc` وگرنه `value_desc`) |
| `limit` | ۱..۱۰۰ |

خروجی: `{"chart":"line","value_label":"تناژ تحویلی (sum)","points":[{"x":"line:5","label":"خط خردایش ۱","value":1234}]}` —
مستقیم برای `recharts`: `bar/line` → `<Bar dataKey="value"/>`، `pie` → `<Pie dataKey="value" nameKey="label"/>`.

### ساخت ویجت (API)

```http
POST /api/factory-tab-reports/<report_id>/widgets/
{"widget_type":"kpi","title":"شاخص‌ها","order":0,"is_active":true,"config":{"cards":[...]}}
→ 201 {id, widget_type, title, config (نرمال‌شده)}

PATCH /api/factory-tab-reports/<report_id>/widgets/<widget_id>/
{"title":"شاخص‌های جدید","config":{...}}

DELETE /api/factory-tab-reports/<report_id>/widgets/<widget_id>/
```

مدیریت ترتیب: دو ویجت `order` را جابه‌جا کنید (مثل فرانت `moveWidget`).

---

## 9. اجرای گزارش (Run)

```http
GET /api/factory-tab-reports/<id>/run/?line=104&contractor=18&date_from=2026-09-01&date_to=2026-09-20
```

- پارامترها فقط اگر در `report.filters` مجاز باشند اعمال می‌شوند؛ `filters=[]` یعنی همه مجاز.
- `line` تکی یا `lines=1,2`؛ `date_from`/`date_to` با `YYYY-MM-DD`.
- سقف `REPORT_MAX_RECORDS=10000`؛ بیشتر → `400: تعداد رکوردها (12345) بیش از سقف (10000)؛ بازه را محدود کنید.`
- پاسخ (نمونه کوتاه):

```json
{
  "report": {"id":22,"name":"گزارش تحویل روزانه — کامل","tab":{"id":27,"key":"mega-tonnage","name":"تناژ تحویلی روزانه"}},
  "filters_applied": {"line":"104","date_from":"2026-09-01"},
  "record_count": 42,
  "metrics": [{"key":"total_tonnage","label":"جمع تناژ","unit":"تن","value":5234.0,"error":null}],
  "widgets": [
    {"id":10,"type":"kpi","title":"شاخص‌ها","data":{"cards":[{"label":"تعداد تحویل","value":42,"sub":{}}]}},
    {"id":11,"type":"chart","title":"روند روزانه","data":{"chart":"line","points":[...]}},
    {"id":99,"type":"chart","title":"خراب","error":"فیلد «in.foo» در این تب تعریف نشده است."}
  ],
  "meta": {"engine":"tab_reports/1","generated_at":"2026-09-27T14:30:00","max_records":10000,"widget_types":["chart","group_table","kpi","stat_table"]}
}
```

ویجت خراب (`error`) بقیهٔ گزارش را خراب نمی‌کند.

---

## 10. API کامل

| کار | متد | مسیر | پرمیشن |
|-----|-----|------|--------|
| لیست/ساخت تب | `GET`/`POST` | `/api/factory-tabs/?factory=&active=` | `factory-tabs.view` / `manage` |
| جزئیات تب | `GET`/`PATCH`/`DELETE` | `/api/factory-tabs/<id>/` | `view` / `manage` |
| متغیرهای فرمول | `GET` | `/api/factory-tabs/<id>/formula-vars/` | `view` |
| اسکیمای فرم | `GET` | `/api/factory-tabs/<id>/schema/` | `view` |
| ورودی‌ها | `GET`/`POST` | `/api/factory-tabs/<id>/inputs/` | `view` / `manage` |
| ورودی تکی | `PATCH`/`DELETE` | `/api/factory-tabs/<id>/inputs/<pk>/` | `manage` |
| خروجی‌ها | `GET`/`POST` | `/api/factory-tabs/<id>/outputs/` | `view` / `manage` |
| خروجی تکی | `PATCH`/`DELETE` | `/api/factory-tabs/<id>/outputs/<pk>/` | `manage` |
| اعتبارسنجی فرمول | `POST` | `/api/formula/validate-tab/` `{tab_id, expression}` | `view` |
| رکوردها | `GET`/`POST` | `/api/factory-tab-records/?tab=&line=&contractor=&date_from=&date_to=&page=` | `view` / `create` |
| رکورد تکی | `PATCH`/`DELETE` | `/api/factory-tab-records/<id>/` | `edit` / `delete` |
| گزارش‌ها | `GET`/`POST` | `/api/factory-tab-reports/?tab=&active=` | `view` / `manage` |
| گزارش تکی | `PATCH`/`DELETE` | `/api/factory-tab-reports/<id>/` | `manage` |
| ویجت‌ها | `GET`/`POST` | `/api/factory-tab-reports/<id>/widgets/` | `view` / `manage` |
| ویجت تکی | `PATCH`/`DELETE` | `/api/factory-tab-reports/<id>/widgets/<pk>/` | `manage` |
| اجرای گزارش | `GET` | `/api/factory-tab-reports/<id>/run/?line=&contractor=&date_from=&date_to=` | `view` |
| انواع/تجمیع/گروه‌بندی | `GET` | `/api/factory-tab-reports/types/` | `view` |

اسکوپ کارخانه: `get_user_factory(request.user)` — اگر کاربر `operator/manager` یک کارخانه باشد،
فقط همان کارخانه را می‌بیند؛ `admin`/`superuser` همه را.

---

## 11. فرانت‌اند

### صفحه تب: `pages/FactoryTabs.tsx` — سه زبانه

| زبانه | محتوا |
|------|-------|
| **ثبت / مدیریت رکوردها** | جدول رکوردها + فیلتر `خط/پیمانکار/بازه` + خروجی (PDF/XLSX/...) + دکمهٔ «ثبت رکورد جدید» (مودال `TabRecordForm`) |
| **گزارش و نمودار** | انتخاب گزارش (اگر چند گزارش) + `TabReportPanel` (رندر `run` → KPI/جدول/نمودار) |
| **تنظیمات تب** (`factory-tabs.manage`) | `TabSettingsPanel` (۳ گام) + `ReportBuilderPanel` |

### TabSettingsPanel — سه گام

1. **مشخصات و آیکون:** نام/کلید/نوع ثبت/`require_line`/`contractor_required`/`is_active`/توضیحات + ۲۷ آیکون + ۱۲ رنگ.
2. **ورودی‌ها:** ردیف‌های `key/name/type/unit/required/order` + برای `select` فهرست کاما-جدا.
3. **خروجی‌ها و فرمول‌ها:** `key/name/unit/formula` + `textarea` فرمول با چیپ‌های متغیر مجاز (گروه‌بندی‌شده) و دکمهٔ «اعتبارسنجی فرمول».

### ReportBuilderPanel

- انتخاب گزارش (ساخت جدید / ویرایش) — نام/توضیح/پیش‌فرض/فیلترهای مجاز.
- **متریک‌ها:** هر ردیف `key/label/unit/formula` + چیپ‌های `record_count` / `in.*__sum` / `out.*__avg` / متریک‌های قبلی → کلیک = درج در فرمول.
- **ویجت‌ها:** لیست ویجت‌های گزارش + افزودن/ویرایش/حذف/جابه‌جایی/فعال‌خاموش. هر نوع فرم اختصاصی دارد
  (KPI: کارت‌ها؛ stat_table: منابع/فیلدها/تجمیع‌ها؛ group_table/chart: گروه‌بندی/مقدار/مرتب‌سازی/limit).

---

## 12. PDF و سایر خروجی‌ها

در `FactoryTabs` دکمهٔ «خروجی» همهٔ رکوردهای فیلترشده (تا ۵۰۰ صفحه‌بندی) را می‌گیرد:

| فرمت | محتوا |
|------|-------|
| **PDF صنعتی** | `buildTabReportPdf` → `buildPdfHtml` → `htmlToPdf`: **KPI + متریک‌ها → نمودارها → جدول‌های آماری → جدول تفکیکی → جدول جزئیات رکوردها**. اگر گزارش `run` نداشته باشد، فقط جدول رکوردها |
| XLSX/CSV/DOCX/HTML/JSON | فقط جدول رکوردها (`exportData`) — ستون‌ها = تاریخ/خط/پیمانکار/ساعت + هر خروجی با برچسب فارسی |

---

## 13. دسترسی‌ها (RBAC)

`accounts/permissions.py` — `ALL_PERMISSIONS` شامل:

```
factory-tabs.view / create / edit / delete / manage
```

| نقش | factory-tabs |
|-----|--------------|
| `admin` | همه |
| `manager` | همه (view+create+edit+delete+manage) |
| `operator` | `view` + `create` |
| `viewer` | `view` |

- `factory-tabs.manage` = ساخت/ویرایش تب، ورودی/خروجی، گزارش، ویجت.
- `factory-tabs.create/edit/delete` = ثبت/ویرایش/حذف رکورد.
- ماتریس قابل سفارشی‌سازی: `RolePermissionConfig` + `UserProfile.permissions={granted,denied}`.

---

## 14. سناریوی کامل گام‌به‌گام

### هدف: تب «تناژ تحویلی روزانه» (daily، خط+پیمانکار الزامی، ۳ خروجی فرمولی، ۲ گزارش)

**گام ۱ — ساخت تب:**

```http
POST /api/factory-tabs/
{"factory":42,"key":"tonnage-daily","name":"تناژ تحویلی روزانه","record_type":"daily","require_line":true,"contractor_required":true,"icon":"truck","color":"emerald"}
→ 201 {"id":100, ...}
```

**گام ۲ — ورودی‌ها (از صفحه تب → تنظیمات → گام ۲):**

```http
POST /api/factory-tabs/100/inputs/  {"key":"tonnage","name":"تناژ تحویلی","input_type":"number","unit":"تن","required":true,"order":0}
POST /api/factory-tabs/100/inputs/  {"key":"cars","name":"تعداد کامیون","input_type":"number","unit":"دستگاه","required":true}
POST /api/factory-tabs/100/inputs/  {"key":"moisture","name":"رطوبت","input_type":"number","unit":"درصد","required":false}
POST /api/factory-tabs/100/inputs/  {"key":"vehicle","name":"نوع خودرو","input_type":"select","options":["کفی","بونوس","تریلی"],"required":true}
```

**گام ۳ — خروجی‌ها:**

```http
POST /api/factory-tabs/100/outputs/ {"key":"avg_per_car","name":"میانگین هر خودرو","unit":"تن","formula":"tonnage / cars"}
POST /api/factory-tabs/100/outputs/ {"key":"dry_tonnage","name":"تناژ خشک","unit":"تن","formula":"tonnage * (100 - moisture) / 100"}
POST /api/factory-tabs/100/outputs/ {"key":"eff_idx","name":"شاخص","unit":"امتیاز","formula":"round(avg_per_car * 2 + dry_tonnage / 100, 2)"}
```

اگر `moisture` نفرستاده شود و فرمول به آن وابسته باشد → هنگام ثبت رکورد خطای
`متغیر «moisture» وجود ندارد`. برای جلوگیری، ورودی را الزامی کنید یا فرمول را
`if(moisture, tonnage*(100-moisture)/100, tonnage)` بنویسید — اما `moisture` باید حداقل یک‌بار مقدار داشته باشد.

**گام ۴ — ثبت رکورد:**

```http
POST /api/factory-tab-records/
{"tab":100,"line":104,"contractor":18,"date_from":"2026-09-25","date_to":"2026-09-25","hour":"10:30","inputs":{"tonnage":120,"cars":4,"moisture":5,"vehicle":"کفی"}}
→ outputs {avg_per_car:30, dry_tonnage:114, eff_idx:61.14}
```

**گام ۵ — ساخت گزارش:**

```http
POST /api/factory-tab-reports/
{"tab":100,"name":"گزارش جامع","is_default":true,"filters":["line","contractor","date_from","date_to"],
 "metrics":[{"key":"total","label":"جمع تناژ","unit":"تن","formula":"in.tonnage__sum"}]}
→ 201 {"id":200}
```

**گام ۶ — افزودن ویجت‌ها:**

```http
POST /api/factory-tab-reports/200/widgets/
{"widget_type":"kpi","title":"شاخص‌ها","config":{"cards":[{"kind":"count","label":"تعداد"},{"kind":"stat","field":"in.tonnage","stat":"sum","label":"جمع تناژ","sub_stats":["avg","min","max"]}]}}

POST /api/factory-tab-reports/200/widgets/
{"widget_type":"group_table","title":"تفکیک خودرو","config":{"group_by":"field_value","field":"in.vehicle","fields":["in.tonnage"],"stats":["sum","count"],"sort":"value_desc","sort_field":"in.tonnage","sort_stat":"sum","limit":20}}

POST /api/factory-tab-reports/200/widgets/
{"widget_type":"chart","title":"توزیع ساعتی","config":{"chart":"bar","group_by":"hour","value":"count","sort":"label_asc","limit":24}}
```

**گام ۷ — اجرا و دیدن:**

```http
GET /api/factory-tab-reports/200/run/?date_from=2026-09-01&date_to=2026-09-30
→ {record_count, metrics:[{key:"total",value:5234}], widgets:[{type:"kpi",data:{cards:[...]}}, ...]}
```

در UI: زبانهٔ «گزارش و نمودار» همان را رندر می‌کند. دکمهٔ «خروجی → PDF» کل گزارش + جدول رکوردها را PDF می‌کند.

---

## 15. فرمول‌ها

**موتور:** `machines/formula.py` — lexer + parser دستی، بدون `eval`.

| دسته | مجاز |
|------|------|
| عدد | `12`, `3.14`, `.5`, `1e3` ممنوع (فقط اعشاری ساده) |
| متغیر | `tonnage`, `avg_per_car`, `mega_tonnage.dry_tonnage` (حداکثر ۲ نقطه) |
| عملگر | `+ - * / % ^` (توان)، مقایسه `== != < > <= >=` (۱/۰ برمی‌گرداند)، پرانتز |
| تابع | `abs, sqrt, cbrt, pow, min, max, round, floor, ceil, log, log10, exp, sin, cos, tan, asin, acos, atan, atan2, sign, if` |

- `if(cond, a, b)` — اگر `cond != 0` مقدار `a` وگرنه `b`.
- `round(x, n)` — یک یا دو آرگومان.
- `min/max` یک تا بی‌نهایت آرگومان.
- محدودیت: طول ۲۰۰۰ کاراکتر، ۳۰۰ توکن، `^` با توان >10000 یا پایه >1e6 با توان >100 خطا.
- تقسیم بر صفر / `sqrt(-1)` / `log(0)` → `FormulaError` فارسی.

### مثال‌های فرمول

```
tonnage / cars
tonnage * (100 - moisture) / 100
round(avg_per_car * 2 + dry_tonnage / 100, 2)
if(fe > 60, 1, 0)
min(fe_abs, 70) + max(s, 0) * 2
pow(fe, 2) + sqrt(sio2)
mega_tonnage.dry_tonnage * 0.1 + recovery   ← بین‌تبی (زیرخط)
in.tonnage__sum / in.cars__sum               ← متریک گزارش
```

---

## 16. خطاهای رایج و رفع

| پیام | علت | رفع |
|------|-----|-----|
| `کلید تکراری «tonnage»` | `inputs` یا `outputs` دو ردیف با یک `key` | یکی را تغییر/حذف کنید |
| `ورودی انتخابی باید حداقل یک گزینه داشته باشد` | `select` با `options:[]` | گزینه‌ها را با کاما پر کنید |
| `متغیر «foo» در این تب تعریف نشده` | فرمول به فیلدی که در تب نیست ارجاع می‌دهد | `formula-vars` را ببینید؛ املا را چک کنید |
| `متغیر «vehicle» از نوع انتخابی است و در فرمول عددی قابل استفاده نیست` | `select` در فرمول | فقط `number`ها در فرمول مجازند |
| `وابستگی دایره‌ای بین خروجی‌ها: a -> b -> a` | دو خروجی به هم ارجاع می‌دهند | یکی را حذف/بازنویسی کنید |
| `متغیر «sio2» در این آنالیز وجود ندارد — مقدار ورودی آن ثبت نشده` | ورودی اختیاری نفرستاده شده ولی فرمول به آن وابسته است | ورودی را الزامی کنید یا مقدار پیش‌فرض بفرستید یا فرمول را تغییر دهید |
| `تاریخ پایان بازه نمی‌تواند قبل از شروع باشد` | `date_to < date_from` | بازه را درست کنید |
| `ساعت ثبت برای تب روزانه الزامی است` | `daily` بدون `hour` | `HH:MM` بفرستید |
| `تعداد رکوردها (12345) بیش از سقف (10000)` | بازه خیلی بزرگ | `date_from/to` را محدود کنید |
| `فیلد «in.foo» در این تب تعریف نشده` (در گزارش) | `config` ویجت به فیلد ناموجود ارجاع می‌دهد | فیلد را به `in./out.` درست بنویسید |
| `۴۰۳ شما به این بخش دسترسی ندارید` | پرمیشن ناکافی | نقش را `manager` کنید یا `factory-tabs.manage` بدهید |
| `۴۰۴ یافت نشد` هنگام ثبت رکورد | `line`/`contractor` متعلق به کارخانهٔ دیگر | فقط خط/پیمانکار همین کارخانه |

---

## 17. توسعهٔ ویجت جدید

بدون دست‌کاری موتور اصلی:

1. در `machines/tab_reports.py` دو تابع بسازید:

```python
def _validate_my_widget(tab, config, metric_keys=None):
    # config را چک و نرمال کن، ValueError فارسی بده اگر نامعتبر
    return {"my_param": config["my_param"]}

def _run_my_widget(rows, ctx, config):
    # rows: لیست سطرهای نرمال‌شده، ctx={record_count, labels, metrics}
    # مقدار JSON-serializable برگردان
    return {"hello": len(rows)}
```

2. به `WIDGET_TYPES` اضافه کنید:

```python
WIDGET_TYPES["my_widget"] = {"label": "ویجت من", "validate": _validate_my_widget, "run": _run_my_widget}
```

3. فرانت خودکار آن را در `ReportBuilderPanel` و `TabReportPanel` می‌شناسد
   (از `GET /types` می‌خواند). برای فرم اختصاصی، یک شاخه در `ReportBuilderPanel` اضافه کنید.

`rows` هر رکورد:

```python
{"id":1, "date":"2026-09-20", "date_label":"۱۴۰۵/۰۶/۲۹", "week":"2026-W38",
 "month":"2026-09", "hour":"10:00", "line":"خط خردایش ۱", "line_id":104,
 "contractor":"پیمانکار الف", "contractor_id":18,
 "out":{"avg_per_car":30}, "in_num":{"tonnage":120}, "cat":{"vehicle":"کفی"}}
```

---

## 18. تست و سید

```powershell
# سید — روی «کارخانه جامع فیک» (id=42) یا اولین کارخانه
python seed_mega_factory.py        # 6 خط، 21 دستگاه، 1619 لاگ، 4 تب فعال، 6 گزارش، 470 رکورد
python seed_tabs_demo.py --reset   # 4 تب روی اولین کارخانه + 90 روز رکورد

# تست (نیازمند pytest — اگر نصب نیست warning می‌دهد)
python manage.py test machines.test_factory_tabs
python manage.py test machines.test_tab_reports
python manage.py test machines.test_cross_tab
python manage.py test machines.test_factory_tabs machines.test_tab_reports machines.test_cross_tab

# چک سلامت
python manage.py check
cd frontend; npm run lint   # tsc --noEmit
npm run build               # vite build
```

---

## پیوست — نمونهٔ JSON کامل گزارش با سه ویجت

```json
{
  "tab": 27,
  "name": "گزارش تحویل روزانه — کامل",
  "is_default": true,
  "filters": ["line","contractor","date_from","date_to"],
  "metrics": [
    {"key":"total_tonnage","label":"جمع تناژ","unit":"تن","formula":"in.tonnage__sum"},
    {"key":"avg_per_car_m","label":"میانگین هر خودرو","unit":"تن","formula":"in.tonnage__sum / in.cars__sum"}
  ]
}
→ report_id=22

POST /api/factory-tab-reports/22/widgets/ {"widget_type":"kpi","title":"شاخص‌ها","config":{"cards":[
  {"kind":"count","label":"تعداد تحویل"},
  {"kind":"stat","field":"in.tonnage","stat":"sum","label":"جمع تناژ","sub_stats":["avg","min","max"]},
  {"kind":"metric","metric":"avg_per_car_m","label":"میانگین"}
]}}
POST /api/factory-tab-reports/22/widgets/ {"widget_type":"group_table","title":"تفکیک خودرو","config":{"group_by":"field_value","field":"in.vehicle","fields":["in.tonnage","in.cars"],"stats":["sum","avg"],"sort":"value_desc","sort_field":"in.tonnage","sort_stat":"sum"}}
POST /api/factory-tab-reports/22/widgets/ {"widget_type":"chart","title":"توزیع ساعتی","config":{"chart":"bar","group_by":"hour","value":"count","sort":"label_asc","limit":24}}
```

---

*این فایل را کنار `TABS_GUIDE.md` و `TAB_REPORTS.md` نگه دارید — آن دو «مرجع سریع»اند،
این فایل «آموزش کامل با مثال‌های قابل کپی» است. برای هر تب جدید کافی است
بخش ۱۴ را گام‌به‌گام با مقادیر خودتان تکرار کنید.*
