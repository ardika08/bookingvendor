/**
 * Verifikasi struktur heading di SEMUA halaman yang bisa diakses.
 * Tujuan: tidak ada halaman tanpa <h1>, dan tidak ada <h1> ganda.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:4173'
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
  '/invoices', '/invoices/1', '/clients', '/clients/1', '/packages',
  '/calendar', '/settings', '/settings/akun', '/upgrade',
  '/admin/vendors', '/admin/vendors/new',
]

let bad = 0
for (const path of paths) {
  const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => null)
  if (!resp || resp.status() >= 400) {
    console.log(`${path.padEnd(20)} SKIP (${resp ? resp.status() : 'err'})`)
    continue
  }
  await page.waitForTimeout(1200)
  const r = await page.evaluate(() => {
    const h1 = [...document.querySelectorAll('h1')].map((e) => e.textContent.trim().replace(/\s+/g, ' '))
    return { h1, title: document.title }
  })
  const ok = r.h1.length === 1
  if (!ok) bad++
  console.log(`${path.padEnd(20)} h1=${r.h1.length} ${ok ? 'OK ' : 'MASALAH'} ${JSON.stringify(r.h1)}`)
}

// halaman publik (tanpa login)
const pubCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const pub = await pubCtx.newPage()
for (const path of ['/login', '/']) {
  await pub.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 })
  await pub.waitForTimeout(1200)
  const r = await pub.evaluate(() => [...document.querySelectorAll('h1')].map((e) => e.textContent.trim().replace(/\s+/g, ' ')))
  const ok = r.length === 1
  if (!ok) bad++
  console.log(`${path.padEnd(20)} h1=${r.length} ${ok ? 'OK ' : 'MASALAH'} ${JSON.stringify(r)}`)
}
await pubCtx.close()

console.log(`\n=== HALAMAN BERMASALAH: ${bad} ===`)
await browser.close()
