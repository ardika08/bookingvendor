import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { fetchPackages, fetchTakenDates, createBooking } from '@/lib/api/bookings'
import type { ClientSummary } from '@/lib/clients'
import { buildClientSummaries } from '@/lib/clients'
import { mockBookings } from '@/lib/mock/bookings'
import type { CurrentUser, VendorPackage } from '@/types/booking'
import { BookingFormPage } from '@/pages/BookingFormPage'

/**
 * Route `/bookings/new`.
 *
 * Mengambil data pendukung form dari lapisan API (paket, tanggal terisi, klien
 * lama) lalu men-submit ke `POST /api/bookings`. Dalam mode mock, `createBooking`
 * menunggu sebentar dan mengembalikan objek booking palsu; begitu backend aktif,
 * cukup set `USE_MOCK_DATA = false` di `lib/api/bookings.ts` — route ini tidak berubah.
 */
export function BookingCreateRoute() {
  const { user } = useOutletContext<{ user: CurrentUser }>()
  const [packages, setPackages] = useState<VendorPackage[]>([])
  const [takenDates, setTakenDates] = useState<string[]>([])
  const [clients, setClients] = useState<ClientSummary[]>([])

  useEffect(() => {
    let active = true
    Promise.all([fetchPackages(), fetchTakenDates()]).then(([packageList, dates]) => {
      if (!active) return
      setPackages(packageList)
      setTakenDates(dates)
      // Placeholder sampai `GET /api/clients` ada; sumbernya booking yang sama.
      setClients(buildClientSummaries(mockBookings))
    })
    return () => {
      active = false
    }
  }, [])

  const handleSubmit = useCallback(
    async (payload: Parameters<typeof createBooking>[0]) => {
      await createBooking(payload)
    },
    [],
  )

  const trialExhausted =
    user.subscription.status !== 'active' &&
    user.subscription.trialBookingsUsed >= user.subscription.trialBookingsLimit

  return (
    <div className="space-y-4">
      {user.subscription.status === 'trial' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-[12.5px] text-amber-900">
          <span className="font-semibold">Masa trial.</span> Form tetap bisa diisi penuh — submit
          diblokir server bila jatah trial habis.
        </div>
      ) : null}

      <BookingFormPage
        packages={packages}
        takenDates={takenDates}
        clients={clients}
        trialExhausted={trialExhausted}
        trialUsage={{
          bookingsUsed: user.subscription.trialBookingsUsed,
          bookingsLimit: user.subscription.trialBookingsLimit,
          invoicesUsed: user.subscription.trialInvoicesUsed,
          invoicesLimit: user.subscription.trialInvoicesLimit,
        }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
