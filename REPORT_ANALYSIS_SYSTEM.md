# گزارش فنی — سیستم آنالیز داینامیک (تعریف‌محور) در بک‌اند

> نسخه: Backend only — بدون هیچ تغییری در Frontend/UI/Component/Form/API Client
> تاریخ: مرداد ۱۴۰۵

---

## ۱. خلاصه

به سیستم بک‌اند، یک **سیستم کامل و داینامیک برای تعریف و ثبت Analysis** اضافه شد که کاملاً مبتنی بر **Definition** است. کاربر برای ثبت یک «آنالیز واقعی (Actual Analysis)» فقط **Production Line** را انتخاب می‌کند و Backend بر اساس `Line Analysis Definition` آن خط، **کل ساختار فرم** را برمی‌گرداند:

```text
Production Line
  └── Analysis Positions (تعداد/نام داینامیک)
        └── Analysis Type Definition (فقط Inputها)
Line Analysis Definition
  ├── Position Inputs (ساخته‌شده از Positionها)
  ├── Additional Inputs (داینامیک)
  ├── Contractor (محدود به Factory خط)
  └── Outputs + Formula (داینامیک و امن)
Actual Analysis
  ├── Inputها بر اساس Schema برگشتی
  └── Outputها خودکار توسط موتور فرمول محاسبه می‌شوند
```

هیچ فیلدی (Fe، FeO، SiO2، خوراک/محصول/باطله و ...) در کد **Hard-code** نشده است. فرمول‌ها نیز با یک موتور امن (بدون `eval`) پارس/اعتبارسنجی/محاسبه می‌شوند.

---

## ۲. معماری و رابطه‌ی بخش‌ها

```text
Factory
├── Contractor (فقط یک کارخانه — Unique(factory, name))
└── ProductionLine
      ├── Devices (سیستم قبلی — دست‌نخورده)
      └── AnalysisPosition (داینامیک)
            └── AnalysisTypeDefinition
                  └── AnalysisInputDefinition (فقط Inputها؛ بدون Output)
ProductionLine (1:1) → LineAnalysisDefinition
      ├── AdditionalInputDefinition
      └── AnalysisOutputDefinition (formula)
ActualAnalysis
      ├── line / contractor / date / shift
      ├── inputs (positions + additional_inputs)
      └── outputs (محاسبه‌شده توسط Formula Engine)
```

`AnalysisTypeDefinition` **خروجی/فرمول ندارد**؛ Output و Formula فقط در `LineAnalysisDefinition` تعریف می‌شوند (بخش چهارم تسک).

---

## ۳. Modelها (در `machines/models.py`)

| مدل | فیلدهای اصلی | نکته |
|-----|-------------|------|
| `Contractor` | factory (FK)، name، contact_name، phone، is_active | `Unique(factory, name)` — هر پیمانکار فقط یک Factory |
| `AnalysisTypeDefinition` | name (unique)، description | فقط تعریف نوع؛ بدون Output |
| `AnalysisInputDefinition` | definition (FK)، key، name، input_type، unit، required، order | `Unique(definition, key)` |
| `AnalysisPosition` | line (FK)، name، key، definition (FK→AnalysisTypeDefinition, nullable)، order | `Unique(line, key)`؛ تعداد/نام داینامیک |
| `LineAnalysisDefinition` | line (OneToOne)، contractor_required، notes | در `clean()` فرمول‌ها و چرخه اعتبارسنجی می‌شوند |
| `AdditionalInputDefinition` | line_definition (FK)، key، name، input_type، unit، required، order | `Unique(line_definition, key)` |
| `AnalysisOutputDefinition` | line_definition (FK)، key، name، unit، formula، order | `Unique(line_definition, key)`؛ فرمول متنی |
| `ActualAnalysis` | line (FK)، contractor (FK nullable)، date، shift، inputs (JSON)، outputs (JSON)، created_by | outputها فقط محاسبه‌شده ذخیره می‌شوند |

فایل‌های پشتیبان:
- `machines/formula.py` — موتور فرمول امن
- `machines/analysis_validation.py` — اعتبارسنجی فرمول و چرخه در سطح تعریف
- `machines/analysis.py` — سرویس Schema و اعتبارسنجی/محاسبه‌ی Actual Analysis
- `machines/test_analysis.py` — تست‌های کامل

---

## ۴. APIها (مسیرهای جدید — `machines/urls.py`)

### پیمانکار
- `GET/POST  /api/contractors/` — لیست (با فیلتر `?factory=`) و ایجاد
- `GET/PATCH/DELETE  /api/contractors/{id}/`
- دسترسی: خواندن = `factory.view`؛ نوشتن = `contractor.manage` (مدیر/ادمین)

