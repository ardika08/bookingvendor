/**
 * Mengukur ukuran ikon TERHITUNG (bukan atribut) untuk mendeteksi regresi visual.
 *
 * HugeiconsIcon selalu menulis width/height="24" di SVG. CSS `size-4` seharusnya
 * mengalahkan atribut itu, tapi itu harus DIBUKTIKAN, bukan diasumsikan: kalau
 * CSS kalah, semua ikon membesar dari 16px ke 24px tanpa terlihat di atribut.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:4173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
const btn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
if (await btn.count()) await btn.first().click()
await page.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(1500)

for (const path of ['/dashboard', '/bookings', '/calendar']) {
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1200)

  const r = await page.evaluate(() => {
    const out = {}
    for (const s of document.querySelectorAll('svg')) {
      if (s.getAttribute('viewBox') !== '0 0 24 24') continue
      const cs = getComputedStyle(s)
      const key = `${Math.round(parseFloat(cs.width))}x${Math.round(parseFloat(cs.height))}`
      out[key] = (out[key] || 0) + 1
    }
    return { ukuranTerhitung: out, path: location.pathname }
  })
  console.log(`${path.padEnd(12)} -> ukuran terhitung: ${JSON.stringify(r.ukuranTerhitung)}`)
}

await browser.close()
