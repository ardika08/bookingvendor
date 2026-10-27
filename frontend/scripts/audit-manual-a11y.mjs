/**
 * Verifikasi manual untuk klaim HIGH.
 *
 * Mengukur:
 *  1. Rasio kontras aktual untuk pasangan yang dilaporkan axe (bukan menebak).
 *  2. Focus indicator terlihat di setiap stop keyboard.
 *  3. Accessible name setiap kontrol interaktif.
 *  4. Landmark, h1, skip link, lang, viewport meta.
 *  5. prefers-reduced-motion guard.
 *  6. Reflow pada 200% zoom.
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
  const btn = page.getByRole('button', { name: /Masuk sebagai vendor uji/i })
  if (await btn.count()) await btn.first().click()
  await page.waitForURL('**/dashboard', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1800)
  if (page.url().includes('/dashboard')) break
}

// ---------- 1. Kontras aktual dengan data dari axe ----------
await page.addScriptTag({ content: AXE })
const contrast = await page.evaluate(async () => {
  const res = await window.axe.run(document, { runOnly: ['color-contrast'] })
  const rows = []
  for (const v of res.violations) {
    for (const n of v.nodes) {
      const d = (n.any && n.any[0] && n.any[0].data) || {}
      rows.push({
        target: n.target.join(' '),
        html: (n.html || '').replace(/\s+/g, ' ').slice(0, 120),
        fg: d.fgColor,
        bg: d.bgColor,
        ratio: d.contrastRatio,
        expected: d.expectedContrastRatio,
        fontSize: d.fontSize,
        fontWeight: d.fontWeight,
      })
    }
  }
  return rows
})

console.log(`=== KONTRAS GAGAL (${contrast.length} node) ===`)
const seen = new Set()
for (const c of contrast) {
  const key = `${c.fg}|${c.bg}|${c.ratio}|${c.fontSize}|${c.fontWeight}`
  if (seen.has(key)) continue
  seen.add(key)
  console.log(`  ${String(c.ratio).padStart(5)} : 1  (butuh ${c.expected})  fg=${c.fg} bg=${c.bg}  ${c.fontSize}/${c.fontWeight}`)
  console.log(`         ${c.target.slice(0, 90)}`)
  console.log(`         ${c.html.slice(0, 100)}`)
}

// ---------- 2. Focus indicator ----------
console.log('\n=== FOCUS INDICATOR (Tab 20x) ===')
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const focusInfo = []
for (let i = 0; i < 20; i++) {
  await page.keyboard.press('Tab')
  await page.waitForTimeout(120)
  const info = await page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return null
    const cs = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
      boxShadow: cs.boxShadow.slice(0, 60),
      ring: cs.getPropertyValue('--tw-ring-shadow').slice(0, 40),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    }
  })
  if (info) focusInfo.push(info)
}
const noRing = focusInfo.filter(
  (f) => (f.outline === 'none 0px' || f.outline.startsWith('none')) && (!f.boxShadow || f.boxShadow === 'none'),
)
console.log(`  stop keyboard: ${focusInfo.length}`)
console.log(`  TANPA focus ring terlihat: ${noRing.length}`)
for (const f of noRing) console.log(`    ${f.tag} "${f.text}" outline=${f.outline} shadow=${f.boxShadow}`)

// ---------- 3. Accessible name kontrol ----------
console.log('\n=== KONTROL TANPA ACCESSIBLE NAME ===')
const nameless = await page.evaluate(() => {
  const out = []
  const sel = 'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'
  for (const el of document.querySelectorAll(sel)) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    const name =
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      (el.labels && el.labels.length ? el.labels[0].textContent : '') ||
      el.textContent ||
      el.getAttribute('alt') ||
      ''
    if (!name.trim()) {
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 70),
        html: el.outerHTML.replace(/\s+/g, ' ').slice(0, 110),
      })
    }
  }
  return out
})
console.log(`  total: ${nameless.length}`)
for (const n of nameless.slice(0, 10)) console.log(`    ${n.tag} .${n.cls}\n      ${n.html}`)

// ---------- 4. Struktur dokumen ----------
console.log('\n=== STRUKTUR DOKUMEN ===')
const struct = await page.evaluate(() => ({
  lang: document.documentElement.lang || '(kosong)',
  title: document.title,
  viewport: (document.querySelector('meta[name="viewport"]') || {}).content || '(tidak ada)',
  main: document.querySelectorAll('main').length,
  h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
  nav: document.querySelectorAll('nav').length,
  asideNoLabel: [...document.querySelectorAll('aside')].filter(
    (a) => !a.getAttribute('aria-label') && !a.getAttribute('aria-labelledby'),
  ).length,
  skipLink: !!document.querySelector('a[href^="#"]'),
  firstFocusable: (() => {
    const f = document.querySelector('a[href], button, input, select, textarea')
    return f ? `${f.tagName.toLowerCase()}: ${(f.textContent || f.getAttribute('aria-label') || '').trim().slice(0, 40)}` : '(none)'
  })(),
}))
for (const [k, v] of Object.entries(struct)) console.log(`  ${k}: ${JSON.stringify(v)}`)

// ---------- 5. prefers-reduced-motion ----------
console.log('\n=== MOTION ===')
const motion = await page.evaluate(() => {
  let transitionAll = 0
  let animated = 0
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    if (cs.transitionProperty.includes('all')) transitionAll++
    if (cs.animationName && cs.animationName !== 'none') animated++
  }
  return { transitionAll, animated }
})
console.log(`  elemen transition-all: ${motion.transitionAll}`)
console.log(`  elemen beranimasi: ${motion.animated}`)

const rmCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
const rmPage = await rmCtx.newPage()
await rmPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await rmPage.waitForTimeout(1200)
const rmAudit = await rmPage.evaluate(() => {
  let still = 0
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    if (cs.animationName !== 'none' && cs.animationDuration !== '0s') still++
  }
  return still
})
console.log(`  elemen masih beranimasi saat reduced-motion: ${rmAudit}`)
await rmCtx.close()

// ---------- 6. Reflow 200% zoom ----------
console.log('\n=== 200% ZOOM (viewport 640px, deviceScaleFactor 2) ===')
const zoomCtx = await browser.newContext({ viewport: { width: 640, height: 800 }, deviceScaleFactor: 2 })
const zoomPage = await zoomCtx.newPage()
await zoomPage.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
await zoomPage.waitForTimeout(1500)
const zoomReflow = await zoomPage.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
}))
console.log(`  scrollW=${zoomReflow.scrollW} clientW=${zoomReflow.clientW} ${zoomReflow.scrollW > zoomReflow.clientW + 1 ? 'OVERFLOW' : 'ok'}`)
await zoomCtx.close()

await browser.close()