### تعریف نوع آنالیز
- `GET/POST  /api/analysis-type-definitions/` (با ورودی‌های تو در تو)
- `GET/PATCH/DELETE  /api/analysis-type-definitions/{id}/`
- مدیریت Inputها از طریق همان payload تودرتو (`inputs: [...]`) انجام می‌شود (افزودن/حذف/ویرایش)
- دسترسی: خواندن = `analysis.view`؛ نوشتن = `analysis.manage`

### موقعیت‌های آنالیز خط (تعداد/نام داینامیک)
- `GET/POST  /api/production-lines/{line_id}/analysis-positions/`
- `GET/PATCH/DELETE  /api/production-lines/{line_id}/analysis-positions/{pk}/`
- اتصال Position به `AnalysisTypeDefinition` با فیلد `definition` در همین endpointها

### تعریف آنالیز خط (Line Analysis Definition)
- `PUT  /api/production-lines/{line_id}/line-analysis-definition/upsert/` — ایجاد یا به‌روزرسانی کامل
  - body شامل: `contractor_required`، `additional_inputs: [...]`، `outputs: [{key,name,unit,formula}]`
  - در همین نقطه فرمول‌ها اعتبارسنجی و چرخه‌یابی می‌شوند
- `GET/DELETE  /api/production-lines/{line_id}/line-analysis-definition/`
- `POST  /api/production-lines/{line_id}/additional-inputs/` و `PATCH/DELETE  /{pk}/`
- `POST  /api/production-lines/{line_id}/outputs/` و `PATCH/DELETE  /{pk}/`

### Actual Analysis
- `GET  /api/production-lines/{line_id}/analysis-definition/` — **Dynamic Form Schema**
- `GET/POST  /api/actual-analyses/` (فیلتر: `line`، `date_from/to`، `contractor`)
- `GET/PATCH/PUT/DELETE  /api/actual-analyses/{id}/` (با محاسبه‌ی مجدد خروجی‌ها)
- دسترسی: view/create/edit/delete مطابق `analysis.*`

### Factory
- `GET /api/factory-setup/` — بدون تغییر مسیر؛ با افزودن `contractors` و `analysis_positions` و بهینه‌سازی Query (بدون N+1)

---

## ۵. Dynamic Schema (نحوه‌ی کار)

جریان کار:

1. کاربر `Line` را انتخاب می‌کند.
2. Backend `LineAnalysisDefinition` (یا `analysis_definition`) همان خط را پیدا می‌کند (در `machines/analysis.build_schema`).
3. برای هر `AnalysisPosition` خط، `AnalysisTypeDefinition` و سپس `AnalysisInputDefinition`هایش خوانده می‌شود.
4. خروجی ساختار زیر است (نمونه):

```json
{
  "line": {"id": 1, "name": "Line 1"},
  "contractor": {"required": true, "options": [{"id": 10, "name": "Contractor A"}]},
  "positions": [
    {
      "id": 100, "key": "feed", "name": "خوراک",
      "definition": {"id": 1, "name": "Fe/FeO"},
      "inputs": [{"id": 1, "key": "fe", "name": "Fe", "type": "number", "required": true, "unit": "%"}]
    }
  ],
  "additional_inputs": [{"id": 20, "key": "input_a", "name": "Input A", "type": "number", "required": false}],
  "outputs": [{"id": 30, "key": "recovery", "name": "Recovery", "unit": "%"}],
  "defined": true
}
```

5. Frontend فقط این ساختار را به فرم تبدیل می‌کند. با تغییر Line، کل ساختار عوض می‌شود (تست: خط ۱ با ۳ موقعیت و خط ۲ با ۵ موقعیت).

---

## ۶. Formula Engine (`machines/formula.py`)

- **بدون `eval`/`exec`**: یک lexer + parser دستی (recursive descent) → AST → ارزیابی امن.
- متغیرها: `position.input` (مثل `feed.fe`) یا `key` تکی (ورودی اضافه یا خروجی دیگر).
- توابع مجاز (whitelist): `abs, sqrt, cbrt, pow, min, max, round, floor, ceil, log, log10, exp, sin, cos, tan, asin, acos, atan, atan2, sign, if`
- عملگرها: `+ - * / % ^ ( )` و مقایسه `== != < <= > >=`
- اعتبارسنجی در ذخیره‌ی تعریف (`analysis_validation.py`):
  - Parse موفق
  - هر متغیر یا ورودیِ معتبرِ همان خط است (موقعیت/ورودی اضافه) یا کلید یک خروجی دیگر
  - **Circular Dependency** بین خروجی‌ها با DFS تشخیص و رد می‌شود
