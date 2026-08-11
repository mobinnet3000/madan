"""ابزارهای تبدیل تاریخ میلادی به شمسی (Jalali) — بدون وابستگی خارجی.

الگوریتم هم‌خانوادهٔ jalaali-js (Jalaali algorithm)؛ با فرانت (frontend/src/utils.ts)
هم‌ریخت است تا خروجی بک‌اند و فرانت یکسان باشد.
"""
from datetime import date as py_date, datetime

# ترتیب با `date.weekday()` پایتون (دوشنبه=0 ... یکشنبه=6)
PERSIAN_WEEKDAYS = ['دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه', 'یکشنبه']

PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

G_D_M = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]


def _g2j(gy, gm, gd):
    gy2 = gy + 1 if gm > 2 else gy
    days = (
        355666
        + 365 * gy
        + (gy2 + 3) // 4
        - (gy2 + 99) // 100
        + (gy2 + 399) // 400
        + gd
        + G_D_M[gm - 1]
    )
    jy = -1595 + 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm = 1 + days // 31
        jd = (days % 31) + 1
    else:
        jm = 7 + (days - 186) // 30
        jd = (days - 186) % 30 + 1
    return jy, jm, jd


def _normalize(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        value = value.date()
    elif not isinstance(value, py_date):
        return None
    return value


def to_jalali(value):
    """date/datetime/None -> رشته شمسی YYYY/MM/DD (یا رشته خالی)."""
    value = _normalize(value)
    if value is None:
        return ''
    jy, jm, jd = _g2j(value.year, value.month, value.day)
    return f'{jy:04d}/{jm:02d}/{jd:02d}'


def to_jalali_full(value):
    """date/datetime/None -> رشته شمسی با نام ماه (مثلاً ۱۶ مرداد ۱۴۰۵)."""
    value = _normalize(value)
    if value is None:
        return ''
    jy, jm, jd = _g2j(value.year, value.month, value.day)
    return f'{jd} {PERSIAN_MONTHS[jm - 1]} {jy}'


def weekday_fa(value):
    """date/datetime/None -> نام روز هفته به فارسی."""
    value = _normalize(value)
    if value is None:
        return ''
    return PERSIAN_WEEKDAYS[value.weekday()]


def jalali_and_weekday(value):
    """date/datetime/None -> dict شامل رشته شمسی و روز هفته."""
    value = _normalize(value)
    if value is None:
        return {'date_jalali': '', 'day_of_week': ''}
    return {
        'date_jalali': to_jalali(value),
        'day_of_week': weekday_fa(value),
    }
