# استقرار روی cPanel (Passenger)

## ساختار پروژه

```
madan/
├── backend/               # Django + DRF
│   ├── core/              # settings, urls, wsgi
│   ├── accounts/          # کاربران، نقش‌ها
│   ├── machines/          # مدل‌ها، APIهای اصلی
│   ├── templates/         # admin templates
│   ├── media/             # تصاویر دستگاه‌ها (gitignore، روی هاست می‌ماند)
│   ├── db.sqlite3         # تحویل با git — روی هاست overwrite نمی‌شود مگر migrate
│   ├── manage.py
│   ├── passenger_wsgi.py  # entry point سی‌پنل
│   └── requirements.txt
├── frontend/              # React + Vite
│   ├── src/
│   ├── dist/              # بعد build — کپی به public_html
│   ├── .htaccess          # SPA fallback — همراه dist به public_html می‌رود
│   └── package.json
├── .env.example           # نمونه — کپی کن به backend/.env و مقدار بده
└── DEPLOY.md
```

## ۱. بیلد فرانت‌اند

```bash
cd frontend
npm install
npm run build
```

محتوای `frontend/dist/` **+** فایل `frontend/.htaccess` را به `public_html` آپلود کنید.

> نکته: اگر `dist` خالی آپلود شود، صفحه سفید + 404 می‌دهد — `.htaccess` ضروری است.

## ۲. آپلود بک‌اند

کل پوشه‌ی `backend/` را خارج از `public_html` آپلود کنید:

```
/home/bataniir/
├── public_html/           ← frontend/dist + .htaccess
└── backend/               ← بک‌اند (این ریپازیتوری)
    ├── core/
    ├── machines/
    ├── accounts/
    ├── passenger_wsgi.py
    ├── requirements.txt
    ├── db.sqlite3
    └── .env
```

## ۳. تنظیم Python App در سی‌پنل

| گزینه | مقدار |
|-------|-------|
| Python version | 3.11 یا بالاتر |
| Application root | `backend` |
| Application URL | `https://mback.ba3tani.ir` |
| Application startup file | `passenger_wsgi.py` |
| Application Entry point | `application` |

`passenger_wsgi.py` به صورت خودکار `backend/` را به `sys.path` اضافه می‌کند.

## ۴. فایل `.env`

در `backend/.env` قرار می‌گیرد (نمونه در `backend/.env.example`):

```ini
DJANGO_SECRET_KEY=<یک کلید تصادفی طولانی>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=mback.ba3tani.ir,madan.ba3tani.ir
CORS_ALLOWED_ORIGINS=https://madan.ba3tani.ir
CORS_ALLOW_CREDENTIALS=True
CSRF_TRUSTED_ORIGINS=https://madan.ba3tani.ir,https://mback.ba3tani.ir
DJANGO_SECURE_SSL_REDIRECT=True
# DATABASE_URL=sqlite:///db.sqlite3
# DATABASE_URL=mysql://user:pass@localhost/dbname
```

تولید کلید:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## ۵. مایگریشن و استاتیک

```bash
cd ~/backend
python manage.py migrate
python manage.py collectstatic --noinput
```

## ۶. ری‌استارت Passenger

سی‌پنل → **Setup Python App** → **Restart**

## عیب‌یابی

| مشکل | راه‌حل |
|------|--------|
| 500 Internal Server Error | لاگ را ببینید: `backend/logs/madan.log` |
| 403 Forbidden | `CORS_ALLOWED_ORIGINS` و `CSRF_TRUSTED_ORIGINS` را چک کنید |
| Static files 404 | `collectstatic` را اجرا کنید |
| ModuleNotFoundError | `requirements.txt` را چک کنید — Passenger خودکار `pip install` می‌زند |
| Database error | `DATABASE_URL` را در `backend/.env` چک کنید |
| Passenger restart | بعد از هر تغییر در `.env` یا کد، اپ را ری‌استارت کنید |
| صفحه سفید فرانت | `.htaccess` در `public_html` هست؟ `VITE_API_BASE_URL` درست است؟ |

## به‌روزرسانی بعدی

```bash
git pull
cd frontend && npm run build   # سپس dist را به public_html کپی کن
# اگر مدل تغییر کرده:
python backend/manage.py migrate
python backend/manage.py collectstatic --noinput
# سپس Restart در سی‌پنل
```

## نکته دیتابیس

`backend/db.sqlite3` در git هست تا هاست اولیه خالی نباشد.
برای MySQL روی هاست، فقط `DATABASE_URL=mysql://...` را در `backend/.env` ست کن — SQLite نادیده گرفته می‌شود.
