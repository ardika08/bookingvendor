import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  LoaderCircle,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { formatCurrency, formatDate } from '@/lib/format'
import { USE_MOCK_SUBSCRIPTION } from '@/lib/api/subscription'
import type {
  CheckoutSession,
  Payment,
  PaymentMethod,
  PaymentMethodCode,
} from '@/types/subscription'

/**
 * Halaman checkout langganan (`/upgrade/checkout/:ref`).
 *
 * Tiga langkah, mengikuti alur payment gateway (Midtrans Snap / Duitku POP —
 * dibungkus adapter sehingga gateway-nya bisa ditukar tanpa mengubah UI):
 *   1. Ringkasan  — rincian paket + pilih metode pembayaran, lalu buat transaksi.
 *   2. Instruksi  — nomor VA / QR / tombol e-wallet + hitungan waktu kedaluwarsa
 *                   dan tombol cek status (webhook mengaktifkan langganan).
 *   3. Selesai    — konfirmasi masa aktif baru.
 *
 * Selama backend belum aktif, transaksi & webhook disimulasikan (lihat
 * `lib/api/subscription.ts`); komponen ini tidak berubah saat nyata.
 */
export interface CheckoutPageProps {
  session: CheckoutSession
  methods: PaymentMethod[]
  /** Masa aktif baru setelah pembayaran terkonfirmasi (diisi route). */
  activeUntil: string | null
  onPay: (method: PaymentMethodCode) => Promise<void>
  onCheckStatus: () => Promise<Payment['status']>
  onSimulatePaid: () => Promise<void>
  onExpired: () => Promise<void>
  onBackToMethods: () => void
}

export function CheckoutPage({
  session,
  methods,
  activeUntil,
  onPay,
  onCheckStatus,
  onSimulatePaid,
  onExpired,
  onBackToMethods,
}: CheckoutPageProps) {
  if (session.step === 'success') {
    return <CheckoutSuccess session={session} activeUntil={activeUntil} />
  }

  if (session.step === 'expired') {
    return <CheckoutExpired planName={session.plan.name} />
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/upgrade"
          className="inline-flex items-center gap-1.5 text-meta font-medium text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke paket langganan
        </Link>
        <h1 className="mt-2 text-title tracking-tight text-ink-900">
          Checkout langganan
        </h1>
        <p className="mt-0.5 text-body text-ink-500">
          Bayar lewat QRIS, Virtual Account, atau e-wallet. Langganan aktif otomatis begitu
          pembayaran terverifikasi.
        </p>
      </div>

      <CheckoutStepper step={session.step} />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {session.step === 'instructions' && session.methodInstructions ? (
          <InstructionsPanel
            session={session}
            method={session.methodInstructions}
            onCheckStatus={onCheckStatus}
            onSimulatePaid={onSimulatePaid}
            onExpired={onExpired}
            onBack={onBackToMethods}
          />
        ) : (
          <MethodPicker session={session} methods={methods} onPay={onPay} />
        )}

        <OrderSummary session={session} />
      </div>
    </div>
  )
}

/** Indikator tiga langkah: Ringkasan → Pembayaran → Selesai. */
function CheckoutStepper({ step }: { step: CheckoutSession['step'] }) {
  const steps = [
    { key: 'summary', label: 'Ringkasan' },
    { key: 'instructions', label: 'Pembayaran' },
    { key: 'success', label: 'Selesai' },
  ]
  const activeIndex = step === 'instructions' ? 1 : step === 'success' ? 2 : 0

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta">
      {steps.map((item, index) => {
        const done = index < activeIndex
        const active = index === activeIndex
        return (
          <li key={item.key} className="flex items-center gap-2">
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full text-caption font-semibold',
                active
                  ? 'bg-brand-600 text-white'
                  : done
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-ink-100 text-ink-400',
              )}
            >
              {done ? <Check className="size-3" /> : index + 1}
            </span>
            <span className={cn('font-medium', active ? 'text-ink-900' : 'text-ink-500')}>
              {item.label}
            </span>
            {index < steps.length - 1 ? <span className="mx-1 h-px w-6 bg-ink-200" /> : null}
          </li>
        )
      })}
    </ol>
  )
}

