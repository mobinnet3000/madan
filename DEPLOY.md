# راهنمای استقرار روی cPanel

## پیش‌نیازها
- cPanel با قابلیت **Setup Python App** (بیشتر هاست‌های سی‌پنل دارند)
- دسترسی **File Manager** یا **FTP**
- بدون نیاز به SSH/ترمینال

## مرحله ۱ — بیلد فرانت‌اند (روی سیستم خودت)

```bash
# توی کامپیوتر خودت اجرا کن
cd frontend
npm install
npm run build
```

فولدر `frontend/dist/` ساخته می‌شه — محتواش رو آپلود می‌کنی.

## مرحله ۲ — آپلود فایل‌ها به سی‌پنل

ساختار نهایی روی هاست:

```
/home/user/
├── public_html/                 # ← محتویات frontend/dist/
│   ├── assets/
│   │   ├── index-xxxxx.js
│   │   └── index-xxxxx.css
│   ├── fonts/                   # ← فونت وزیر برای PDF
│   │   ├── Vazirmatn-FD-Regular.ttf
│   │   └── Vazirmatn-FD-Bold.ttf
│   ├── index.html
│   └── .htaccess                # ← از روت پروژه کپی کن
│
└── madan-api/                   # ← کل پروژه Django (بدون public_html)
    ├── core/
    ├── machines/
    ├── accounts/
    ├── manage.py
    ├── passenger_wsgi.py
    ├── requirements.txt
    ├── .env
    └── db.sqlite3               (اگر دیتا داری)
```

## مرحله ۳ — تنظیم Python App در سی‌پنل

1. وارد cPanel بشو
2. بخش **Setup Python App** رو پیدا کن (دنبال "Python" بگرد)
3. دکمه **CREATE APPLICATION** رو بزن
4. تنظیمات:
   - **Python version**: 3.11 یا بالاتر
   - **Application root**: `madan-api` (مسیر پوشه بک‌اند)
   - **Application URL**: مثلاً `api.yourdomain.com` یا `yourdomain.com/madan-api`
   - **Application startup file**: `passenger_wsgi.py`
   - **Application Entry point**: `application`
   - **Environment variables**: رو می‌تونی از روی `.env` پر کنی
5. دکمه **CREATE** رو بزن
6. cPanel خودکار:
   - میاد یه venv می‌سازه
   - `pip install -r requirements.txt` رو اجرا می‌کنه
   - Passenger رو برای سرو کردن Django راه‌اندازی می‌کنه

## مرحله ۴ — تنظیمات دامنه

اگه بک‌اند رو روی یه ساب‌دامین مثل `api.yourdomain.com` گذاشتی:

1. تو cPanel برو به **Subdomains**
2. یه ساب‌دامین مثل `api` برای دامنه اصلیت بساز
3. تو **Setup Python App** این ساب‌دامین رو به اپلیکیشن وصل کن

## مرحله ۵ — آپدیت فرانت‌اند برای ارتباط با بک‌اند

قبل از بیلد فرانت‌اند، تو فایل `frontend/.env` (یا مستقیماً توی کد) آدرس API رو عوض کن:

```
VITE_API_BASE_URL=https://api.yourdomain.com
```

یا اگه قرار نیست عوض بشه، فایل `frontend/src/api/client.ts` رو ویرایش کن:

```typescript
export const api = axios.create({
  baseURL: 'https://api.yourdomain.com/api',
  ...
})
```

سپس دوباره `npm run build` کن و محتوای `dist/` رو آپلود کن.

## مرحله ۶ — مایگریشن و دیتا

cPanel توی Setup Python App یه دکمه **Run Terminal Command** داره که می‌تونی باهاش دستورات محدود رو اجرا کنی:

```bash
cd ~/madan-api
python manage.py migrate
python manage.py collectstatic --noinput
```

اگه این دکمه رو نداری:
- فایل `db.sqlite3` رو از لوکال (با دیتای seed شده) مستقیم آپلود کن
- `python manage.py collectstatic` رو لوکال اجرا کن و `staticfiles/` رو آپلود کن

## نکات مهم

| مورد | توضیح |
|------|-------|
| **Secret Key** | تو `.env` یه کلید جدید بذار (با `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`) |
| **Debug=False** | حتماً `DJANGO_DEBUG=False` تو `.env` |
| **CORS** | تو `.env` آدرس فرانت‌اند رو بذار: `CORS_ALLOWED_ORIGINS=https://yourdomain.com` |
| **Static Files** | بعد از `collectstatic` فولدر `staticfiles/` رو آپلود کن و تو settings.py مسیرش رو تنظیم کن |
| **Database** | SQLite برای شروع خوبه. برای حجم بالا از MySQL (داخل سی‌پنل) استفاده کن: `DATABASE_URL=mysql://user:pass@localhost/dbname` |
| **Media Files** | عکس‌ها و فایل‌های آپلودی کاربران توی `media/` ذخیره می‌شن |
