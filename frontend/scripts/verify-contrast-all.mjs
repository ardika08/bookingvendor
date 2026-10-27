/**
 * Verifikasi kontras di seluruh alur inti setelah revisi token.
 * Memastikan perbaikan berlaku di semua halaman, bukan hanya dashboard.
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
  const b = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
  if (await b.count()) await b.first().click()
  await page.waitForTimeout(2000)
  if (page.url().includes('/dashboard')) break
}

// halaman publik juga dicek karena tidak butuh login
const targets = ['/dashboard', '/bookings', '/bookings/18', '/invoices', '/clients', '/packages', '/calendar']

let total = 0
for (const path of targets) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1600)
  await page.addScriptTag({ content: AXE })
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: ['color-contrast'] })
    const rows = []
    for (const v of res.violations) {
      for (const n of v.nodes) {
        const d = (n.any && n.any[0] && n.any[0].data) || {}
        rows.push({ fg: d.fgColor, bg: d.bgColor, ratio: d.contrastRatio, html: (n.html || '').slice(0, 90) })
      }
    }
    return rows
  })
  total += r.length
  console.log(`${path.padEnd(16)} kontras gagal: ${r.length}`)
  for (const x of r.slice(0, 4)) {
    console.log(`   ${x.ratio}:1 fg=${x.fg} bg=${x.bg}`)
    console.log(`   ${x.html.replace(/\s+/g, ' ')}`)
  }
}

// halaman publik (tanpa login)
const pubCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const pub = await pubCtx.newPage()
for (const path of ['/login', '/']) {
  await pub.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 })
  await pub.waitForTimeout(1500)
  await pub.addScriptTag({ content: AXE })
  const r = await pub.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: ['color-contrast'] })
    return res.violations.reduce((a, v) => a + v.nodes.length, 0)
  })
  total += r
  console.log(`${path.padEnd(16)} kontras gagal: ${r}`)
}
await pubCtx.close()

console.log(`\n=== TOTAL KONTRAS GAGAL DI SELURUH ALUR: ${total} ===`)
await browser.close()
