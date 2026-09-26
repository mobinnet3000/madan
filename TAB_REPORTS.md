# گزارش‌های تب کارخانه (Backend) — راهنمای Config و Render

فرانت فعلا KPI/جدول/نمودار هر تب را لوکال (recharts) حساب می‌کند. این سیستم همان منطق را
Generic به Backend می‌آورد: `FactoryTabReport` + `FactoryTabWidget` → موتور `tab_reports.py`.

## داده‌ها

- منبع: فقط رکوردهای همان `FactoryTab` (`FactoryTabRecord`).
- فیلد عددی: `out.<key>` (خروجی‌های تب) و `in.<key>` (ورودی‌های عددی).
- ورودی متنی/انتخابی: فقط `in.<key>` برای گروه‌بندی `field_value`.
- فرمول‌های خود تب (خروجی‌ها) هنگام ثبت رکورد محاسبه شده‌اند؛ گزارش روی مقادیر ذخیره‌شده Aggregate می‌کند.

## گزارش

- `GET /api/factory-tab-reports/?tab=<id>` — لیست گزارش‌های تب.
- `POST /api/factory-tab-reports/` — ساخت (`tab`, `name`, `filters?`, `metrics?`؛ بقیه optional).
- فیلترهای مجاز (`filters`): زیرمجموعه `["line","contractor","date_from","date_to"]`؛ خالی = همه.
- متریک‌ها (`metrics`): لیست `{key,label?,formula,unit?}`؛ فرمول با موتور امن `formula.py`.
  متغیر مجاز: `out.<k>__sum|avg|min|max|count` ، `in.<k>__<stat>` ، `record_count` ، کلید متریک دیگر.
  مثال: `{"key":"recovery","label":"بازیابی وزنی","formula":"in.product__sum / in.feed__sum * 100"}`
  تقسیم بر صفر/NaN → مقدار `null` + پیام `error` همان متریک (بقیه گزارش می‌آید).

## اجرا

- `GET /api/factory-tab-reports/<id>/run/?line=&contractor=&date_from=&date_to=`
  - `line` تکی یا `lines=1,2`؛ `date_*` فرمت `YYYY-MM-DD`.
  - سقف ۱۰۰۰۰ رکورد (`REPORT_MAX_RECORDS`)؛ بیشتر → خطای 400 با پیام محدودسازی بازه.
- پاسخ:
```json
{
  "report": {"id": 1, "name": "گزارش جامع", "tab": {"id": 2, "key": "custom-tab", "name": "تب سفارشی"}},
  "filters_applied": {"line": "3"},
  "record_count": 4,
  "metrics": [{"key": "recovery", "label": "بازیابی وزنی", "unit": "", "value": 52.0, "error": null}],
  "widgets": [{"id": 5, "type": "kpi", "title": "شاخص‌ها", "data": {...}}],
  "meta": {"engine": "tab_reports/1", "generated_at": "...", "max_records": 10000, "widget_types": ["chart","group_table","kpi","stat_table"]}
}
```

## ویجت‌ها (`GET /api/factory-tab-reports/types/`)

### kpi — کارت‌های شاخص
```json
{"cards": [
  {"kind": "count", "label": "تعداد رکورد"},
  {"kind": "stat", "field": "in.feed", "stat": "sum", "label": "جمع خوراک", "sub_stats": ["avg","min","max"]},
  {"kind": "metric", "metric": "recovery", "label": "بازیابی وزنی"}
]}
```
- `stat` یکی از `sum/avg/min/max/count`؛ `sub_stats` زیرمجموعه همان‌ها. خروجی: `cards[]={label,value,sub}`.

### stat_table — آمار هر فیلد (جدول «آمار کلی هر پارامتر» فرانت)
```json
{"sources": ["out","in"], "fields": ["in.feed","out.recovery"], "stats": ["sum","avg","min","max","count"]}
```
- `fields` خالی نگذارید مگر این‌که `sources` کافی باشد (پیش‌فرض: همه عددی‌های همان sources، حداکثر ۵۰).
- خروجی: `columns=[field,label,...stats]` + `rows[]`.

### group_table — جدول تفکیک (خط/پیمانکار/روز/هفته/ماه/ساعت/مقدار فیلد)
```json
{"group_by": "line", "fields": ["in.feed"], "stats": ["sum","avg"],
 "sort": "count_desc", "limit": 50, "include_total": true}
```
- `group_by`: `line|contractor|date|week|month|hour|field_value`؛ برای `field_value` حتما `field` بدهید.
- `sort`: `count_desc|label_asc|value_desc` (برای `value_desc` حتما `sort_field`+`sort_stat`).
- خروجی: `columns=[label,count,<field>__<stat>...]` + `rows[]` + `total` (ردیف «جمع کل»).

### chart — نمودار (bar/line/pie)
```json
{"chart": "line", "group_by": "date", "value": {"field": "in.feed","stat": "sum"}, "sort": "label_asc", "limit": 12}
```
- `value`: `"count"` یا `{"field","stat"}`. خروجی: `points[]={x,label,value}` آماده `recharts`:
  `bar/line` → `<Bar|Line dataKey="value"/>` ، `pie` → `<Pie dataKey="value" nameKey="label"/>`.
- معادل‌های فرانت: `group_by=date|week|month` + `value=sum` همان نمودارهای روزانه/هفتگی/ماهانه؛
  `group_by=contractor|line|hour` + `value=count` همان Pie پیمانکار/توزیع ساعتی.

## افزودن ویجت جدید (بدون دست‌کاری موتور اصلی)

1. در `tab_reports.py` دو تابع بنویسید: `_validate_<name>(tab, config, metric_keys)` و `_run_<name>(rows, ctx, config)`.
2. به `WIDGET_TYPES` اضافه کنید: `"my_widget": {"label": "...", "validate": ..., "run": ...}`.
3. ورودی `run`: `rows` (سطرهای نرمال‌شده همان تب)، `ctx={record_count,labels,metrics}`.
4. خروجی `run`: دیکشنری JSON-serializable که فرانت مستقیم رندر می‌کند.

`rows` هر رکورد: `{id,date,date_label(جلالی),week(YYYY-Www),month,hour(HH:00),line,line_id,contractor,contractor_id,out{},in_num{},cat{}}`.

## پرمیژن/اسکوپ

- همه endpointها `factory-tabs.view`؛ ساخت/ویرایش/حذف گزارش و ویجت `factory-tabs.manage`
  (همان پرمیژن مدیریت تب — گزارش بخشی از تب است، پرمیژن جدا اضافه نشد).
- اسکوپ کارخانه کاربر در همه queryها اعمال می‌شود؛ گزارش تب کارخانه دیگر دیده/اجرا نمی‌شود.

## نمونه واقعی

`machines/test_tab_reports.py::_seed_report` تب `feed/product` با ۴ رکورد روی دو خط و
گزارش «جامع» (KPI + آمار + تفکیک خط + روند روزانه + متریک recovery) را می‌سازد —
همان سناریو را از API هم می‌توانید تکرار کنید (ابتدا تب، بعد گزارش، بعد ویجت‌ها، بعد `run`).