- محاسبه‌ی Actual Analysis: مرتب‌سازی توپولوژیک خروجی‌ها، ارزیابی با محیط مقادیر، گرد کردن به ۶ رقم؛ خطاها (تقسیم بر صفر، دامنه‌ی تابع، متغیر ناموجود) پیام فارسی برمی‌گردانند.
- Payload ساخت Actual Analysis:

```json
{
  "line_id": 1,
  "contractor_id": 10,
  "date": "2026-01-05",
  "positions": {"feed": {"fe": 52.3, "feo": 1.2}, "product": {"fe": 64.8, "feo": 0.8}},
  "additional_inputs": {"input_a": 20}
}
```

پاسخ شامل `outputs` محاسبه‌شده است؛ کاربر نمی‌تواند Output را خودش تعیین کند.

---

## ۷. Factory Response

`FactoryFullDetailSerializer` اکنون برمی‌گرداند:

```text
Factory
├── contractors
├── shifts / failure_reasons
└── lines
      ├── devices (ماشین‌ها)
      └── analysis_positions (با definition و inputs)
```

Queryها با `prefetch_related` بهینه شدند:
`shifts, contractors, lines__template, lines__devices__template, lines__devices__template__available_attributes, lines__analysis_positions__definition__inputs, lines__analysis_definition__additional_inputs, lines__analysis_definition__outputs`

اندازه‌گیری واقعی: درخواست `/api/factory-setup/` (برای ۴ کارخانه / ۱۰ خط / ۳۷ دستگاه) از **۹۶ کوئری به ۲۴ کوئری** رسید و **هیچ کوئری درون حلقه (N+1)** وجود ندارد.

---

## ۸. Migration

- فایل جدید: `machines/migrations/0007_analysistypedefinition_contractor_actualanalysis_and_more.py`
- جدول‌های جدید + constraintهای `unique_contractor_per_factory`، `uniq_input_key_per_definition`، `uniq_position_key_per_line`، `uniq_add_input_key_per_line_def`، `uniq_output_key_per_line_def` + ایندکس‌های `actualanalysis(line,date)` و `(contractor)`.
- داده‌ی قبلی دست‌نخورده (همه‌ی تغییرات افزودنی هستند)؛ `makemigrations --check` بدون تغییر است.
- فایل جدیدتر: `machines/migrations/0008_actualanalysis_date_range.py` (تبدیل `date` به `date_from/date_to`؛ داده‌ی قبلی با RunPython کپی می‌شود).

---

## ۹. تست‌ها (نتیجه‌ی واقعی اجرا)

دستور: `python manage.py test` — **۴۸ تست، همگی OK** (شامل تست‌های قبلی پروژه به‌عنوان Regression):

```text
Unit Tests (Formula Engine):        PASS
Integration / API Tests:            PASS
Contractor Tests:                   PASS
Analysis Type Definition Tests:     PASS
Line Positions & Schema Tests:      PASS
Line Analysis Definition Tests:     PASS
Actual Analysis Tests:              PASS
Factory Payload Tests:              PASS
Regression (machine tests قبلی):    PASS
Lint (flake8 F/E9 روی فایل‌های جدید): PASS
Formatter (black):                  PASS
Type Check:                         PASS (tsc --noEmit فرانت‌اند — بدون تغییر فرانت)
Build (فرانت‌اند، بدون تغییر):       PASS
Report Integration (test_reports_integration.py): PASS
Migration check (makemigrations --check): PASS
Django system check:                PASS
Query Optimization (N+1):           PASS (۹۶ → ۲۴ کوئری، بدون کوئری درون حلقه)
```

تست‌های کلیدی:
- جلوگیری از پیمانکار کارخانه‌ی دیگر هنگام ثبت Actual Analysis (پاسخ ۴۰۰)
- خط ۱ (۳ موقعیت) در برابر خط ۲ (۵ موقعیت با تعریف‌های متفاوت) — Schema متفاوت
- ورودی اجباری/ناشناخته/نوع نامعتبر/موقعیت نامعتبر رد می‌شوند
- فرمول نامعتبر و وابستگی دایره‌ای رد می‌شوند
- محاسبه‌ی خروجی‌ها (`recovery`، `grade`، `test_extra`) دقیق است
- بدون تعریف → خطای واضح ۴۰۰

---

## ۱۰. فایل‌های تغییر/ایجادشده