/** Kartu ringkasan order di kolom kanan. */
function OrderSummary({ session }: { session: CheckoutSession }) {
  const { plan } = session
  const durationDays = plan.durationMonths === 12 ? 365 : plan.durationMonths * 30

  return (
    <Card className="h-fit lg:sticky lg:top-4">
      <CardHeader title="Ringkasan pesanan" />
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lead font-semibold text-ink-900">Paket {plan.name}</p>
            <p className="text-meta text-ink-500">Aktif {durationDays} hari</p>
          </div>
          <p className="text-lead font-semibold tabular-nums text-ink-900">
            {formatCurrency(plan.price ?? 0)}
          </p>
        </div>

        <ul className="space-y-2 border-t border-ink-100 pt-3">
          {plan.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-meta text-ink-700">
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
              {benefit}
            </li>
          ))}
        </ul>

        {session.payment.reference ? (
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-caption text-ink-600">
            <span className="text-ink-400">No. referensi</span>
            <p className="font-semibold tabular-nums text-ink-800">{session.payment.reference}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-ink-100 pt-3">
          <span className="text-body font-medium text-ink-600">Total bayar</span>
          <span className="text-lead font-semibold tabular-nums text-ink-900">
            {formatCurrency(plan.price ?? 0)}
          </span>
        </div>
      </CardBody>
    </Card>
  )
}

/**
 * Pemilih metode pembayaran + tombol bayar.
 *
 * Untuk paket baru (`session.id` kosong) transaksi baru dibuat saat tombol ini
 * ditekan; untuk transaksi pending yang dilanjutkan, nomor referensi & sisa
 * waktu sudah tampil di atas pilihan.
 */
function MethodPicker({
  session,
  methods,
  onPay,
}: {
  session: CheckoutSession
  methods: PaymentMethod[]
  onPay: (method: PaymentMethodCode) => Promise<void>
}) {
  const resumable = session.id !== ''
  const fallback = methods[0]?.code ?? null
  const [selected, setSelected] = useState<PaymentMethodCode | null>(session.selectedMethod ?? fallback)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    if (!selected || pending) return
    setPending(true)
    setError(null)
    try {
      await onPay(selected)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memulai pembayaran.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Metode pembayaran"
        description={
          resumable
            ? 'Pilih metode untuk melanjutkan pembayaran transaksi ini.'
            : 'Pilih metode yang paling nyaman untukmu.'
        }
      />
      <CardBody className="space-y-3">
        {resumable ? <ResumeBanner payment={session.payment} /> : null}

        <ul className="space-y-2">
          {methods.map((method) => (
            <MethodOption
              key={method.code}
              method={method}
              checked={method.code === selected}
              onSelect={() => setSelected(method.code)}
            />
          ))}
        </ul>

        {error ? (
          <p className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-meta text-rose-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        ) : null}

        <Button onClick={handlePay} disabled={!selected || pending} className="w-full">
          {pending ? (
            <>
              <LoaderCircle className="size-4 animate-spin" /> Menyiapkan pembayaran…
            </>
          ) : (
            <>
              <CreditCard className="size-4" />
              {resumable ? 'Lanjut bayar' : 'Bayar'} {formatCurrency(session.plan.price ?? 0)}
            </>
          )}
        </Button>

        <p className="flex items-start gap-1.5 text-caption leading-relaxed text-ink-500">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
          Pembayaran diproses gateway. Kami tidak menyimpan data kartu/rekening kamu.
        </p>
      </CardBody>
    </Card>
  )
}

function ResumeBanner({ payment }: { payment: Payment }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-meta text-amber-900">
      <span className="font-semibold">Melanjutkan transaksi {payment.reference}</span>
      {payment.expiresAt ? (
        <>
          {' '}
          — selesaikan sebelum {formatDate(payment.expiresAt.slice(0, 10))} supaya tidak kedaluwarsa.
        </>
      ) : null}
    </div>
  )
}

