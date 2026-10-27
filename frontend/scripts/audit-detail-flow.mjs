/**
 * Audit alur detail booking + zoom 200% pada konten.
 * Melengkapi audit alur inti: apakah halaman detail punya h1 dan lolos axe.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const AXE = fs.readFileSync('/tmp/axe/package/axe.min.js', 'utf8')
const BASE = 'http://127.0.0.1:4173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
for (let i = 0; i < 3; i++) {
  const btn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
  if (await btn.count()) await btn.first().click()
  await page.waitForURL('**/dashboard', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1800)
  if (page.url().includes('/dashboard')) break
}

// buka booking pertama dari daftar
await page.goto(`${BASE}/bookings`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
const firstLink = page.locator('a[href*="/bookings/"]').first()
let detailUrl = null
if (await firstLink.count()) {
  detailUrl = await firstLink.getAttribute('href')
}

if (detailUrl) {
  await page.goto(`${BASE}${detailUrl}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  console.log(`=== DETAIL: ${detailUrl} ===`)
  const h = await page.evaluate(() => ({
    h1: [...document.querySelectorAll('h1')].map((x) => x.textContent.trim()),
    h2: [...document.querySelectorAll('h2')].map((x) => x.textContent.trim().slice(0, 50)),
    h3: [...document.querySelectorAll('h3')].map((x) => x.textContent.trim().slice(0, 50)),
    title: document.title,
  }))
  console.log('  h1:', JSON.stringify(h.h1))
  console.log('  h2:', JSON.stringify(h.h2))
  console.log('  h3:', JSON.stringify(h.h3))
  console.log('  title:', h.title)

  await page.addScriptTag({ content: AXE })
  const v = await page.evaluate(async () => {
    const res = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })
    return res.violations.map((x) => ({ id: x.id, impact: x.impact, total: x.nodes.length }))
  })
  console.log('  axe:', JSON.stringify(v))
}

// zoom 200%: viewport 640 dengan DPR 2 pada halaman konten padat
console.log('\n=== REFLOW 200% (640px @2x) ===')
const zctx = await browser.newContext({ viewport: { width: 640, height: 900 }, deviceScaleFactor: 2 })
const zp = await zctx.newPage()
await zp.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
for (let i = 0; i < 3; i++) {
  const b = zp.getByRole('button', { name: /Masuk sebagai vendor uji/i })
  if (await b.count()) await b.first().click()
  await zp.waitForTimeout(2000)
  if (zp.url().includes('/dashboard')) break
}
for (const path of ['/dashboard', '/bookings']) {
  await zp.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  await zp.waitForTimeout(1500)
  const r = await zp.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    c: document.documentElement.clientWidth,
  }))
  console.log(`  ${path}: scrollW=${r.s} clientW=${r.c} ${r.s > r.c + 1 ? 'OVERFLOW' : 'ok'}`)
}
await zctx.close()

await browser.close()
