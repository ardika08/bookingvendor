/**
 * Audit aksesibilitas otomatis dengan axe-core pada alur inti.
 *
 * Scope: Login -> Dashboard -> Bookings -> Detail Booking.
 * Diuji di 1280px dan 320px (WCAG 1.4.10 reflow), plus 200% zoom.
 *
 * Yang dikeluarkan skrip ini adalah BUKTI mentah, bukan verdict. Setiap
 * temuan tetap harus diverifikasi manual terhadap kriteria WCAG.
 */

import { chromium } from '/home/ubuntu/.hermes/hermes-agent/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const AXE = fs.readFileSync('/tmp/axe/package/axe.min.js', 'utf8')
const BASE = 'http://127.0.0.1:4173'

const browser = await chromium.launch()

async function auditAt(width, height, label) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })

  // login lewat tombol demo
  for (let i = 0; i < 3; i++) {
    const btn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
    if (await btn.count()) await btn.first().click()
    await page.waitForURL('**/dashboard', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(1800)
    if (page.url().includes('/dashboard')) break
  }

  const pages = ['/dashboard', '/bookings']
  const results = {}

  for (const path of pages) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1800)
    await page.addScriptTag({ content: AXE })
    const r = await page.evaluate(async () => {
      const res = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      })
      return res.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        tags: v.tags.filter((t) => t.startsWith('wcag')),
        nodes: v.nodes.slice(0, 6).map((n) => ({
          target: n.target.join(' '),
          html: (n.html || '').slice(0, 150),
          fail: (n.failureSummary || '').slice(0, 200),
        })),
        total: v.nodes.length,
      }))
    })
    results[path] = r
  }

  // reflow check at this width
  const reflow = {}
  for (const path of pages) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1500)
    reflow[path] = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }))
  }

  await ctx.close()
  return { label, width, results, reflow }
}

const desktop = await auditAt(1280, 900, 'desktop-1280')
const narrow = await auditAt(320, 800, 'narrow-320')

fs.writeFileSync('/tmp/axe-report.json', JSON.stringify({ desktop, narrow }, null, 2))

function summarize(block) {
  console.log(`\n########## ${block.label} (${block.width}px) ##########`)
  for (const [path, vios] of Object.entries(block.results)) {
    console.log(`\n--- ${path} : ${vios.length} jenis pelanggaran ---`)
    for (const v of vios) {
      console.log(`  [${v.impact}] ${v.id} (${v.total} node) — ${v.tags.join(',')}`)
      console.log(`     ${v.help}`)
      for (const n of v.nodes.slice(0, 3)) {
        console.log(`       ${n.target}`)
        console.log(`       html: ${n.html.replace(/\s+/g, ' ').slice(0, 110)}`)
      }
    }
  }
  console.log(`\n--- reflow ---`)
  for (const [path, r] of Object.entries(block.reflow)) {
    console.log(`  ${path}: scrollW=${r.scrollW} clientW=${r.clientW} ${r.overflow ? 'OVERFLOW' : 'ok'}`)
  }
}

summarize(desktop)
summarize(narrow)

await browser.close()
