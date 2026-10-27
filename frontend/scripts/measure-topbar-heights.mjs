/**
 * Mengukur tinggi riil tombol Topbar (bukan nilai kelas).
 * Kalau tingginya 37px bukan 36px, berarti ada border/padding tak terlihat.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:4173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
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
  const out = []
  for (const b of document.querySelectorAll('header button, header a, header div')) {
    const rect = b.getBoundingClientRect()
    if (rect.height < 20 || rect.height > 60) continue
    const cs = getComputedStyle(b)
    out.push({
      tag: b.tagName.toLowerCase(),
      h: Math.round(rect.height * 1000) / 1000,
      y: Math.round(rect.y * 1000) / 1000,
      box: `${cs.borderTopWidth}/${cs.borderBottomWidth}`,
      pad: `${cs.paddingTop}/${cs.paddingBottom}`,
      minH: cs.minHeight,
      display: cs.display,
    })
  }
  return out.slice(0, 10)
})

console.log('=== tinggi riil elemen Topbar ===')
for (const x of r) {
  const frac = x.h % 1 !== 0 ? ' <-- PECAHAN' : ''
  console.log(`  ${x.tag.padEnd(7)} h=${String(x.h).padStart(7)} y=${String(x.y).padStart(7)} border=${x.box} pad=${x.pad} minH=${x.minH} ${x.display}${frac}`)
}

await browser.close()
