/**
 * Diagnosis ikon tampak blur.
 *
 * Tiga penyebab yang mungkin, dan semuanya bisa diukur:
 *
 * 1. **Ketebalan garis sub-piksel.** Ikon Hugeicons memakai viewBox 24 dengan
 *    stroke-width 1.5. Saat SVG ditampilkan 14px, garis itu jadi
 *    1.5 x (14/24) = 0.875 px — di bawah 1 piksel, sehingga selalu di-antialias
 *    dan terlihat pudar/abu-abu, bukan hitam tegas.
 * 2. **Posisi setengah piksel.** Kalau ikon diletakkan di koordinat x/y berakhiran
 *    .5 (mis. hasil flex centering di wadah bertinggi ganjil), seluruh glyph
 *    digambar di antara dua piksel -> semua tepi jadi blur.
 * 3. **shape-rendering.** Bawaan `auto` memakai antialias; `crispEdges` mematikan
 *    antialias (tajam tapi bergerigi), jadi bukan solusi untuk ikon melengkung.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:4173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
const btn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
if (await btn.count()) await btn.first().click()
await page.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(1800)

const r = await page.evaluate(() => {
  const rows = []
  for (const s of document.querySelectorAll('svg[viewBox="0 0 24 24"]')) {
    const paths = [...s.querySelectorAll('path,circle,rect,line,polyline')]
    if (!paths.length) continue
    const rect = s.getBoundingClientRect()
    const cs = getComputedStyle(s)
    const size = parseFloat(cs.width)
    // stroke-width diambil dari path pertama (atribut), dikonversi ke px layar
    const swAttr = parseFloat(paths[0].getAttribute('stroke-width') || '0')
    const swPx = swAttr * (size / 24)
    rows.push({
      size: Math.round(size * 100) / 100,
      x: Math.round(rect.x * 100) / 100,
      y: Math.round(rect.y * 100) / 100,
      fracX: Math.round((rect.x % 1) * 100) / 100,
      fracY: Math.round((rect.y % 1) * 100) / 100,
      swAttr,
      swPx: Math.round(swPx * 1000) / 1000,
      shapeRendering: cs.shapeRendering,
      fill: paths[0].getAttribute('fill'),
    })
  }
  return rows
})

console.log(`Total ikon diukur: ${r.length}\n`)

// 1) sebaran ketebalan efektif
const bySw = {}
for (const x of r) bySw[x.swPx] = (bySw[x.swPx] || 0) + 1
console.log('=== Ketebalan garis EFEKTIF di layar (px) ===')
for (const [k, v] of Object.entries(bySw).sort((a, b) => a[0] - b[0])) {
  const n = Number(k)
  const status = n < 1 ? 'SUB-PIKSEL -> selalu blur' : n < 1.2 ? 'tipis' : 'OK'
  console.log(`  ${k} px  x${v}   ${status}`)
}

// 2) posisi pecahan
const frac = r.filter((x) => x.fracX !== 0 || x.fracY !== 0)
console.log(`\n=== Posisi pecahan (bukan bilangan bulat) ===`)
console.log(`  ${frac.length} dari ${r.length} ikon tidak berada di piksel bulat`)
const contoh = frac.slice(0, 6)
for (const c of contoh) console.log(`   size=${c.size} x=${c.x} (frac ${c.fracX}) y=${c.y} (frac ${c.fracY})`)

// 3) shape-rendering
const sr = {}
for (const x of r) sr[x.shapeRendering] = (sr[x.shapeRendering] || 0) + 1
console.log(`\n=== shape-rendering ===\n  ${JSON.stringify(sr)}`)

// 4) fill
const fl = {}
for (const x of r) fl[String(x.fill)] = (fl[String(x.fill)] || 0) + 1
console.log(`\n=== fill pada path pertama ===\n  ${JSON.stringify(fl)}`)

await browser.close()
