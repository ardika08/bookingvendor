import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { fetchPackages, fetchTakenDates, createBooking } from '@/lib/api/bookings'
import { fetchClients } from '@/lib/api/clients'
import type { ClientSummary } from '@/lib/clients'
import type { CurrentUser, VendorPackage } from '@/types/booking'
import { BookingFormPage } from '@/pages/BookingFormPage'

/**
 * Route `/bookings/new`.
 *
 * Mengambil data pendukung form dari lapisan API (paket, tanggal terisi, klien
 * lama) lalu men-submit ke `POST /api/bookings`.
 */
export function BookingCreateRoute() {
  const { user } = useOutletContext<{ user: CurrentUser }>()
  const [packages, setPackages] = useState<VendorPackage[]>([])
  const [takenDates, setTakenDates] = useState<string[]>([])
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([fetchPackages(), fetchTakenDates(), fetchClients({ search: '', sort: 'name' }, 1, 100)])
      .then(([packageList, dates, clientPage]) => {
        if (!active) return
        setPackages(packageList)
        setTakenDates(dates)

        /*
         * Sebelumnya daftar ini dirakit dari `mockBookings`, sehingga vendor
         * yang mencari klien lama tidak menemukan apa pun di data nyata.
         * Sekarang diambil dari `GET /api/clients`.
         */
        setClients(
          clientPage.items.map((client) => ({
            id: client.id,
            name: client.name,
            phone: client.phone,
            email: client.email,
            bookingCount: client.bookingCount,
            totalValue: client.totalValue,
            lastEventDate: client.lastEventDate,
            lastStatus: client.lastStatus as ClientSummary['lastStatus'],
          })),
        )
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (!active) return
        // Tanpa catch, kegagalan satu request (mis. sesi berakhir → 401)
        // membuat seluruh Promise.all reject dan muncul sebagai unhandled
        // rejection — halaman jadi kosong tanpa penjelasan.
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Gagal memuat data pendukung form.',
        )
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
      {loadError ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12.5px] text-rose-800"
        >
          {loadError}
        </div>
      ) : null}

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
