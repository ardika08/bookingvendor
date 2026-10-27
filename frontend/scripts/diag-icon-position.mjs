/**
 * Mengukur posisi ikon di sidebar dashboard (yang paling sering dilihat).
 * Fokus: apakah koordinat x/y jatuh di piksel bulat atau pecahan.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:4173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
for (let i = 0; i < 3; i++) {
  const btn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
  if (await btn.count()) await btn.first().click()
  await page.waitForURL('**/dashboard', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1500)
  if (page.url().includes('/dashboard')) break
}

const r = await page.evaluate(() => {
  const rows = []
  for (const s of document.querySelectorAll('svg[viewBox="0 0 24 24"]')) {
    const rect = s.getBoundingClientRect()
    const cs = getComputedStyle(s)
    rows.push({
      size: Math.round(parseFloat(cs.width) * 100) / 100,
      x: Math.round(rect.x * 100) / 100,
      y: Math.round(rect.y * 100) / 100,
      fracX: Math.round((rect.x % 1) * 100) / 100,
      fracY: Math.round((rect.y % 1) * 100) / 100,
      inSidebar: !!s.closest('aside'),
    })
  }
  return rows
})

console.log(`Total ikon: ${r.length}`)
const bulat = r.filter((x) => x.fracX === 0 && x.fracY === 0).length
console.log(`Piksel bulat : ${bulat}`)
console.log(`Pecahan      : ${r.length - bulat}`)

const sidebar = r.filter((x) => x.inSidebar)
console.log(`\n=== Ikon sidebar (${sidebar.length}) ===`)
for (const s of sidebar.slice(0, 8)) {
  console.log(`  size=${s.size}  x=${s.x} (${s.fracX})  y=${s.y} (${s.fracY})`)
}

const pecahan = r.filter((x) => x.fracX !== 0 || x.fracY !== 0)
console.log(`\n=== Contoh posisi pecahan (${pecahan.length}) ===`)
for (const s of pecahan.slice(0, 6)) {
  console.log(`  size=${s.size}  x=${s.x}  y=${s.y}`)
}

await browser.close()
