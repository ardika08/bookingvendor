import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Crown, LoaderCircle } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { Field, inputClass } from '@/components/ui/Field'
import { ApiError } from '@/lib/api/client'
import {
  fetchRegistrationCategories,
  registerVendor,
  type RegistrationCategory,
} from '@/lib/api/register'
import { cn } from '@/lib/cn'

/**
 * Halaman pendaftaran vendor (`/daftar`).
 *
 * Satu-satunya pintu masuk publik: calon vendor mengisi data usahanya lalu
 * langsung memakai aplikasi dengan masa uji 30 hari. Tanpa persetujuan admin,
 * sesuai keputusan produk untuk mengumpulkan vendor lebih dulu.
 *
 * Field sengaja sedikit (lima) karena setiap tambahan menurunkan konversi.
 * Data lain (rekening, deskripsi, alamat) dilengkapi nanti lewat pengaturan.
 */

interface FormValues {
  ownerName: string
  vendorName: string
  categoryId: string
  categoryOther: string
  phone: string
  email: string
  password: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const INITIAL: FormValues = {
  ownerName: '',
  vendorName: '',
  categoryId: '',
  categoryOther: '',
  phone: '',
  email: '',
  password: '',
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<RegistrationCategory[]>([])
  const [values, setValues] = useState<FormValues>(INITIAL)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [categoriesError, setCategoriesError] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    let active = true

    fetchRegistrationCategories()
      .then((list) => {
        if (active) setCategories(list)
      })
      .catch(() => {
        if (active) setCategoriesError(true)
      })

    return () => {
      active = false
    }
  }, [])

  const selectedCategory = categories.find((item) => item.id === values.categoryId)
  const needsOther = selectedCategory?.isOther === true

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    const next = { ...values, [key]: value }
    setValues(next)
    if (submitted) setErrors(validate(next, needsOther))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setSubmitError(null)

    const nextErrors = validate(values, needsOther)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      const first = Object.keys(nextErrors)[0] as keyof FormValues
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
      return
    }

    void submit()
  }

  async function submit() {
    setSaving(true)

    try {
      await registerVendor({
        owner_name: values.ownerName.trim(),
        vendor_name: values.vendorName.trim(),
        category_id: values.categoryId,
        category_other: needsOther ? values.categoryOther.trim() : undefined,
        phone: values.phone.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
      })

      // Server sudah membuat sesi; pindah ke dashboard tanpa reload penuh.
      navigate('/dashboard', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors

        if (Object.keys(fieldErrors).length > 0) {
          setErrors(mapServerErrors(fieldErrors))
        }

        setSubmitError(error.message)
      } else {
        setSubmitError('Terjadi kesalahan tak terduga. Coba lagi.')
      }
    } finally {
      setSaving(false)
    }
  }

  const errorCount = Object.keys(errors).length

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-brand-400 text-lead font-bold text-ink-900">
            VK
          </span>
          <h1 className="mt-3 text-title tracking-tight text-ink-900">Daftar sebagai vendor</h1>
          <p className="mt-1 text-body text-ink-500">
            Coba semua fitur gratis 30 hari. Tanpa kartu kredit, tanpa biaya di awal.
          </p>
        </div>

        <div className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-sm sm:p-6">
          {categoriesError ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <p className="text-meta text-rose-900">
                Gagal memuat daftar kategori. Muat ulang halaman ini.
              </p>
            </div>
          ) : null}

          {submitted && errorCount > 0 ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <p className="text-meta text-rose-900">
                {errorCount} isian perlu diperbaiki sebelum bisa mendaftar.
              </p>
            </div>
          ) : null}

          {submitError ? (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <p className="text-meta text-rose-900">{submitError}</p>
            </div>
          ) : null}

          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-3.5">
            <Field id="ownerName" label="Nama pemilik" required error={errors.ownerName}>
              <input
                id="ownerName"
                data-field="ownerName"
                value={values.ownerName}
                onChange={(event) => update('ownerName', event.target.value)}
                autoComplete="name"
                placeholder="Nama lengkap kamu"
                className={inputClass(Boolean(errors.ownerName))}
              />
            </Field>

            <Field id="vendorName" label="Nama vendor" required error={errors.vendorName}>
              <input
                id="vendorName"
                data-field="vendorName"
                value={values.vendorName}
                onChange={(event) => update('vendorName', event.target.value)}
                autoComplete="organization"
                placeholder="Nama usaha yang dilihat klien"
                className={inputClass(Boolean(errors.vendorName))}
              />
            </Field>

            <Field
              id="categoryId"
              label="Kategori vendor"
              required
              error={errors.categoryId}
              hint="Pilih yang paling dekat. Bisa diubah nanti."
            >
              <select
                id="categoryId"
                data-field="categoryId"
                value={values.categoryId}
                onChange={(event) => update('categoryId', event.target.value)}
                className={inputClass(Boolean(errors.categoryId))}
              >
                <option value="">Pilih kategori…</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>

            {needsOther ? (
              <Field
                id="categoryOther"
                label="Sebutkan kategori kamu"
                required
                error={errors.categoryOther}
              >
                <input
                  id="categoryOther"
                  data-field="categoryOther"
                  value={values.categoryOther}
                  onChange={(event) => update('categoryOther', event.target.value)}
                  placeholder="Mis. Wedding Car, Undangan Digital"
                  className={inputClass(Boolean(errors.categoryOther))}
                />
              </Field>
            ) : null}

            <Field
              id="phone"
              label="Nomor WhatsApp"
              required
              error={errors.phone}
              hint="Dipakai klien untuk menghubungi kamu dari invoice."
            >
              <input
                id="phone"
                data-field="phone"
                type="tel"
                inputMode="tel"
                value={values.phone}
                onChange={(event) => update('phone', event.target.value)}
                autoComplete="tel"
                placeholder="0812 3456 7890"
                className={cn(inputClass(Boolean(errors.phone)), 'tabular-nums')}
              />
            </Field>

            <Field
              id="email"
              label="Email Gmail"
              required
              error={errors.email}
              hint="Wajib @gmail.com — dipakai untuk notifikasi pendaftaran dan tagihan."
            >
              <input
                id="email"
                data-field="email"
                type="email"
                value={values.email}
                onChange={(event) => update('email', event.target.value)}
                autoComplete="email"
                placeholder="nama@gmail.com"
                className={inputClass(Boolean(errors.email))}
              />
            </Field>

            <Field id="password" label="Kata sandi" required error={errors.password}>
              <input
                id="password"
                type="password"
                value={values.password}
                onChange={(event) => update('password', event.target.value)}
                autoComplete="new-password"
                minLength={8}
                placeholder="Minimal 8 karakter"
                className={inputClass(Boolean(errors.password))}
              />
            </Field>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin" />
                  Mendaftar…
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Daftar &amp; mulai gratis
                </>
              )}
            </Button>
          </form>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-50/70 px-3.5 py-2.5">
            <Crown className="mt-0.5 size-4 shrink-0 text-brand-700" />
            <p className="text-caption leading-relaxed text-ink-700">
              <span className="font-semibold text-ink-900">Semua fitur terbuka 30 hari.</span>{' '}
              Booking, invoice, link jadwal publik, tanpa batas jumlah.
            </p>
          </div>

          <div className="mt-5 border-t border-ink-100 pt-4 text-center">
            <p className="text-meta text-ink-500">
              Sudah punya akun?{' '}
              <Link to="/login" className="font-medium text-brand-700 hover:underline">
                Masuk
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-meta font-medium text-ink-500 hover:text-ink-800"
          >
            <ArrowLeft className="size-3.5" />
            Kembali ke halaman masuk
          </Link>
        </div>
      </div>
    </main>
  )
}

