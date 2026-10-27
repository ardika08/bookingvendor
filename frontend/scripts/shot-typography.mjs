/**
 * Ambil tangkapan layar bukti hirarki tipografi pada 375px dan 1280px.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:4173'
const browser = await chromium.launch()

for (const [width, path, out] of [
  [375, '/bookings', '/tmp/type-bookings-375.png'],
  [1280, '/dashboard', '/tmp/type-dashboard-1280.png'],
  [375, '/dashboard', '/tmp/type-dashboard-375.png'],
]) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  const btn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
  if (await btn.count()) {
    await btn.first().click()
    await page.waitForTimeout(4000)
  }
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(900)
  await page.screenshot({ path: out })
  console.log('saved', out)
  await ctx.close()
}

await browser.close()