const METHOD_ICON: Record<string, typeof QrCode> = {
  qris: QrCode,
  va_bca: CreditCard,
  va_bni: CreditCard,
  va_mandiri: CreditCard,
  ewallet: Wallet,
}

function MethodOption({
  method,
  checked,
  onSelect,
}: {
  method: PaymentMethod
  checked: boolean
  onSelect: () => void
}) {
  const Icon = METHOD_ICON[method.code] ?? Smartphone

  return (
    <li>
      <label
        className={cn(
          'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
          checked ? 'border-brand-300 bg-brand-50/60' : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50',
        )}
      >
        <input
          type="radio"
          name="checkout-method"
          className="size-3.5 shrink-0 accent-brand-600"
          checked={checked}
          onChange={onSelect}
        />
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-medium text-ink-900">{method.name}</span>
          <span className="block text-caption text-ink-500">{method.description}</span>
        </span>
      </label>
    </li>
  )
}

/**
 * Panel instruksi pembayaran setelah metode dipilih.
 *
 * Menampilkan rincian sesuai metode (nomor VA, QR, atau tombol e-wallet),
 * hitung mundur sampai kedaluwarsa, tombol cek status (webhook mengaktifkan
 * langganan), dan — hanya di mode mock — tombol simulasi pembayaran diterima.
 */
