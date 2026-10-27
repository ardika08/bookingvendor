/**
 * Verifikasi responsif tipografi pada beberapa lebar viewport nyata.
 *
 * Mengukur hasil render sebenarnya (bukan perkiraan dari kelas CSS):
 *   - overflow horizontal halaman
 *   - elemen yang melewati tepi kanan
 *   - teks yang meluber dari kotaknya (indikasi terpotong)
 *   - ukuran & bobot nyata untuk h1 dan body
 *
 * Jalankan: node scripts/check-typography-responsive.mjs
 * Butuh dev server di :4173 dan Chromium Playwright.
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
]

const VIEWPORTS = [375, 390, 768, 1280]

const PROBE = () => {
  const de = document.documentElement
  const vw = window.innerWidth

  const over = []
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && r.right > vw + 1) {
      const cs = getComputedStyle(el)
      if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.display === 'none') return
      // Tabel lebar di dalam wadah `overflow-x-auto` memang disengaja: pengguna
      // menggeser tabel, bukan halaman. Jangan dihitung sebagai pelanggaran.
      let a = el.parentElement
      let inScroller = false
      while (a) {
        const acs = getComputedStyle(a)
        if (acs.overflowX === 'auto' || acs.overflowX === 'scroll') {
          inScroller = true
          break
        }
        a = a.parentElement
      }
      if (inScroller) return
      over.push({
        tag: el.tagName,
        cls: String(el.className || '').slice(0, 70),
        over: Math.round(r.right - vw),
      })
    }
  })

  const clipped = []
  document.querySelectorAll('h1,h2,h3,p,span,td,th,a,button,label,dd,dt').forEach((el) => {
    if (el.children.length > 0) return
    const cs = getComputedStyle(el)
    if (cs.textOverflow === 'ellipsis') return
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      clipped.push({
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 45),
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
      })
    }
  })

  const sample = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const cs = getComputedStyle(el)
    return {
      size: cs.fontSize,
      weight: cs.fontWeight,
      lh: cs.lineHeight,
      font: cs.fontFamily.split(',')[0].replace(/"/g, ''),
    }
  }

  return {
    vw,
    scrollW: de.scrollWidth,
    overflowX: de.scrollWidth - vw,
    overflowCount: over.length,
    overflow: over.slice(0, 5),
    clippedCount: clipped.length,
    clipped: clipped.slice(0, 5),
    h1: sample('h1'),
    body: sample('body'),
    poppinsReady: document.fonts.check('600 13px Poppins'),
  }
}

const browser = await chromium.launch()
const results = []

for (const width of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await ctx.newPage()

  // Halaman dashboard butuh sesi. Login sekali per konteks lewat tombol vendor uji,
  // kalau tidak semua URL ter-redirect ke /login dan hasil ukur jadi palsu.
  await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 20000 })
  const loginBtn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
  if (await loginBtn.count()) {
    await loginBtn.first().click()
    await page.waitForTimeout(4000)
  }

  for (const [name, path] of PAGES) {
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 20000 })
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(500)
      const data = await page.evaluate(PROBE)
      results.push({ page: name, width, finalUrl: new URL(page.url()).pathname, ...data })
    } catch (e) {
      results.push({ page: name, width, error: String(e).slice(0, 120) })
    }
  }
  await ctx.close()
}

await browser.close()

console.log('=== PER HALAMAN x VIEWPORT ===')
for (const r of results) {
  if (r.error) {
    console.log(`${r.page.padEnd(10)} ${String(r.width).padStart(5)}  ERROR ${r.error}`)
    continue
  }
  const flag = r.overflowX <= 0 ? 'OK ' : 'OVF'
  console.log(
    `${r.page.padEnd(10)} ${String(r.width).padStart(5)}  ${flag} ` +
      `${r.finalUrl.padEnd(12)} ` +
      `ovf=${String(r.overflowX).padStart(3)} elOver=${String(r.overflowCount).padStart(2)} ` +
      `clipped=${String(r.clippedCount).padStart(2)} ` +
      `h1=${r.h1 ? r.h1.size + '/' + r.h1.weight : '-'} ` +
      `body=${r.body ? r.body.size : '-'} ` +
      `poppins=${r.poppinsReady}`,
  )
}

const problems = results.filter(
  (r) => r.error || r.overflowX > 0 || r.overflowCount > 0 || r.finalUrl !== undefined && r.page !== 'login' && r.finalUrl === '/login',
)
if (problems.length) {
  console.log('\n=== DETAIL MASALAH ===')
  for (const r of problems.slice(0, 12)) {
    console.log(JSON.stringify(r, null, 2).slice(0, 700))
  }
}
console.log(`\n=== TOTAL MASALAH: ${problems.length} ===`)
process.exit(problems.length ? 1 : 0)
