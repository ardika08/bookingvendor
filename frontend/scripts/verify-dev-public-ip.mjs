/**
 * Uji alur penuh aplikasi lewat IP publik (mode dev).
 * Mensimulasikan apa yang dilakukan pengguna: masuk, buka tiap halaman,
 * pastikan API mengembalikan JSON (bukan HTML), dan tidak ada error konsol.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://43.134.66.81:4173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const errors = []
const failedApi = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 160))
})
page.on('response', (r) => {
  const u = r.url()
  if (u.includes('/api/') && r.status() >= 400) {
    failedApi.push(`${r.status()} ${new URL(u).pathname}`)
  }
})

console.log('=== 1. buka /login ===')
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(2500)
console.log('   judul :', await page.title())
console.log('   h1    :', await page.locator('h1').first().textContent().catch(() => 'tidak ada'))

console.log('\n=== 2. dev login ===')
const btn = page.locator('button:has-text("Masuk sebagai vendor uji")')
console.log('   tombol ada:', await btn.count())
await btn.first().click()
await page.waitForTimeout(4500)
console.log('   URL   :', new URL(page.url()).pathname)

const me = await page.evaluate(async () => {
  const r = await fetch('/api/me', { credentials: 'include' })
  return { status: r.status, body: r.ok ? await r.json() : null }
})
console.log('   /api/me:', me.status, me.body ? `${me.body.name} (${me.body.role})` : '')

console.log('\n=== 3. jelajahi halaman ===')
const pages = ['/dashboard', '/bookings', '/invoices', '/clients', '/packages', '/calendar', '/settings']
for (const p of pages) {
  await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(1600)
  const path = new URL(page.url()).pathname
  const h1 = await page.locator('h1').first().textContent().catch(() => null)
  const title = await page.title()
  const ok = path === p ? 'OK  ' : `REDIR->${path}`
  console.log(`   ${ok} ${p.padEnd(12)} h1=${(h1 || '-').slice(0, 28).padEnd(30)} title=${title.slice(0, 30)}`)
}

console.log('\n=== 4. detail booking ===')
await page.goto(`${BASE}/bookings`, { waitUntil: 'domcontentloaded', timeout: 25000 })
await page.waitForTimeout(2000)
const linkCount = await page.locator('a[href^="/bookings/"]').count()
console.log('   tautan booking:', linkCount)
if (linkCount > 0) {
  await page.locator('a[href^="/bookings/"]').first().click()
  await page.waitForTimeout(2500)
  console.log('   URL   :', new URL(page.url()).pathname)
  console.log('   h1    :', await page.locator('h1').first().textContent().catch(() => 'tidak ada'))
  console.log('   judul :', await page.title())
}

console.log('\n=== 5. API yang gagal ===')
if (failedApi.length === 0) console.log('   tidak ada')
else [...new Set(failedApi)].forEach((f) => console.log('   ' + f))

console.log('\n=== 6. error konsol ===')
if (errors.length === 0) console.log('   tidak ada')
else [...new Set(errors)].slice(0, 6).forEach((e) => console.log('   ' + e))

await browser.close()
