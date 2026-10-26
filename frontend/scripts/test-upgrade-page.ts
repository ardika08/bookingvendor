import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { PlanCard } from '../src/components/subscription/PlanCard.tsx'
import { fetchPlans } from '../src/lib/api/subscription.ts'

async function run() {
  const plans = await fetchPlans()
  if (plans.length !== 3) throw new Error('Katalog upgrade harus memuat tiga paket mock.')

  const monthly = plans.find((plan) => plan.code === 'monthly')
  const quarterly = plans.find((plan) => plan.code === 'quarterly')
  const yearly = plans.find((plan) => plan.code === 'yearly')
  if (!monthly || monthly.price !== 50000 || !quarterly || quarterly.price !== null || !yearly || yearly.price !== null) {
    throw new Error('Harga mock paket bulanan dan paket yang belum tersedia tidak sesuai.')
  }

  const monthlyMarkup = renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(PlanCard, { plan: monthly })),
  )
  const unpricedMarkup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement('div', null, [quarterly, yearly].map((plan) => createElement(PlanCard, { key: plan.id, plan }))),
    ),
  )

  if (!monthlyMarkup.includes('50.000') || !monthlyMarkup.includes('Pilih Bulanan')) {
    throw new Error('Kartu paket bulanan harus menampilkan harga dan aksi pilih.')
  }
  if (!unpricedMarkup.includes('Harga menyusul') || !unpricedMarkup.includes('disabled=""')) {
    throw new Error('Paket tanpa harga harus tampil nonaktif sebagai Harga menyusul.')
  }

  console.log('ok - katalog upgrade menampilkan paket bulanan dan paket mock yang belum tersedia')
}

void run()
