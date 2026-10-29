import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, inputClass } from '@/components/ui/Field'
import { AlertTriangle, ArrowLeft, ArrowRight, Check } from '@/components/ui/icons'
import { ApiError } from '@/lib/api/client'
import {
  fetchOnboardingStatus,
  patchVendorProfile,
  type OnboardingStatus,
  type OnboardingStep,
} from '@/lib/api/onboarding'
import { fetchVendorProfile } from '@/lib/api/vendor-profile'
import { cn } from '@/lib/cn'
import { VENDOR_CATEGORIES, type VendorProfileDetail } from '@/lib/vendor-profile'

/**
 * Onboarding vendor: pengisian profil bertahap setelah login.
 *
 * Bukan pendaftaran — akun dan profil vendor sudah dibuat admin. Halaman ini
 * melengkapi data yang dibutuhkan agar aplikasi bisa dipakai sepenuhnya,
 * terutama **rekening bank**: tanpa rekening, invoice yang dikirim ke klien
 * menampilkan "Informasi rekening belum tersedia" sehingga klien tidak punya
 * tujuan transfer.
 *
 * Tiga keputusan yang membentuk halaman ini:
 *
 * 1. **Simpan per langkah memakai PATCH.** `PUT` menimpa seluruh profil, jadi
 *    menyimpan langkah rekening akan mengosongkan kontak dan deskripsi.
 * 2. **Hanya rekening yang wajib.** Langkah lain boleh dilewati supaya vendor
 *    yang buru-buru tidak terhambat.
 * 3. **Progres diturunkan server.** Status tidak disimpan sebagai penanda,
 *    jadi tidak mungkin berbeda dari data sebenarnya.
 */

type StepKey = OnboardingStep['key']

const STEP_ORDER: StepKey[] = ['business', 'contact', 'bank']

/** Langkah yang boleh dilewati; rekening sengaja tidak ada di sini. */
const SKIPPABLE: StepKey[] = ['business', 'contact']

