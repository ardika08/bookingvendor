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
      /*
       * Berkas publik yang diunggah vendor (logo usaha) dan apa pun yang
       * dilayani Laravel lewat symlink `public/storage`. Tanpa proxy ini,
       * request `/storage/...` dijawab server statis Vite dengan halaman
       * index.html (SPA fallback), sehingga `<img src>` gagal memuat dan
       * tampak sebagai gambar rusak — padahal berkasnya ada di backend.
       *
       * Hanya relevan untuk dev: di produksi API dan frontend dilayani dari
       * origin yang sama, jadi `/storage/...` sudah benar tanpa proxy.
       */
      '/storage': {
        target: BACKEND_ORIGIN,
        changeOrigin: true,
      },
    },
  },
})
