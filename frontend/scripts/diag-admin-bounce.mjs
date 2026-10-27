/**
 * Reproduksi: apa yang terjadi saat membuka /admin.
 * Merekam URL, judul, dan role yang dikembalikan /api/me pada setiap langkah.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:4173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const log = []
page.on('framenavigated', (f) => {
  if (f === page.mainFrame()) log.push(`NAV  -> ${new URL(f.url()).pathname}`)
})

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(800)

// Klik dev login
const btn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
console.log('tombol dev login ada:', await btn.count())
await btn.first().click()
await page.waitForTimeout(3500)

console.log('setelah dev login, URL:', new URL(page.url()).pathname)

// Role yang tersimpan
const role = await page.evaluate(() => localStorage.getItem('booking-vendor:auth-role'))
console.log('role di localStorage :', role)

// Siapa saya menurut server
const me = await page.evaluate(async () => {
  const r = await fetch('/api/me', { credentials: 'include' })
  if (!r.ok) return { status: r.status }
  const j = await r.json()
  return { status: r.status, name: j.name, email: j.email, role: j.role }
})
console.log('/api/me              :', JSON.stringify(me))

// Sekarang coba buka panel admin
console.log('\n--- membuka /admin ---')
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(3500)
console.log('URL akhir setelah /admin:', new URL(page.url()).pathname)
console.log('judul dokumen           :', await page.title())

const role2 = await page.evaluate(() => localStorage.getItem('booking-vendor:auth-role'))
console.log('role di localStorage    :', role2)

console.log('\n--- jejak navigasi ---')
for (const l of log) console.log(' ', l)

await browser.close()
