/**
 * Screenshot perbesaran ikon untuk bukti visual ketajaman.
 * Mengambil sidebar dan satu tombol, lalu memperbesar 4x agar blur terlihat.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:4173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 4 })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
for (let i = 0; i < 3; i++) {
  const btn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
  if (await btn.count()) await btn.first().click()
  await page.waitForURL('**/dashboard', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1500)
  if (page.url().includes('/dashboard')) break
}

// potong area sidebar yang memuat beberapa ikon
const aside = page.locator('aside').first()
await aside.waitFor({ timeout: 15000 })
const buf = await aside.screenshot()
fs.writeFileSync('/tmp/icons-sidebar-4x.png', buf)
console.log('saved /tmp/icons-sidebar-4x.png')

await browser.close()
