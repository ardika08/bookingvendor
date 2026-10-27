/**
 * Uji login admin lewat IP publik.
 * Memastikan tombol admin benar-benar membuat sesi server dan mendarat di
 * /admin — bukan hanya menulis role ke localStorage seperti sebelumnya.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://43.134.66.81:4173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const errors = []
const failed = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 140))
})
page.on('response', (r) => {
  const u = r.url()
  if (u.includes('/api/') && r.status() >= 400) failed.push(`${r.status()} ${new URL(u).pathname}`)
})

console.log('=== 1. buka /login ===')
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(2200)

const vendorBtn = page.locator('button:has-text("Masuk sebagai vendor uji")')
const adminBtn = page.locator('button:has-text("Masuk sebagai admin uji")')
console.log('   tombol vendor:', await vendorBtn.count())
console.log('   tombol admin :', await adminBtn.count())

console.log('\n=== 2. klik "Masuk sebagai admin uji" ===')
await adminBtn.first().click()
await page.waitForTimeout(5000)
console.log('   URL   :', new URL(page.url()).pathname)

const me = await page.evaluate(async () => {
  const r = await fetch('/api/me', { credentials: 'include' })
  return { status: r.status, body: r.ok ? await r.json() : null }
})
console.log('   /api/me:', me.status, me.body ? `${me.body.email} role=${me.body.role}` : '(gagal)')

console.log('\n=== 3. halaman admin ===')
for (const p of ['/admin', '/admin/vendors', '/admin/plans']) {
  await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(1800)
  const path = new URL(page.url()).pathname
  const h1 = await page.locator('h1').first().textContent().catch(() => null)
  const title = await page.title()
  const status = path === p ? 'OK  ' : `REDIR->${path}`
  console.log(`   ${status} ${p.padEnd(16)} h1=${(h1 || '-').slice(0, 26).padEnd(28)} ${title.slice(0, 26)}`)
}

console.log('\n=== 4. apakah admin bisa membuka dashboard vendor? (harus dialihkan) ===')
await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.waitForTimeout(2000)
console.log('   /dashboard ->', new URL(page.url()).pathname)

console.log('\n=== 5. API gagal ===')
console.log(failed.length === 0 ? '   tidak ada' : [...new Set(failed)].map((f) => '   ' + f).join('\n'))

console.log('\n=== 6. error konsol ===')
console.log(errors.length === 0 ? '   tidak ada' : [...new Set(errors)].slice(0, 5).map((e) => '   ' + e).join('\n'))

await browser.close()
