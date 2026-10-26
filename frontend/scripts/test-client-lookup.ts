import assert from 'node:assert/strict'
import { buildClientSummaries, normalizeKey, searchClients } from '../src/lib/clients.ts'
import type { Client, BookingStatus } from '../src/types/booking.ts'

/**
 * Uji komponen lookup klien: dedupe klien dari booking, normalisasi nomor lintas
 * format (0/62/+62), dan pencarian nama/nomor.
 */

interface Row {
  client: Client
  eventDate: string
  status: BookingStatus
  totalPrice: number
}

const rows: Row[] = [
  {
    client: { id: 'c1', name: 'Rani & Bagas', phone: '0812-3456-7890', email: null },
    eventDate: '2026-11-14',
    status: 'confirmed',
    totalPrice: 15000000,
  },
  {
    // Klien yang sama, nomor ditulis dengan format berbeda → harus jadi 1 entri.
    client: { id: 'c1', name: 'Rani & Bagas', phone: '+62 812 3456 7890', email: null },
    eventDate: '2027-02-01',
    status: 'tentative',
    totalPrice: 5000000,
  },
  {
    client: { id: 'c2', name: 'Sinta & Arya', phone: '6285711223344', email: 'sinta@mail.com' },
    eventDate: '2026-11-22',
    status: 'cancelled',
    totalPrice: 24500000,
  },
  {
    client: { id: 'c3', name: 'Nadia & Fikri', phone: '081388990011', email: null },
    eventDate: '2026-12-05',
    status: 'confirmed',
    totalPrice: 8500000,
  },
]

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

const clients = buildClientSummaries(rows)

check('nomor 08 dan +62 untuk orang yang sama digabung', () => {
  const rani = clients.filter((client) => client.name === 'Rani & Bagas')
  assert.equal(rani.length, 1)
  assert.equal(rani[0].bookingCount, 2)
})

check('normalisasi nomor menyamakan 0 / 62 / +62', () => {
  assert.equal(normalizeKey('081234567890'), normalizeKey('+62 812-3456-7890'))
  assert.equal(normalizeKey('6281234567890'), normalizeKey('0812 3456 7890'))
})

check('total nilai tidak menghitung booking batal', () => {
  const sinta = clients.find((client) => client.name === 'Sinta & Arya')
  assert.ok(sinta)
  assert.equal(sinta.totalValue, 0)
})

check('nilai kontrak klien aktif terakumulasi', () => {
  const rani = clients.find((client) => client.name === 'Rani & Bagas')
  assert.ok(rani)
  assert.equal(rani.totalValue, 20000000)
})

check('tanggal terakhir memakai acara paling akhir', () => {
  const rani = clients.find((client) => client.name === 'Rani & Bagas')
  assert.ok(rani)
  assert.equal(rani.lastEventDate, '2027-02-01')
})

check('pencarian nama tidak peka huruf besar/kecil', () => {
  assert.equal(searchClients(clients, 'sinta').length, 1)
  assert.equal(searchClients(clients, 'NADIA').length, 1)
})

check('pencarian nomor format apa pun menemukan klien', () => {
  assert.equal(searchClients(clients, '0812')[0]?.name, 'Rani & Bagas')
  assert.equal(searchClients(clients, '6285711223344')[0]?.name, 'Sinta & Arya')
  assert.equal(searchClients(clients, '+62 812-3456-7890')[0]?.name, 'Rani & Bagas')
})

check('kata kunci kurang dari 2 huruf tidak memicu pencarian', () => {
  assert.deepEqual(searchClients(clients, 'a'), [])
})

check('hasil pencarian dibatasi (default 6)', () => {
  const many = Array.from({ length: 20 }, (_, index) => ({
    client: { id: `x${index}`, name: `Klien ${index}`, phone: `0812000000${index}`, email: null },
    eventDate: '2026-11-01',
    status: 'tentative' as BookingStatus,
    totalPrice: 0,
  }))
  assert.equal(searchClients(buildClientSummaries(many), 'klien').length, 6)
})

console.log(`\n${passed} assertion group(s) passed`)
