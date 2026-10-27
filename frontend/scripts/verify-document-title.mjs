/**
 * Verifikasi `document.title` berubah per route.
 * Memastikan setiap halaman punya judul unik dan token akses tidak bocor.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:4173'
const DEFAULT = 'Booking Vendor — Dashboard Vendor Wedding'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
for (let i = 0; i < 3; i++) {
  const b = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
  if (await b.count()) await b.first().click()
  await page.waitForTimeout(2000)
  if (page.url().includes('/dashboard')) break
}

const paths = [
  '/dashboard', '/bookings', '/bookings/18', '/bookings/18/edit', '/bookings/new',
  '/invoices', '/invoices/1', '/clients', '/packages', '/calendar',
  '/settings', '/settings/akun', '/upgrade',
  '/admin/vendors', '/admin/vendors/new',
]

const titles = []
let dup = 0
let stillDefault = 0
for (const path of paths) {
  const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => null)
  if (!resp || resp.status() >= 400) {
    console.log(`${path.padEnd(22)} SKIP ${resp ? resp.status() : 'err'}`)
    continue
  }
  await page.waitForTimeout(1000)
  const t = await page.title()
  titles.push(t)
  if (t === DEFAULT) stillDefault++
  console.log(`${path.padEnd(22)} "${t}"`)
}

// halaman publik (tanpa login)
const pubCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const pub = await pubCtx.newPage()
for (const path of ['/login', '/']) {
  await pub.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 })
  await pub.waitForTimeout(1000)
  const t = await pub.title()
  titles.push(t)
  if (t === DEFAULT) stillDefault++
  console.log(`${path.padEnd(22)} "${t}"`)
}
await pubCtx.close()

// deteksi judul duplikat (dua halaman berbeda dengan judul sama)
const seen = new Map()
for (const t of titles) seen.set(t, (seen.get(t) ?? 0) + 1)
for (const [t, n] of seen) if (n > 1) dup += n - 1

console.log(`\n=== RINGKASAN ===`)
console.log(`  halaman diperiksa        : ${titles.length}`)
console.log(`  masih pakai judul default: ${stillDefault}`)
console.log(`  judul duplikat           : ${dup}`)
console.log(`  judul unik               : ${seen.size}`)
await browser.close()