/** Validasi lokal — pesan langsung di bawah input, tanpa menunggu server. */
function validate(values: FormValues, needsOther: boolean): FormErrors {
  const errors: FormErrors = {}

  if (!values.ownerName.trim()) {
    errors.ownerName = 'Nama pemilik wajib diisi.'
  }

  if (!values.vendorName.trim()) {
    errors.vendorName = 'Nama vendor wajib diisi.'
  }

  if (!values.categoryId) {
    errors.categoryId = 'Kategori vendor wajib dipilih.'
  }

  if (needsOther && !values.categoryOther.trim()) {
    errors.categoryOther = 'Sebutkan kategori usaha kamu.'
  }

  const digits = values.phone.replace(/\D/g, '')
  if (!values.phone.trim()) {
    errors.phone = 'Nomor WhatsApp wajib diisi.'
  } else if (digits.length < 9) {
    errors.phone = 'Nomor WhatsApp terlalu pendek.'
  }

  const email = values.email.trim().toLowerCase()
  if (!email) {
    errors.email = 'Email wajib diisi.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Format email tidak valid.'
  }

  if (!values.password) {
    errors.password = 'Kata sandi wajib diisi.'
  } else if (values.password.length < 8) {
    errors.password = 'Kata sandi minimal 8 karakter.'
  }

  return errors
}

/** Peta nama field API → field form. */
const SERVER_FIELD_MAP: Record<string, keyof FormErrors> = {
  owner_name: 'ownerName',
  vendor_name: 'vendorName',
  category_id: 'categoryId',
  category_other: 'categoryOther',
  phone: 'phone',
  email: 'email',
  password: 'password',
}

function mapServerErrors(fieldErrors: Record<string, string>): FormErrors {
  const result: FormErrors = {}

  for (const [field, message] of Object.entries(fieldErrors)) {
    const key = SERVER_FIELD_MAP[field]
    if (key) result[key] = message
  }

  return result
}
