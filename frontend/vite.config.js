import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// پروکسی درخواست‌های /api به بک‌اند Django (پورت 8000)
// با این کار نیازی به CORS در زمان توسعه نیست.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        host: '0.0.0.0',
        allowedHosts: true,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
            },
            '/media': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
    },
});
