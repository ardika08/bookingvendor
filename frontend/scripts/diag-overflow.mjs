/**
 * Diagnosa dua temuan pada pemeriksaan responsif:
 *   1. Tabel di /invoices & /bookings (768px) melewati tepi kanan 40-65px.
 *      Perlu dipastikan itu di dalam wadah scroll horizontal (disengaja) atau
 *      benar-benar merusak layout.
 *   2. Satu teks di /bookings terdeteksi terpotong (clipped) di 375px.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:4173'
const browser = await chromium.launch()

for (const [width, path] of [[768, '/invoices'], [768, '/bookings'], [375, '/bookings']]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  const btn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
  if (await btn.count()) {
    await btn.first().click()
    await page.waitForTimeout(4000)
  }
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)

  const info = await page.evaluate(() => {
    const vw = window.innerWidth
    const tbl = document.querySelector('table')
    const chain = []
    if (tbl) {
      let a = tbl.parentElement
      while (a && a !== document.documentElement) {
        const cs = getComputedStyle(a)
        chain.push({
          tag: a.tagName,
          cls: String(a.className || '').slice(0, 55),
          overflowX: cs.overflowX,
          clientW: a.clientWidth,
          scrollW: a.scrollWidth,
          scrollable: a.scrollWidth > a.clientWidth + 1,
        })
        a = a.parentElement
      }
    }
    const clipped = []
    document.querySelectorAll('h1,h2,h3,p,span,td,th,a,button,label,dd,dt,time').forEach((el) => {
      if (el.children.length > 0) return
      const cs = getComputedStyle(el)
      if (cs.textOverflow === 'ellipsis') return
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        clipped.push({
          tag: el.tagName,
          cls: String(el.className || '').slice(0, 55),
          text: (el.textContent || '').trim().slice(0, 55),
          scrollW: el.scrollWidth,
          clientW: el.clientWidth,
        })
      }
    })
    return { vw, tableChain: chain, clipped }
  })

  console.log(`\n########## ${path} @ ${width}px ##########`)
  console.log('table ancestors (dari dalam ke luar):')
  for (const c of info.tableChain) {
    console.log(
      `  ${c.tag.padEnd(6)} ox=${c.overflowX.padEnd(8)} client=${String(c.clientW).padStart(4)} scroll=${String(c.scrollW).padStart(4)} ${c.scrollable ? 'SCROLLABLE' : ''}  ${c.cls}`,
    )
  }
  console.log('clipped:', JSON.stringify(info.clipped, null, 2))
  await ctx.close()
}

await browser.close()
