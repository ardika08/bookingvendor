import { useCallback, useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import {
  checkPaymentStatus,
  createCheckout,
  expirePayment,
  fetchCheckoutSession,
  fetchPaymentMethods,
  fetchPlanCheckout,
  fetchSubscription,
  selectPaymentMethod,
  simulatePaymentPaid,
} from '@/lib/api/subscription'
import { CheckoutPage } from '@/pages/CheckoutPage'
import type {
  CheckoutSession,
  Payment,
  PaymentMethod,
  PaymentMethodCode,
} from '@/types/subscription'

/**
 * Route `/upgrade/checkout/:ref`.
 *
 * `:ref` menunjuk salah satu dari dua sumber:
 *   - `plan-*`    → titik masuk dari katalog paket; transaksi belum dibuat,
 *                   baru terbentuk saat vendor menekan tombol bayar.
 *   - `pay-*`     → melanjutkan transaksi pending dari riwayat pembayaran.
 *
 * Semua aksi (buat transaksi, pilih metode, cek status, simulasi webhook)
 * melewati lapisan API mock sehingga state tetap konsisten dengan store.
 */
export function CheckoutRoute() {
  const { ref = '' } = useParams()

  if (ref.startsWith('plan-')) return <PlanCheckoutRoute planId={ref} />
  return <PaymentCheckoutRoute paymentId={ref} />
}

function PlanCheckoutRoute({ planId }: { planId: string }) {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [session, setSession] = useState<CheckoutSession | null>(null)
  const [activeUntil, setActiveUntil] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setNotFound(false)
    Promise.all([fetchPlanCheckout(planId), fetchPaymentMethods()])
      .then(([planSession, methodList]) => {
        if (!active) return
        setSession(planSession)
        setMethods(methodList)
      })
      .catch(() => {
        if (active) setNotFound(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [planId])

  const afterPaid = useCallback(async () => {
    const subscription = await fetchSubscription()
    setActiveUntil(subscription.endsAt)
  }, [])

  const actions = useCheckoutActions({
    session,
    setSession,
    afterPaid,
  })

  if (loading) return <CheckoutSkeleton />
  if (notFound || !session) return <Navigate to="/upgrade" replace />

  return (
    <CheckoutPage
      session={session}
      methods={methods}
      activeUntil={activeUntil}
      onBackToMethods={actions.onBackToMethods}
      onPay={actions.onPay}
      onCheckStatus={actions.onCheckStatus}
      onSimulatePaid={actions.onSimulatePaid}
      onExpired={actions.onExpired}
    />
  )
}

function PaymentCheckoutRoute({ paymentId }: { paymentId: string }) {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [session, setSession] = useState<CheckoutSession | null>(null)
  const [activeUntil, setActiveUntil] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setNotFound(false)
    Promise.all([fetchCheckoutSession(paymentId), fetchPaymentMethods()])
      .then(([paymentSession, methodList]) => {
        if (!active) return
        if (!paymentSession) {
          setNotFound(true)
          return
        }
        setSession(paymentSession)
        setMethods(methodList)
      })
      .catch(() => {
        if (active) setNotFound(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [paymentId])

  const afterPaid = useCallback(async () => {
    const subscription = await fetchSubscription()
    setActiveUntil(subscription.endsAt)
  }, [])

  const actions = useCheckoutActions({ session, setSession, afterPaid })

  if (loading) return <CheckoutSkeleton />
  if (notFound || !session) return <Navigate to="/upgrade" replace />

  return (
    <CheckoutPage
      session={session}
      methods={methods}
      activeUntil={activeUntil}
      onBackToMethods={actions.onBackToMethods}
      onPay={actions.onPay}
      onCheckStatus={actions.onCheckStatus}
      onSimulatePaid={actions.onSimulatePaid}
      onExpired={actions.onExpired}
    />
  )
}

/** Aksi checkout yang dipakai bersama oleh kedua sumber `:ref`. */
function useCheckoutActions({
  session,
  setSession,
  afterPaid,
}: {
  session: CheckoutSession | null
  setSession: (session: CheckoutSession) => void
  afterPaid: () => Promise<void>
}) {
  const onPay = useCallback(
    async (method: PaymentMethodCode) => {
      if (!session) return
      let base = session
      if (base.id === '') {
        base = await createCheckout(base.plan.id)
      }
      const next = await selectPaymentMethod(base.id, method)
      if (next) setSession(next)
    },
    [session, setSession],
  )

  const onCheckStatus = useCallback(async (): Promise<Payment['status']> => {
    if (!session?.id) return 'pending'
    const { status } = await checkPaymentStatus(session.id)
    const refreshed = await fetchCheckoutSession(session.id)
    if (refreshed) setSession(refreshed)
    if (status === 'confirmed') await afterPaid()
    return status
  }, [session, setSession, afterPaid])

  const onSimulatePaid = useCallback(async () => {
    if (!session?.id) return
    const next = await simulatePaymentPaid(session.id)
    if (next) setSession(next)
    await afterPaid()
  }, [session, setSession, afterPaid])

  const onExpired = useCallback(async () => {
    if (!session?.id) return
    const next = await expirePayment(session.id)
    if (next) setSession(next)
  }, [session, setSession])

  const onBackToMethods = useCallback(() => {
    if (!session) return
    setSession({ ...session, step: 'summary', methodInstructions: null })
  }, [session, setSession])

  return { onPay, onCheckStatus, onSimulatePaid, onExpired, onBackToMethods }
}

/** Skeleton sederhana selama sesi checkout dimuat. */
function CheckoutSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-16 animate-pulse rounded-xl bg-white" />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="h-72 animate-pulse rounded-xl bg-white" />
        <div className="h-72 animate-pulse rounded-xl bg-white" />
      </div>
    </div>
  )
}
