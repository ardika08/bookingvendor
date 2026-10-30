import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const BACKEND_ORIGIN = process.env.VITE_BACKEND_ORIGIN ?? 'http://127.0.0.1:8082'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Semua request /api dan /auth diteruskan ke backend Laravel.
      // Cookie sesi Laravel (guard web) otomatis dibawa karena same-origin
      // lewat proxy — tidak perlu CORS atau credentials: include.
      '/api': {
        target: BACKEND_ORIGIN,
        changeOrigin: true,
      },
      '/auth': {
        target: BACKEND_ORIGIN,
        changeOrigin: true,
      },
      /*
       * Endpoint CSRF Sanctum. Tanpa proxy ini, `/sanctum/csrf-cookie` jatuh
       * ke Vite dan tidak pernah sampai ke Laravel, sehingga cookie
       * `XSRF-TOKEN` tidak pernah dibuat. Akibatnya POST pertama dari halaman
       * publik (pendaftaran) dijawab 419 CSRF token mismatch.
       */
      '/sanctum': {
        target: BACKEND_ORIGIN,
        changeOrigin: true,
      },
    },
  },
})
