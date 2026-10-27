/**
 * Verifikasi nilai `clamp()` pada token mikro di beberapa lebar layar.
 * Memastikan teks mikro benar-benar naik di desktop dan tetap kecil di mobile.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:4173'

const browser = await chromium.launch()
for (const width of [375, 414, 768, 1024, 1280, 1600]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 })
  const loginBtn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
  if (await loginBtn.count()) {
    await loginBtn.first().click()
  }
  await page.waitForURL('**/dashboard', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(2000)

  const r = await page.evaluate(() => {
    const g = (cls) => {
      const d = document.createElement('div')
      d.className = cls
      d.textContent = 'Ag'
      document.body.appendChild(d)
      const s = getComputedStyle(d)
      const v = { px: parseFloat(s.fontSize), lh: parseFloat(s.lineHeight) }
      d.remove()
      return v
    }
    return {
      w: window.innerWidth,
      micro: g('text-2xs').px,
      caption: g('text-caption').px,
      meta: g('text-meta').px,
      body: g('text-body').px,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  console.log(
    `${String(r.w).padStart(5)}px  micro=${r.micro}  caption=${r.caption}  meta=${r.meta}  body=${r.body}  ovf=${r.overflow}`,
  )
  await ctx.close()
}
await browser.close()
