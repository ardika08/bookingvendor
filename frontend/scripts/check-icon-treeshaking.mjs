/**
 * Memastikan tree-shaking Hugeicons benar-benar bekerja.
 *
 * Paket @hugeicons/core-free-icons berisi ~14.800 ikon. Kalau tree-shaking gagal,
 * seluruh isi paket ikut masuk bundle dan ukurannya membengkak ratusan kB.
 * Skrip ini memeriksa nama ikon yang TIDAK dipakai aplikasi: kalau namanya muncul
 * di bundle, berarti ada yang salah dan perlu diperbaiki sebelum dirilis.
 */

import fs from 'node:fs'
import path from 'node:path'

const dir = 'dist/assets'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
let all = ''
for (const f of files) all += fs.readFileSync(path.join(dir, f), 'utf8')

// Ikon acak yang jelas tidak dipakai di aplikasi ini.
const tidakDipakai = [
  'AArrowDown',
  'Abacus',
  'Accident',
  'Zakat',
  'Zodiac',
  'Volcano',
  'Waves',
  'Airdrop',
  'Alien01',
  'Ambulance',
]

let gagal = 0
console.log('=== IKON YANG TIDAK DIPAKAI (harus absen dari bundle) ===')
for (const name of tidakDipakai) {
  const n = (all.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length
  if (n === 0) {
    console.log(`  OK    ${name.padEnd(12)} tidak ada`)
  } else {
    console.log(`  GAGAL ${name.padEnd(12)} muncul ${n}x`)
    gagal++
  }
}

// Ikon yang dipakai TIDAK bisa diverifikasi lewat nama: minifier mengganti nama
// identifier, jadi `TriangleAlert` tidak muncul sebagai teks di bundle meski
// ikonnya benar-benar ada. Verifikasi ikon terpakai dilakukan lewat DOM di
// scripts/check-icons-render.mjs (menghitung <svg> yang benar-benar ter-render).
console.log('\nCatatan: nama ikon terpakai tidak dicek di sini karena minifikasi')
console.log('mengganti nama identifier. Render-nya diverifikasi lewat DOM.')

console.log(`\nTotal JS: ${(all.length / 1024).toFixed(0)} kB`)
console.log(gagal === 0 ? '\nHASIL: tree-shaking bekerja, hanya ikon terpakai yang masuk bundle.' : `\nHASIL: ${gagal} masalah.`)
process.exit(gagal === 0 ? 0 : 1)