function InstructionsPanel({
  session,
  method,
  onCheckStatus,
  onSimulatePaid,
  onExpired,
  onBack,
}: {
  session: CheckoutSession
  method: PaymentMethod
  onCheckStatus: () => Promise<Payment['status']>
  onSimulatePaid: () => Promise<void>
  onExpired: () => Promise<void>
  onBack: () => void
}) {
  const remaining = useCountdown(session.payment.expiresAt)
  const [checking, setChecking] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [statusNote, setStatusNote] = useState<string | null>(null)
  const expiredRef = useRef(false)

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true
      void onExpired()
    }
  }, [remaining, onExpired])

  async function handleCheck() {
    if (checking) return
    setChecking(true)
    setStatusNote(null)
    try {
      const status = await onCheckStatus()
      if (status === 'confirmed') {
        setStatusNote('Pembayaran terverifikasi — langgananmu aktif.')
      } else if (status === 'expired' || status === 'rejected') {
        setStatusNote('Transaksi tidak lagi aktif. Silakan buat transaksi baru.')
      } else {
        setStatusNote('Pembayaran belum kami terima. Selesaikan pembayaran lalu cek lagi.')
      }
    } finally {
      setChecking(false)
    }
  }

  async function handleSimulate() {
    if (simulating) return
    setSimulating(true)
    try {
      await onSimulatePaid()
    } finally {
      setSimulating(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title={`Bayar dengan ${method.name}`}
        description="Selesaikan pembayaran sebelum waktu habis; langganan aktif otomatis."
        action={
          remaining !== null ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium tabular-nums ring-1 ring-inset',
                remaining <= 5 * 60 * 1000
                  ? 'bg-rose-50 text-rose-700 ring-rose-200'
                  : 'bg-ink-100 text-ink-600 ring-ink-200',
              )}
            >
              <Clock3 className="size-3.5" />
              {formatCountdown(remaining)}
            </span>
          ) : null
        }
      />
      <CardBody className="space-y-4">
        <MethodInstructions method={method} amount={session.payment.amount} />

        {statusNote ? (
          <p className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-meta text-ink-700">
            {statusNote}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={handleCheck} disabled={checking} variant="secondary" className="sm:flex-1">
            {checking ? (
              <>
                <LoaderCircle className="size-4 animate-spin" /> Memeriksa…
              </>
            ) : (
              <>
                <RefreshCw className="size-4" /> Cek status pembayaran
              </>
            )}
          </Button>
          <Button variant="ghost" onClick={onBack} className="sm:flex-none">
            Ganti metode
          </Button>
        </div>

        {USE_MOCK_SUBSCRIPTION ? (
          <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/70 px-3 py-2.5">
            <p className="text-caption font-medium uppercase tracking-wide text-amber-700">
              Mode demo
            </p>
            <p className="mt-0.5 text-caption leading-relaxed text-amber-900">
              Backend gateway belum aktif. Pakai tombol ini untuk meniru webhook pembayaran
              berhasil.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSimulate}
              disabled={simulating}
              className="mt-2"
            >
              {simulating ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin" /> Memproses…
                </>
              ) : (
                'Simulasikan pembayaran diterima'
              )}
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}

/** Blok instruksi sesuai jenis metode pembayaran. */
function MethodInstructions({ method, amount }: { method: PaymentMethod; amount: number }) {
  if (method.virtualAccount) {
    return (
      <div className="space-y-3">
        <InfoRow label="Nomor Virtual Account" value={<CopyValue value={method.virtualAccount} mono />} />
        {method.provider ? <InfoRow label="Bank" value={method.provider} /> : null}
        <InfoRow label="Nominal" value={<span className="tabular-nums">{formatCurrency(amount)}</span>} />
        <p className="text-caption leading-relaxed text-ink-500">
          Transfer tepat sesuai nominal. Sistem mendeteksi pembayaran otomatis — tidak perlu unggah
          bukti.
        </p>
      </div>
    )
  }

  if (method.code === 'ewallet') {
    return (
      <div className="space-y-3">
        <div className="flex size-28 items-center justify-center rounded-xl border border-ink-200 bg-ink-50">
          <Wallet className="size-9 text-ink-400" />
        </div>
        <p className="text-meta leading-relaxed text-ink-600">
          Buka aplikasi e-wallet pilihanmu, lalu selesaikan pembayaran sebesar{' '}
          <span className="font-semibold tabular-nums text-ink-800">{formatCurrency(amount)}</span>.
        </p>
        {method.ewalletDeepLink ? (
          <a
            href={method.ewalletDeepLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-body font-medium text-white shadow-sm hover:bg-brand-700"
          >
            <Wallet className="size-4" /> Buka aplikasi e-wallet
          </a>
        ) : null}
      </div>
    )
  }

  // QRIS — render payload `qrString` dari gateway menjadi gambar QR.
  return (
    <div className="space-y-3">
      <QrisImage method={method} amount={amount} />

      <p className="text-meta leading-relaxed text-ink-600">
        Scan QR dengan aplikasi bank atau e-wallet apa pun, lalu bayar{' '}
        <span className="font-semibold tabular-nums text-ink-800">{formatCurrency(amount)}</span>.
      </p>

      {method.qrCodeUrl ? (
        <a
          href={method.qrCodeUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-ink-200 px-4 text-body font-medium text-ink-700 hover:bg-ink-50"
        >
          <ExternalLink className="size-4" /> Buka halaman pembayaran
        </a>
      ) : null}
    </div>
  )
}

/**
 * Gambar QR dari payload EMVCo gateway.
 *
 * Duitku mengirim `qrString` (bukan gambar), jadi QR dirender di klien.
 * Bila `qrCodeUrl` tersedia dan `qrString` tidak, gambar langsung dipakai.
 */
function QrisImage({ method, amount }: { method: PaymentMethod; amount: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    if (!method.qrString) {
      setDataUrl(null)
      return
    }

    // Impor dinamis: pustaka QR hanya dibutuhkan di langkah ini, jadi tidak
    // ikut membebani bundle halaman lain.
    import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(method.qrString as string, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: 'M',
        }),
      )
      .then((url) => {
        if (active) setDataUrl(url)
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
    }
  }, [method.qrString])

  if (method.qrCodeUrl && !method.qrString) {
    return (
      <img
        src={method.qrCodeUrl}
        alt={`QRIS ${formatCurrency(amount)}`}
        className="size-48 rounded-xl border border-ink-200 bg-white object-contain p-2"
      />
    )
  }

  if (dataUrl) {
    return (
      <img
        src={dataUrl}
        alt={`QRIS ${formatCurrency(amount)}`}
        className="size-48 rounded-xl border border-ink-200 bg-white p-2"
      />
    )
  }

  return (
    <div className="flex size-48 flex-col items-center justify-center gap-1 rounded-xl border border-ink-200 bg-white text-ink-400">
      <QrCode className="size-14" />
      <span className="text-2xs font-medium">
        {failed ? 'QR gagal dimuat' : 'Menyiapkan QR…'}
      </span>
    </div>
  )
}

/** Baris label–nilai sederhana di panel instruksi. */
function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-100 pb-2 last:border-b-0">
      <span className="text-meta text-ink-500">{label}</span>
      <span className="text-body font-medium text-ink-900">{value}</span>
    </div>
  )
}