### جدید
- `machines/formula.py` — موتور فرمول امن
- `machines/analysis_validation.py` — اعتبارسنجی فرمول/چرخه در تعریف
- `machines/analysis.py` — سرویس Schema و محاسبه
- `machines/test_analysis.py` — تست‌ها
- `machines/migrations/0007_analysistypedefinition_contractor_actualanalysis_and_more.py`
- `REPORT_ANALYSIS_SYSTEM.md` — همین گزارش

### تغییرکرده (فقط Backend)
- `machines/models.py` — ۸ مدل جدید
- `machines/serializers.py` — سریالایزرهای جدید + افزودن `contractors` و `analysis_positions` به Factory/Line
- `machines/views.py` — ۴ ویوست/تابع‌ویوی جدید + پیش‌فرچ بهینه
- `machines/urls.py` — مسیرهای جدید
- `machines/filters.py` — `ActualAnalysisFilter`
- `machines/admin.py` — ثبت ادمین مدل‌های جدید
- `accounts/permissions.py` — دو کد دسترسی جدید: `analysis.manage` و `contractor.manage` (به کاتالوگ و پیش‌فرض نقش مدیر اضافه شد؛ در ماتریس نقش‌ها به‌صورت داینامیک نمایش داده می‌شود)

> بدون تغییر در هیچ فایل Frontend.

---

## ۱۱. مشکلات

مورد حل‌نشده‌ای باقی نمانده است.

دو نکته‌ی تصمیم‌گیری شده (مستند برای ادامه‌ی کار):
1. در Payload ثبت Actual Analysis، ارسال **کاملِ تمام موقعیت‌های دارای تعریف** الزامی نیست؛ اگر موقعیتی ارسال نشود و فرمولی به آن نیاز داشته باشد، هنگام محاسبه خطای شفاف فارسی برمی‌گردد. در صورت تمایل می‌توان این رفتار را به «الزام به ارسال همه‌ی موقعیت‌ها» سخت‌گیرانه‌تر کرد.
2. عملیات «حذف تعریف» (DELETE) به دلیل `PROTECT` روی موقعیت/خروجی‌ها در صورت وجود داده‌ی وابسته با خطای محدودیت مواجه می‌شود (رفتار امنیتی عمدی).

---

## ۱۲. لایه‌ی میانی در پنل ادمین (تکمیل)

لایه‌ی میانی که «خط تولید را به رکوردهای آنالیز واقعی وصل می‌کند» همان `LineAnalysisDefinition` است و حالا در ادمین کاملاً در دسترس است:

### الف) مدیریت تعریف‌ها از صفحه‌ی خط تولید
- در ادمین خط تولید (`machines/productionline`) اینلاین `LineAnalysisDefinition` اضافه شد: `contractor_required`، `notes` و دکمه‌ی «مدیریت ورودی‌ها و فرمول‌های خروجی».
- ستون «لایه میانی آنالیز» در لیست خطوط، لینک مستقیم به تعریف همان خط است.
- صفحه‌ی مستقل `machines/lineanalysisdefinition` با دو اینلاین:
  - `AdditionalInputDefinitionInline` (ورودی‌های اضافه)
  - `AnalysisOutputDefinitionInline` (خروجی‌ها + فیلد `formula`)

  → همان‌جاست که فرمول‌ها و ورودی‌ها/خروجی‌ها وارد می‌شوند (با اعتبارسنجی فرمول و چرخه هنگام ذخیره).

### ب) فرم داینامیک ثبت «آنالیز واقعی» در ادمین
- صفحه‌ی `machines/actualanalysis` دیگر فرم ثابت نیست؛ بر اساس `line` انتخاب‌شده:
  1. با JS (فایل استاتیک `madan_admin/js/actual_analysis_line.js`) به‌محض انتخاب خط، فرم با `?line=` دوباره بارگذاری می‌شود.
  2. فیلدهای موقعیت‌ها (`pos_<positionId>_<inputKey>`) و ورودی‌های اضافه (`add_<key>`) به‌صورت خودکار ساخته می‌شوند.
  3. لیست پیمانکار فقط به کارخانه‌ی همان خط و لیست شیفت به همان کارخانه محدود می‌شود.
  4. هنگام ذخیره، `validate_and_compute` خروجی‌ها را محاسبه می‌کند و در `outputs` (فقط‌خواندنی) نمایش داده می‌شود.
- فایل‌های مرتبط: `machines/admin.py` (کلاس `ActualAnalysisAdminForm`) + `machines/static/madan_admin/js/actual_analysis_line.js`
- تست اضافه‌شده: `AdminActualAnalysisFormTests` (ساخت فیلد + محاسبه‌ی خروجی هنگام ذخیره) — ۴۸ تست کل، همه PASS.

