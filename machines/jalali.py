"""ابزارهای تبدیل تاریخ میلادی به شمسی (Jalali)."""
from jdatetime import date as jdate

# ترتیب با `date.weekday()` پایتون (دوشنبه=0 ... یکشنبه=6)
PERSIAN_WEEKDAYS = ['دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه', 'یکشنبه']

PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']


def to_jalali(value):
    """date/datetime/None -> رشته شمسی YYYY/MM/DD (یا رشته خالی)."""
    if value is None:
        return ''
    if hasattr(value, 'date'):
        value = value.date()
    j = jdate.fromgregorian(year=value.year, month=value.month, day=value.day)
    return j.strftime('%Y/%m/%d')


def to_jalali_full(value):
    """date/datetime/None -> رشته شمسی با نام ماه (مثلاً ۱۶ مرداد ۱۴۰۵)."""
    if value is None:
        return ''
    if hasattr(value, 'date'):
        value = value.date()
    j = jdate.fromgregorian(year=value.year, month=value.month, day=value.day)
    return f'{j.day} {PERSIAN_MONTHS[j.month - 1]} {j.year}'


def weekday_fa(value):
    """date/datetime/None -> نام روز هفته به فارسی."""
    if value is None:
        return ''
    if hasattr(value, 'date'):
        value = value.date()
    return PERSIAN_WEEKDAYS[value.weekday()]


def jalali_and_weekday(value):
    """date/datetime/None -> dict شامل رشته شمسی و روز هفته."""
    if value is None:
        return {'date_jalali': '', 'day_of_week': ''}
    if hasattr(value, 'date'):
        value = value.date()
    return {
        'date_jalali': to_jalali(value),
        'day_of_week': weekday_fa(value),
    }
