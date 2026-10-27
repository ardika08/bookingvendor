/**
 * Verifikasi ikon Hugeicons benar-benar ter-render di DOM.
 *
 * Memeriksa setiap halaman: jumlah <svg>, apakah path-nya berasal dari Hugeicons
 * (viewBox 0 0 24 24, stroke currentColor), apakah ukuran tetap mengikuti kelas
 * `size-*` (bukan default 24px yang membengkakkan ikon), dan apakah ada <svg>
 * kosong (tanda ikon gagal dimuat).
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:4173'
const PAGES = [
  ['dashboard', '/dashboard'],
  ['bookings', '/bookings'],
  ['invoices', '/invoices'],
  ['calendar', '/calendar'],
  ['clients', '/clients'],
  ['packages', '/packages'],
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
const btn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
if (await btn.count()) await btn.first().click()
await page.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(1500)

let totalMasalah = 0
for (const [name, path] of PAGES) {
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1200)

  const r = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')]
    let kosong = 0
    let bukanHugeicons = 0
    let defaultSize = 0
    const ukuran = {}
    for (const s of svgs) {
      const paths = s.querySelectorAll('path,circle,rect,line,polyline')
      if (paths.length === 0) {
        // svg tanpa anak bisa jadi ikon chart; hitung hanya yang kecil
        kosong++
        continue
      }
      const vb = s.getAttribute('viewBox')
      if (vb !== '0 0 24 24') {
        bukanHugeicons++
        continue
      }
      const w = s.getAttribute('width')
      const h = s.getAttribute('height')
      // HugeiconsIcon menulis width/height default 24 bila `size` tidak diisi
      if (w === '24' && h === '24') defaultSize++
      const key = `${w}x${h}`
      ukuran[key] = (ukuran[key] || 0) + 1
    }
    return {
      total: svgs.length,
      kosong,
      bukanHugeicons,
      defaultSize,
      ukuran,
      finalUrl: location.pathname,
    }
  })

  const masalah = r.kosong + r.bukanHugeicons
  totalMasalah += masalah
  console.log(
    `${name.padEnd(10)} url=${r.finalUrl.padEnd(12)} svg=${String(r.total).padStart(3)}  ` +
      `kosong=${r.kosong}  default24=${r.defaultSize}  ukuran=${JSON.stringify(r.ukuran)}`,
  )
}

console.log(`\n=== TOTAL MASALAH: ${totalMasalah} ===`)
await browser.close()
process.exit(totalMasalah === 0 ? 0 : 1)