/** Nilai + tombol salin (mis. nomor VA). */
function CopyValue({ value, mono }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await copyToClipboard(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn(mono && 'tabular-nums tracking-wide')}>{value}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-caption font-medium text-brand-700 hover:bg-brand-50"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? 'Tersalin' : 'Salin'}
      </button>
    </span>
  )
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const input = document.createElement('textarea')
  input.value = value
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  const ok = document.execCommand('copy')
  input.remove()
  if (!ok) throw new Error('Clipboard tidak tersedia.')
}

/** Layar akhir setelah pembayaran terkonfirmasi. */
function CheckoutSuccess({
  session,
  activeUntil,
}: {
  session: CheckoutSession
  activeUntil: string | null
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 text-center">
      <div className="rounded-xl border border-emerald-200 bg-white px-6 py-8">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="size-7" />
        </span>
        <h1 className="mt-4 text-title tracking-tight text-ink-900">
          Langganan aktif
        </h1>
        <p className="mt-1 text-body leading-relaxed text-ink-500">
          Pembayaran paket <span className="font-medium text-ink-700">{session.plan.name}</span> sudah
          terverifikasi. Booking &amp; invoice kini tanpa batas.
        </p>

        <div className="mx-auto mt-5 max-w-xs rounded-lg border border-ink-200 bg-ink-50/60 px-4 py-3 text-left">
          <InfoRow label="Paket" value={session.plan.name} />
          {activeUntil ? (
            <InfoRow label="Berlaku sampai" value={formatDate(activeUntil.slice(0, 10))} />
          ) : null}
          {session.payment.reference ? (
            <InfoRow
              label="No. referensi"
              value={<span className="tabular-nums">{session.payment.reference}</span>}
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <ButtonLink to="/dashboard">Ke dashboard</ButtonLink>
        <ButtonLink to="/upgrade" variant="secondary">
          Lihat paket lain
        </ButtonLink>
      </div>
    </div>
  )
}

/** Layar saat transaksi melewati batas waktu. */
function CheckoutExpired({ planName }: { planName: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 text-center">
      <div className="rounded-xl border border-ink-200 bg-white px-6 py-8">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-ink-100 text-ink-500">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-4 text-title tracking-tight text-ink-900">
          Transaksi kedaluwarsa
        </h1>
        <p className="mt-1 text-body leading-relaxed text-ink-500">
          Waktu pembayaran paket <span className="font-medium text-ink-700">{planName}</span> sudah
          habis dan transaksi ditutup. Tidak ada dana yang tertarik; kamu bisa membuat transaksi
          baru kapan saja.
        </p>
      </div>
      <ButtonLink to="/upgrade">Buat transaksi baru</ButtonLink>
    </div>
  )
}

/** Sisa waktu (ms) sampai `expiresAt`; null bila tidak ada batas waktu. */
function remainingMs(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.max(0, new Date(expiresAt).getTime() - Date.now())
}

function useCountdown(expiresAt: string | null): number | null {
  const [remaining, setRemaining] = useState(() => remainingMs(expiresAt))

  useEffect(() => {
    setRemaining(remainingMs(expiresAt))
    if (!expiresAt) return
    const id = window.setInterval(() => setRemaining(remainingMs(expiresAt)), 1000)
    return () => window.clearInterval(id)
  }, [expiresAt])

  return remaining
}

/** Ms → `HH:MM:SS`. */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}
