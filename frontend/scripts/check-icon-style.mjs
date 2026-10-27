/**
 * Memastikan style solid benar-benar aktif.
 *
 * Ikon solid memakai `fill` (bentuk terisi), sedangkan stroke memakai
 * `stroke` dengan `fill="none"`. Kalau paket sudah diganti tapi cache Vite
 * masih lama, aplikasi bisa tetap menampilkan style sebelumnya.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:4173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
for (let i = 0; i < 3; i++) {
  const btn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
  if (await btn.count()) await btn.first().click()
  await page.waitForURL('**/dashboard', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1500)
  if (page.url().includes('/dashboard')) break
}

const r = await page.evaluate(() => {
  const out = []
  for (const s of document.querySelectorAll('svg[viewBox="0 0 24 24"]')) {
    const paths = [...s.querySelectorAll('path,circle,rect,line,polyline')]
    if (!paths.length) continue
    const p0 = paths[0]
    out.push({
      svgFill: s.getAttribute('fill'),
      pathFill: p0.getAttribute('fill'),
      pathStroke: p0.getAttribute('stroke'),
      d: (p0.getAttribute('d') || '').slice(0, 30),
      inSidebar: !!s.closest('aside'),
    })
  }
  return out
})

console.log(`Total ikon: ${r.length}\n`)
const terisi = r.filter((x) => x.pathFill && x.pathFill !== 'none')
const garis = r.filter((x) => x.pathStroke)
console.log(`Path dengan fill (solid) : ${terisi.length}`)
console.log(`Path dengan stroke (garis): ${garis.length}`)

console.log('\n=== 5 contoh pertama ===')
for (const x of r.slice(0, 5)) {
  console.log(`  svgFill=${x.svgFill} pathFill=${x.pathFill} pathStroke=${x.pathStroke}`)
  console.log(`     d="${x.d}..."`)
}

await browser.close()
