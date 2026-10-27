/**
 * Menelusuri asal posisi pecahan pada ikon Topbar.
 * Mencetak rantai wadah dari ikon sampai <header> beserta tinggi & padding-nya.
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
  // cari ikon topbar yang posisinya pecahan
  const svgs = [...document.querySelectorAll('header svg[viewBox="0 0 24 24"]')]
  const target = svgs.find((s) => s.getBoundingClientRect().y % 1 !== 0)
  if (!target) return { info: 'tidak ada ikon topbar pecahan' }

  const chain = []
  let el = target
  while (el && el.tagName !== 'BODY') {
    const rect = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    chain.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className && el.className.toString().slice(0, 60)) || '',
      y: Math.round(rect.y * 100) / 100,
      h: Math.round(rect.height * 100) / 100,
      py: `${cs.paddingTop}/${cs.paddingBottom}`,
      lh: cs.lineHeight,
      display: cs.display,
      align: cs.alignItems,
    })
    el = el.parentElement
  }
  return { chain }
})

if (r.info) console.log(r.info)
else {
  console.log('=== rantai wadah ikon Topbar (dari ikon ke luar) ===')
  for (const c of r.chain) {
    console.log(`${c.tag.padEnd(8)} y=${String(c.y).padStart(7)} h=${String(c.h).padStart(6)} py=${c.py.padEnd(11)} lh=${c.lh.padEnd(8)} ${c.display} align=${c.align}`)
    if (c.cls) console.log(`         .${c.cls}`)
  }
}

await browser.close()
