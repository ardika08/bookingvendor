/**
 * Membandingkan kandidat perbaikan ketajaman ikon secara terukur.
 *
 * Kandidat:
 *   A. baseline            — apa adanya (stroke 1.5 dari paket, diskalakan)
 *   B. absoluteStrokeWidth — Hugeicons membagi stroke dengan skala, sehingga
 *                            garis tetap ~1.5 px layar berapa pun ukuran ikonnya
 *   C. B + posisi bulat    — sama, ditambah memaksa koordinat piksel bulat
 *   D. crispEdges          — antialias dimatikan (kontrol: tajam tapi bergerigi)
 *
 * Diukur dari piksel: rasio pekat/antara. Semakin besar, semakin tajam.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import { PNG } from '/home/ubuntu/.hermes/hermes-agent/node_modules/pngjs/lib/png.js'

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

const target = page.locator('a[href="/bookings"] svg').first()
await target.waitFor({ timeout: 15000 })

function ukur(buf) {
  const png = PNG.sync.read(buf)
  const { data } = png
  let pekat = 0
  let antara = 0
  let latar = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 20) continue
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (lum < 110) pekat++
    else if (lum > 245) latar++
    else antara++
  }
  return { pekat, antara, latar, rasio: pekat / Math.max(antara, 1) }
}

// A. baseline
let hasil = { A: ukur(await target.screenshot()) }

// B. absoluteStrokeWidth: stroke tetap ~1.5px layar
await page.evaluate(() => {
  document.querySelectorAll('svg[viewBox="0 0 24 24"]').forEach((s) => {
    const size = parseFloat(getComputedStyle(s).width)
    const k = 24 / size
    s.querySelectorAll('path,circle,rect,line,polyline').forEach((p) => {
      const w = parseFloat(p.getAttribute('stroke-width') || '1.5')
      p.setAttribute('stroke-width', String(w * k))
    })
  })
})
await page.waitForTimeout(300)
hasil.B = ukur(await target.screenshot())

// C. + posisi piksel bulat
await page.evaluate(() => {
  document.querySelectorAll('svg[viewBox="0 0 24 24"]').forEach((s) => {
    const r = s.getBoundingClientRect()
    const dx = Math.round(r.x) - r.x
    const dy = Math.round(r.y) - r.y
    s.style.transform = `translate(${dx}px, ${dy}px)`
  })
})
await page.waitForTimeout(300)
hasil.C = ukur(await target.screenshot())

// D. crispEdges (kontrol)
await page.evaluate(() => {
  document.querySelectorAll('svg[viewBox="0 0 24 24"]').forEach((s) => {
    s.style.shapeRendering = 'crispEdges'
  })
})
await page.waitForTimeout(300)
hasil.D = ukur(await target.screenshot())

const nama = {
  A: 'baseline (stroke diskalakan)',
  B: 'absoluteStrokeWidth',
  C: 'absoluteStrokeWidth + piksel bulat',
  D: 'crispEdges (kontrol, antialias mati)',
}
console.log('=== PERBANDINGAN KETAIAMAN (DPR 4, ikon sidebar 16px) ===')
for (const k of ['A', 'B', 'C', 'D']) {
  const r = hasil[k]
  const total = r.pekat + r.antara + r.latar
  console.log(
    `${k}. ${nama[k].padEnd(38)} pekat=${String(r.pekat).padStart(5)} ` +
      `antara=${String(r.antara).padStart(4)} (${((r.antara / total) * 100).toFixed(1)}%) ` +
      `rasio=${r.rasio.toFixed(2)}`,
  )
}

await browser.close()
