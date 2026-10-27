/**
 * Uji logika aturan rewrite di deploy/cpanel/.htaccess tanpa Apache.
 *
 * Tujuannya memastikan urutan aturan benar: /api dan /auth HARUS ditangani
 * Laravel (index.php), bukan tertangkap aturan SPA. Kesalahan di sini
 * menghasilkan frontend menerima HTML alih-alih JSON — gejalanya "JSON parse
 * error" yang sulit dilacak.
 *
 * Pemakaian: node deploy/test-htaccess.mjs
 */

import { readFileSync } from 'node:fs'

const htaccess = readFileSync(new URL('./cpanel/.htaccess', import.meta.url), 'utf8')

// Aturan 1 dari .htaccess
const API_RULE = /^(api|auth)(\/.*)?$/

// Berkas yang benar-benar ada di public_html saat deploy.
const FILES_ON_DISK = new Set([
  '/index.html',
  '/index.php',
  '/.htaccess',
  '/assets/index-94rumY3z.js',
  '/assets/browser-BSPgRa7e.js',
  '/assets/index-abc123.css',
  '/fonts/Poppins-Regular.woff2',
  '/favicon.svg',
  '/icons.svg',
])

/**
 * Simulasikan Apache: kembalikan tujuan request.
 * @param {string} pathname
 * @returns {'laravel'|'static'|'spa'}
 */
function route(pathname) {
  const clean = pathname.replace(/^\//, '')

  // Aturan 1: /api & /auth -> index.php
  if (API_RULE.test(clean)) return 'laravel'

  // Aturan 2: berkas nyata -> disajikan apa adanya
  if (FILES_ON_DISK.has(pathname)) return 'static'

  // Aturan 3: sisanya -> index.html (React Router)
  return 'spa'
}

const cases = [
  // --- Laravel (JSON / redirect) ---
  ['/api/me', 'laravel', 'endpoint sesi'],
  ['/api/bookings', 'laravel', 'data booking'],
  ['/api/bookings/18', 'laravel', 'detail booking'],
  ['/api/webhooks/duitku', 'laravel', 'callback pembayaran'],
  ['/api/admin/vendors', 'laravel', 'panel admin'],
  ['/auth/google/redirect', 'laravel', 'mulai OAuth'],
  ['/auth/google/callback', 'laravel', 'callback OAuth'],
  ['/auth/dev-login', 'laravel', 'login dev'],
  ['/auth/logout', 'laravel', 'keluar'],

  // --- Statis ---
  ['/index.html', 'static', 'SPA shell'],
  ['/assets/index-94rumY3z.js', 'static', 'bundle JS'],
  ['/assets/index-abc123.css', 'static', 'stylesheet'],
  ['/fonts/Poppins-Regular.woff2', 'static', 'font self-host'],
  ['/favicon.svg', 'static', 'ikon'],
  ['/icons.svg', 'static', 'sprite ikon'],

  // --- SPA (React Router) ---
  ['/login', 'spa', 'halaman masuk'],
  ['/dashboard', 'spa', 'dashboard'],
  ['/bookings', 'spa', 'daftar booking'],
  ['/bookings/18', 'spa', 'detail booking'],
  ['/settings', 'spa', 'profil vendor'],
  ['/admin', 'spa', 'panel admin'],
  ['/jadwal/vendor-uji', 'spa', 'jadwal publik'],
  ['/invoice/TOKEN123', 'spa', 'invoice publik'],

  // --- Jalur yang mirip tapi BUKAN api/auth ---
  ['/apix', 'spa', 'bukan /api (harus SPA)'],
  ['/authentication', 'spa', 'bukan /auth (harus SPA)'],
  ['/api-docs', 'spa', 'bukan /api/ (harus SPA)'],
]

let pass = 0
const failures = []

for (const [path, expected, note] of cases) {
  const got = route(path)
  if (got === expected) {
    pass++
  } else {
    failures.push(`${path} -> ${got} (diharapkan ${expected}) — ${note}`)
  }
}

console.log(`KASUS: ${cases.length} | LULUS: ${pass} | GAGAL: ${failures.length}`)
if (failures.length) {
  console.log('\nKEGAGALAN:')
  for (const f of failures) console.log('  - ' + f)
  process.exitCode = 1
} else {
  console.log('Semua path diarahkan ke penangan yang benar.')
}