export function OnboardingPage() {
  const navigate = useNavigate()

  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [profile, setProfile] = useState<VendorProfileDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)

  // Isian per langkah; semuanya string agar input terkendali.
  const [businessName, setBusinessName] = useState('')
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankNumber, setBankNumber] = useState('')
  const [bankHolder, setBankHolder] = useState('')

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  /** Fokus dipindah ke judul langkah setiap kali langkah berganti. */
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchOnboardingStatus(), fetchVendorProfile()])
      .then(([nextStatus, nextProfile]) => {
        if (cancelled) return

        setStatus(nextStatus)
        setProfile(nextProfile)

        // Mulai dari langkah yang belum lengkap, bukan selalu dari awal.
        const startAt = STEP_ORDER.indexOf(nextStatus.nextStep ?? 'business')
        setStepIndex(startAt >= 0 ? startAt : 0)

        setBusinessName(nextProfile.businessName ?? '')
        setCategory(nextProfile.category ?? '')
        setCity(nextProfile.city ?? '')
        setContactPhone(nextProfile.contactPhone ?? '')
        setContactEmail(nextProfile.contactEmail ?? '')
        setBankName(nextProfile.bank.name ?? '')
        setBankNumber(nextProfile.bank.accountNumber ?? '')
        setBankHolder(nextProfile.bank.accountHolder ?? '')
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'Gagal memuat status onboarding. Coba muat ulang halaman.',
        )
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    headingRef.current?.focus()
  }, [stepIndex])

  const currentStep = STEP_ORDER[stepIndex]

  /** Susun payload untuk langkah aktif saja. */
  const payloadFor = useCallback(
    (step: StepKey) => {
      if (step === 'business') {
        return {
          business_name: businessName.trim(),
          category: category.trim() || null,
          city: city.trim() || null,
        }
      }

      if (step === 'contact') {
        return {
          contact_phone: contactPhone.trim() || null,
          contact_email: contactEmail.trim() || null,
        }
      }

      return {
        bank: {
          name: bankName.trim() || null,
          account_number: bankNumber.trim() || null,
          account_holder: bankHolder.trim() || null,
        },
      }
    },
    [
      businessName,
      category,
      city,
      contactPhone,
      contactEmail,
      bankName,
      bankNumber,
      bankHolder,
    ],
  )

  /** Validasi lokal ringan; server tetap sumber kebenaran. */
  const localErrors = useCallback(
    (step: StepKey): Record<string, string> => {
      const found: Record<string, string> = {}

      if (step === 'business' && businessName.trim().length < 2) {
        found.business_name = 'Nama usaha wajib diisi (minimal 2 karakter).'
      }

      if (step === 'contact' && contactPhone.trim() !== '') {
        if (!/^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(contactPhone.trim())) {
          found.contact_phone = 'Format nomor tidak valid. Contoh: 08123456789.'
        }
      }

      if (step === 'bank') {
        const filled = [bankName, bankNumber, bankHolder].filter((v) => v.trim() !== '').length

        if (filled === 0) {
          found.bank_name = 'Rekening wajib diisi agar invoice bisa dibayar klien.'
        } else if (filled < 3) {
          found.bank_name = 'Lengkapi nama bank, nomor rekening, dan atas nama.'
        } else if (!/^\d{6,20}$/.test(bankNumber.trim())) {
          found.bank_account_number = 'Nomor rekening hanya angka (6–20 digit).'
        }
      }

      return found
    },
    [businessName, contactPhone, bankName, bankNumber, bankHolder],
  )

  const goNext = async () => {
    const step = currentStep
    const found = localErrors(step)

    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }

    setSaving(true)
    setErrors({})
    setFormError(null)

    try {
      await patchVendorProfile(payloadFor(step))

      // Ambil ulang status supaya progres di layar berasal dari server.
      const nextStatus = await fetchOnboardingStatus()
      setStatus(nextStatus)

      if (stepIndex < STEP_ORDER.length - 1) {
        setStepIndex(stepIndex + 1)
        return
      }

      /*
       * Langkah terakhir: simpan dulu, baru tinggalkan halaman.
       *
       * Sebelumnya tombol "Selesai" hanya bernavigasi, sehingga isian rekening
       * yang baru diketik vendor hilang tanpa pesan apa pun. Karena itu
       * "Selesai" memakai jalur simpan yang sama dengan "Lanjut", dan hanya
       * berpindah halaman setelah server memastikan rekening tersimpan.
       */
      if (nextStatus.blockingStep === null) {
        navigate('/dashboard')
      }
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        /*
         * Kunci error server memakai nama field API (`business_name`,
         * `bank.account_number`). Halaman ini memakai nama yang sama untuk
         * state error-nya, jadi pemetaan cukup mengganti titik dengan garis
         * bawah agar cocok dengan kunci yang dibaca JSX di bawah.
         */
        const mapped: Record<string, string> = {}
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          mapped[field.replace(/\./g, '_')] = message
        }
        setErrors(mapped)
      } else {
        setFormError(
          error instanceof ApiError ? error.message : 'Gagal menyimpan. Coba lagi.',
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const skip = () => {
    setErrors({})
    setFormError(null)
    if (stepIndex < STEP_ORDER.length - 1) setStepIndex(stepIndex + 1)
  }

  const back = () => {
    setErrors({})
    setFormError(null)
    if (stepIndex > 0) setStepIndex(stepIndex - 1)
  }

  if (loadError !== null) {
    return (
      <OnboardingShell>
        <div className="flex items-start gap-3 rounded-xl bg-rose-50 px-4 py-3 ring-1 ring-inset ring-rose-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-700" />
          <p className="text-body text-rose-900">{loadError}</p>
        </div>
      </OnboardingShell>
    )
  }

  if (status === null || profile === null) {
    return (
      <OnboardingShell>
        <div className="flex items-center gap-3 text-body text-ink-500">
          <span className="size-4 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
          Memuat data usaha…
        </div>
      </OnboardingShell>
    )
  }

  // Sudah lengkap: tidak ada yang perlu dikerjakan di sini.
  if (status.complete) {
    return <Navigate to="/dashboard" replace />
  }

  const isLastStep = stepIndex === STEP_ORDER.length - 1
  const canSkip = SKIPPABLE.includes(currentStep) && !status.complete

  return (
    <OnboardingShell>
      <Stepper steps={status.steps} activeIndex={stepIndex} />

      <div className="mt-6">
        <p className="text-meta font-medium uppercase tracking-wide text-ink-400">
          Langkah {stepIndex + 1} dari {STEP_ORDER.length}
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 text-title tracking-tight text-ink-900 focus:outline-none"
        >
          {currentStep === 'business' && 'Konfirmasi usaha'}
          {currentStep === 'contact' && 'Kontak yang bisa dihubungi klien'}
          {currentStep === 'bank' && 'Rekening untuk pembayaran klien'}
        </h1>
        <p className="mt-1 text-body text-ink-500">
          {currentStep === 'business' &&
            'Data ini tampil di halaman publik dan invoice. Perbaiki bila ada yang keliru.'}
          {currentStep === 'contact' &&
            'Klien menghubungi nomor ini lewat tombol WhatsApp di invoice.'}
          {currentStep === 'bank' &&
            'Klien akan melihat nomor rekening ini di invoice. Tanpa rekening, invoice tidak bisa dibayar.'}
        </p>
      </div>

      {formError !== null ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-xl bg-rose-50 px-4 py-3 ring-1 ring-inset ring-rose-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-700" />
          <p className="text-body text-rose-900">{formError}</p>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {currentStep === 'business' ? (
          <>
            <Field
              id="businessName"
              label="Nama usaha"
              error={errors.business_name}
              errorId="businessName-error"
            >
              <input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className={inputClass(Boolean(errors.business_name))}
                aria-describedby={errors.business_name ? 'businessName-error' : undefined}
                autoComplete="organization"
              />
            </Field>

            <Field id="category" label="Kategori" error={errors.category} errorId="category-error">
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass(Boolean(errors.category))}
              >
                <option value="">Pilih kategori…</option>
                {VENDOR_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="city" label="Kota" error={errors.city} errorId="city-error">
              <input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass(Boolean(errors.city))}
                autoComplete="address-level2"
              />
            </Field>
          </>
        ) : null}

        {currentStep === 'contact' ? (
          <>
            <Field
              id="contactPhone"
              label="No. WhatsApp"
              hint="Contoh: 08123456789"
              error={errors.contact_phone}
              errorId="contactPhone-error"
              hintId="contactPhone-hint"
            >
              <input
                id="contactPhone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className={inputClass(Boolean(errors.contact_phone))}
                inputMode="tel"
                autoComplete="tel"
                aria-describedby={
                  errors.contact_phone ? 'contactPhone-error' : 'contactPhone-hint'
                }
              />
            </Field>

            <Field
              id="contactEmail"
              label="Email publik (opsional)"
              error={errors.contact_email}
              errorId="contactEmail-error"
            >
              <input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className={inputClass(Boolean(errors.contact_email))}
                autoComplete="email"
              />
            </Field>
          </>
        ) : null}

        {currentStep === 'bank' ? (
          <>
            <Field id="bankName" label="Nama bank" error={errors.bank_name} errorId="bankName-error">
              <input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className={inputClass(Boolean(errors.bank_name))}
                placeholder="BCA / Mandiri / BRI"
                autoComplete="off"
              />
            </Field>

            <Field
              id="bankNumber"
              label="Nomor rekening"
              hint="Hanya angka, 6–20 digit"
              error={errors.bank_account_number}
              errorId="bankNumber-error"
              hintId="bankNumber-hint"
            >
              <input
                id="bankNumber"
                value={bankNumber}
                onChange={(e) => setBankNumber(e.target.value)}
                className={inputClass(Boolean(errors.bank_account_number))}
                inputMode="numeric"
                autoComplete="off"
                aria-describedby={
                  errors.bank_account_number ? 'bankNumber-error' : 'bankNumber-hint'
                }
              />
            </Field>

            <Field
              id="bankHolder"
              label="Atas nama"
              error={errors.bank_account_holder}
              errorId="bankHolder-error"
            >
              <input
                id="bankHolder"
                value={bankHolder}
                onChange={(e) => setBankHolder(e.target.value)}
                className={inputClass(Boolean(errors.bank_account_holder))}
                autoComplete="off"
              />
            </Field>
          </>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {stepIndex > 0 ? (
            <Button variant="secondary" onClick={back} disabled={saving}>
              <ArrowLeft className="size-4" />
              Kembali
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {canSkip ? (
            /*
             * `secondary`, bukan `ghost`: tombol ini berdiri di atas kartu
             * putih. Varian `ghost` tidak punya latar, garis, atau bayangan
             * sehingga "Lewati" terbaca seperti teks biasa, bukan tombol.
             * `ghost` hanya dipakai untuk tombol di dalam modal.
             */
            <Button variant="secondary" onClick={skip} disabled={saving}>
              Lewati
            </Button>
          ) : null}

          {isLastStep ? (
            <Button onClick={goNext} disabled={saving}>
              {saving ? 'Menyimpan…' : 'Selesai'}
              <Check className="size-4" />
            </Button>
          ) : (
            <Button onClick={goNext} disabled={saving}>
              {saving ? 'Menyimpan…' : 'Lanjut'}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </OnboardingShell>
  )
}

/**
 * Kerangka halaman: tanpa sidebar, karena vendor belum boleh melihat menu penuh.
 *
 * `<main>` dipakai supaya seluruh isi berada di dalam satu landmark utama
 * (WCAG 1.3.1): tanpa itu axe menandai `landmark-one-main` dan `region` —
 * pembaca layar tidak punya cara melompat ke konten dan elemen-elemen di luar
 * landmark tidak bisa dijangkau lewat navigasi landmark.
 */
function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-50 px-4 py-10 sm:py-16">
      <main className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-400 text-body font-semibold text-ink-900">
            BV
          </span>
          <span className="text-body font-semibold text-ink-900">Booking Vendor</span>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-200 sm:p-7">{children}</div>
      </main>
    </div>
  )
}

/** Indikator langkah; memakai daftar bernomor, bukan tablist (bukan navigasi bebas). */
function Stepper({ steps, activeIndex }: { steps: OnboardingStep[]; activeIndex: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progres onboarding">
      {steps.map((step, index) => {
        const done = step.complete && index < activeIndex
        const active = index === activeIndex

        return (
          <li key={step.key} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold',
                done && 'bg-emerald-100 text-emerald-800',
                active && 'bg-brand-400 text-ink-900',
                !done && !active && 'bg-ink-100 text-ink-500',
              )}
              aria-hidden="true"
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>

            <span
              className={cn(
                'truncate text-caption',
                active ? 'font-semibold text-ink-900' : 'text-ink-500',
              )}
            >
              {step.label}
              {step.required ? <span className="text-rose-700"> *</span> : null}
            </span>

            {index < steps.length - 1 ? (
              <span className="h-px flex-1 bg-ink-200" aria-hidden="true" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
