/**
 * Mengukur ketajaman ikon secara objektif dari piksel.
 *
 * Ikon di-crop, lalu tiap piksel diklasifikasikan: pekat (dekat warna ikon),
 * latar (dekat warna latar), atau ANTARA (antialias). Ikon bergaris tipis
 * menghasilkan banyak piksel "antara" karena garisnya lebih tipis dari satu
 * piksel, sehingga tampak pudar. Semakin kecil rasio antara, semakin tajam.
 *
 * Dipakai untuk membandingkan sebelum vs sesudah perbaikan, bukan menebak dari
 * kesan visual.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import { PNG } from '/home/ubuntu/.hermes/hermes-agent/node_modules/pngjs/lib/png.js'

const BASE = 'http://127.0.0.1:4173'
const LABEL = process.argv[2] || 'sekarang'

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

// Ambil ikon sidebar (ukuran 16px, paling sering dilihat pengguna)
const target = page.locator('a[href="/bookings"] svg').first()
await target.waitFor({ timeout: 15000 })
const buf = await target.screenshot()
fs.writeFileSync(`/tmp/icon-${LABEL}.png`, buf)

const png = PNG.sync.read(buf)
const { width, height, data } = png

// Latar sidebar putih; ikon abu-abu gelap. Hitung distribusi kecerahan.
let pekat = 0
let antara = 0
let latar = 0
for (let i = 0; i < data.length; i += 4) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  const a = data[i + 3]
  if (a < 20) continue
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  if (lum < 110) pekat++
  else if (lum > 245) latar++
  else antara++
}

const total = pekat + antara + latar
console.log(`=== ${LABEL} ===`)
console.log(`crop ${width}x${height} (device pixel, DPR 4)`)
console.log(`  pekat   : ${pekat} (${((pekat / total) * 100).toFixed(1)}%)`)
console.log(`  ANTARA  : ${antara} (${((antara / total) * 100).toFixed(1)}%)  <- makin kecil makin tajam`)
console.log(`  latar   : ${latar} (${((latar / total) * 100).toFixed(1)}%)`)
console.log(`  rasio ketajaman (pekat/antara): ${(pekat / Math.max(antara, 1)).toFixed(2)}  <- makin besar makin tajam`)

await browser.close()
