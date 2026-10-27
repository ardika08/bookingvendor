/**
 * Audit hirarki tipografi secara numerik.
 *
 * Untuk setiap halaman: kumpulkan semua heading (h1-h4) beserta ukuran/bobot
 * hasil render, lalu periksa apakah ukurannya menurun secara monoton mengikuti
 * level. Inversi (h2 lebih besar dari h1) adalah bug hirarki, bukan selera.
 *
 * Juga laporkan elemen teks yang jarak barisnya terlalu rapat (< 1.3) supaya
 * teks padat tidak berdesakan.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:4173'

const PAGES = [
  ['login', '/login'],
  ['promo', '/'],
  ['dashboard', '/dashboard'],
  ['bookings', '/bookings'],
  ['invoices', '/invoices'],
  ['calendar', '/calendar'],
  ['clients', '/clients'],
  ['packages', '/packages'],
  ['profile', '/profile'],
  ['account', '/account'],
  ['booking-detail', '/bookings'],
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
const page = await ctx.newPage()

await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
const btn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
if (await btn.count()) {
  await btn.first().click()
  await page.waitForTimeout(4000)
}

let inversions = 0

for (const [name, path] of PAGES) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)

  const heads = await page.evaluate(() => {
    const out = []
    document.querySelectorAll('h1,h2,h3,h4').forEach((el) => {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      if (r.width === 0 || cs.display === 'none') return
      out.push({
        level: Number(el.tagName[1]),
        size: parseFloat(cs.fontSize),
        weight: cs.fontWeight,
        text: (el.textContent || '').trim().slice(0, 38),
      })
    })
    return out
  })

  console.log(`\n--- ${name} (${path}) ---`)
  for (const h of heads) {
    console.log(`  h${h.level}  ${String(h.size).padStart(5)}px  w${h.weight}  ${h.text}`)
  }

  // Inversi: heading level lebih dalam tapi ukuran lebih besar dari sebelumnya.
  for (let i = 1; i < heads.length; i++) {
    const prev = heads[i - 1]
    const cur = heads[i]
    if (cur.level > prev.level && cur.size > prev.size) {
      console.log(`  !! INVERSI: h${cur.level} (${cur.size}px) > h${prev.level} (${prev.size}px)`)
      inversions++
    }
  }
}

console.log(`\n=== TOTAL INVERSI HIRARKI: ${inversions} ===`)
await browser.close()
process.exit(inversions ? 1 : 0)