---

## ۱۳. اصلاحات فرمول‌نویسی، API خط‌تولید و بازه‌ی تاریخ (آخرین تغییرات)

### الف) فرمول‌ساز هوشمند در ادمین
فرمول نویسی دیگر فقط یک فیلد متنی خالی نیست؛ در اینلاین «خروجی‌ها» (`AnalysisOutputDefinitionInline`) هر فیلد `formula` یک **ویرایشگر ساختی (Formula Builder)** دارد:
- **انتخاب از ورودی‌های موجود**: دراپ‌داونِ متغیرها از خودِ خط — ورودی‌های موقعیت‌ها (`feed.fe`، `product.fe`، ...)، ورودی‌های اضافه و خودِ خروجی‌های دیگر.
- **عملگرها**: `+  -  *  /  ^  %  (  )`  و دکمه‌های **تابع** `abs, sqrt, max, min, round, if, pow, log` و **عدد** — با کلیک به فرمول اضافه می‌شوند (رابطه‌ی مثل «ورودی اول × عدد ÷ ورودی دوم»).
- **اعتبارسنجی آنی**: دکمه‌ی «اعتبارسنجی فرمول» با `POST /api/formula/validate/` (بدنه: `{line_id, expression}`) فرمول را الان چک می‌کند: نحو + وجود متغیرها در همان خط.
- پیاده‌سازی: `FormulaInputWidget` در `machines/admin.py` + فایل استاتیک `madan_admin/js/formula_builder.js`.

### ب) API خط تولید کامل
اندپوینت جدید `GET /api/production-lines/{line_id}/` همزمان برمی‌گرداند:
- **دستگاه‌ها (ماشین‌ها)**: `devices: [{id, name, code, order}]`
- کل Schema آنالیز خط: `positions` (با تعریف و ورودی‌ها)، `additional_inputs`، `outputs`، گزینه‌های `contractor` و `defined`.

و هنگام **خواندن یک Actual Analysis**، پاسخ شامل `line_devices` (ماشین‌های همان خط) به‌همراه `inputs` و `outputs` می‌شود تا فرانت تمام زمینه‌ی موردنیاز را یک‌جا داشته باشد.

### ج) بازه‌ی تاریخ برای آنالیز
- `ActualAnalysis` به‌جای `date` تکی، از `date_from` و `date_to` استفاده می‌کند (اعتبارسنجی: پایان ≥ شروع).
- **تاریخ تکی**: اگر Client فقط `date` بدهد، `date_from = date_to = date`.
- **بازه**: با `date_from` و `date_to` (مثلاً `2026-01-01` تا `2026-01-10`).
- فیلتر لیست بر اساس **هم‌پوشانی بازه‌ها** (`?date_from=...&date_to=...`): رکوردی که بازه‌اش با بازه‌ی درخواستی تلاقی دارد برمی‌گردد.
- ادمین: فیلدهای `date_from` و `date_to` با اعتبارسنجی؛ فرم داینامیک آنالیز واقعی هم بازه می‌پذیرد.

### تست‌های اضافه‌شده (`DateRangeAndDetailTests`)
- تاریخ تکی → شروع = پایان
- بازه‌ی تاریخ پذیرفته و ذخیره می‌شود
- بازه‌ی نامعتبر (پایان < شروع) رد می‌شود
- فیلتر هم‌پوشانی بازه
- جزئیات خط شامل دستگاه‌ها + ورودی‌ها + خروجی‌ها
- پاسخ Actual Analysis شامل `line_devices`
- اندپوینت اعتبارسنجی فرمول (معتبر/نامعتبر)

### فایل‌های مرتبط (بخش ۱۳)
- `machines/models.py` — `date_from/date_to` در `ActualAnalysis`
- `machines/migrations/0008_actualanalysis_date_range.py` — جدید
- `machines/serializers.py` — `line_devices` + تاریخ‌های شمسیِ بازه
- `machines/views.py` — `production_line_detail_view` + `formula_validate_view` + پردازش بازه
- `machines/urls.py` — مسیرهای جدید
- `machines/filters.py` — فیلتر هم‌پوشانی بازه
- `machines/analysis.py` — `formula_variables_for_line` و `validate_formula_for_line`
- `machines/admin.py` — `FormulaInputWidget` + فیلدهای بازه در فرم ادمین
- `machines/static/madan_admin/js/formula_builder.js` — جدید
