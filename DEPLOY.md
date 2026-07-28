# استقرار روی cPanel (Passenger)

## ۱. بیلد فرانت‌اند

```bash
cd frontend
npm install
npm run build
```

محتوای `frontend/dist/` را به `public_html` آپلود کنید.

## ۲. آپلود بک‌اند

کل پروژه (جز `frontend` و `venv`) را خارج از `public_html` آپلود کنید، مثلاً:

```
/home/user/
├── public_html/            ← dist/
└── madan-api/              ← بک‌اند
    ├── core/
    ├── machines/
    ├── accounts/
    ├── passenger_wsgi.py
    ├── requirements.txt
    └── .env
```

## ۳. تنظیم Python App در سی‌پنل

| گزینه | مقدار |
|-------|-------|
| Python version | 3.11 یا بالاتر |
| Application root | `madan-api` |
| Application URL | `https://mback.ba3tani.ir` |
| Application startup file | `passenger_wsgi.py` |
| Application Entry point | `application` |

## ۴. فایل `.env`

```ini
DJANGO_SECRET_KEY=<یک کلید تصادفی>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=mback.ba3tani.ir
CORS_ALLOWED_ORIGINS=https://madan.ba3tani.ir
CSRF_TRUSTED_ORIGINS=https://madan.ba3tani.ir,https://mback.ba3tani.ir
```

## ۵. مایگریشن و استاتیک

```bash
cd ~/madan-api
python manage.py migrate
python manage.py collectstatic --noinput
```

## ۶. ری‌استارت Passenger

تو سی‌پنل: **Setup Python App** → **Restart**

## عیب‌یابی

| مشکل | راه‌حل |
|------|--------|
| 500 Internal Server Error | لاگ Passenger را در File Manager ببینید: `madan-api/logs/` |
| 403 Forbidden | `CORS_ALLOWED_ORIGINS` و `CSRF_TRUSTED_ORIGINS` را چک کنید |
| Static files 404 | `collectstatic` را اجرا کنید |
| ModuleNotFoundError | مطمئن شوید `requirements.txt` درست است — Passenger خودکار `pip install` می‌زند |
| Database error | `DATABASE_URL` را در `.env` چک کنید |
| Passenger restart | بعد از هر تغییر در `.env` یا کد، اپ را ری‌استارت کنید |
