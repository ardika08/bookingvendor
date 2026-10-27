/**
 * Memeriksa konsistensi ketebalan garis ikon.
 *
 * Hugeicons merancang tiap ikon dengan stroke-width 1.5, tapi beberapa ikon bisa
 * membawa nilai berbeda. Kalau bercampur dalam satu kelompok (mis. sidebar),
 * hasilnya terlihat tidak rata meski semuanya "garis tipis".
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
await page.waitForTimeout(1800)

for (const path of ['/dashboard', '/bookings', '/invoices', '/calendar']) {
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1200)

  const r = await page.evaluate(() => {
    const dist = {}
    const anomali = []
    for (const s of document.querySelectorAll('svg[viewBox="0 0 24 24"]')) {
      const paths = [...s.querySelectorAll('path,circle,rect,line,polyline')]
      if (!paths.length) continue
      const widths = [...new Set(paths.map((p) => p.getAttribute('stroke-width')).filter(Boolean))]
      const key = widths.join('|') || '(tidak ada)'
      dist[key] = (dist[key] || 0) + 1
      if (widths.length > 1) anomali.push(widths)
    }
    return { dist, anomali, url: location.pathname }
  })

  console.log(`${path.padEnd(12)} url=${r.url.padEnd(12)} stroke=${JSON.stringify(r.dist)}`)
  if (r.anomali.length) console.log(`   campur dalam satu ikon: ${JSON.stringify(r.anomali)}`)
}

await browser.close()
