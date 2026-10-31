import { IdCard, Mail, Phone, User } from '@/components/ui/icons'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card'
import { Field, FormSection, inputClass } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { fetchUserAccount, saveUserAccount, type UserAccount } from '@/lib/api/user-account'
import { ApiError } from '@/lib/api/client'
import { initials } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Halaman akun pengguna ("Akun Saya") — tersedia untuk vendor & admin.
 *
 * Akun = baris `users`: nama, email, dan nomor HP. Berbeda dari `/pengaturan`
 * yang mengelola profil usaha vendor.
 *
 * SUMBER DATA
 * Sebelumnya halaman ini membaca `lib/mock/user-account`, sehingga menampilkan
 * data karangan ("Dika Pratama", `dika@lumenwedding.id`, `0812-9000-1122`) —
 * tidak ada hubungannya dengan akun yang sedang masuk, dan berbeda dari yang
 * diisi saat pendaftaran. Sekarang memakai `GET/PUT /api/user/profile`.
 *
 * Email tidak bisa diubah karena menjadi identitas login (dulu dari Google,
 * sekarang dari pendaftaran). Foto profil opsional — bila kosong, inisial nama
 * yang ditampilkan.
 */
export function AccountProfilePage() {
  const { notify } = useToast()
  const formRef = useRef<HTMLFormElement>(null)

  const [account, setAccount] = useState<UserAccount | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [values, setValues] = useState({ name: '', phone: '' })
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    fetchUserAccount(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setAccount(data)
        setValues({ name: data.name ?? '', phone: data.phone ?? '' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(
          error instanceof ApiError
            ? error.message
            : 'Tidak dapat memuat data akun. Coba muat ulang halaman.',
        )
      })

    return () => {
      controller.abort()
    }
  }, [])

  function update(key: 'name' | 'phone', value: string) {
    const next = { ...values, [key]: value }
    setValues(next)
    if (submitted) setErrors(validate(next))
  }

  function validate(next: { name: string; phone: string }): { name?: string; phone?: string } {
    const errors: { name?: string; phone?: string } = {}

    if (!next.name.trim()) {
      errors.name = 'Nama wajib diisi.'
    } else if (next.name.trim().length < 2) {
      errors.name = 'Nama terlalu pendek.'
    }

    const phone = next.phone.trim()
    if (phone && !/^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(phone.replace(/[\s\-().]/g, ''))) {
      errors.phone = 'Format nomor tidak valid. Contoh: 08123456789.'
    }

    return errors
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)

    const nextErrors = validate(values)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      const first = Object.keys(nextErrors)[0]
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
      return
    }

    setSaving(true)
    try {
      const saved = await saveUserAccount({
        name: values.name.trim(),
        phone: values.phone.trim() || null,
      })

      setAccount(saved)
      setValues({ name: saved.name ?? '', phone: saved.phone ?? '' })
      notify('Profil akun tersimpan.', { tone: 'success' })
    } catch (error) {
      if (error instanceof ApiError) {
        // Error per field dari validasi Laravel dipetakan ke input terkait.
        const fieldErrors: { name?: string; phone?: string } = {}
        if (error.fieldErrors.name) fieldErrors.name = error.fieldErrors.name
        if (error.fieldErrors.phone) fieldErrors.phone = error.fieldErrors.phone

        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors)
        } else {
          notify(error.message, { tone: 'error' })
        }
      } else {
        notify('Gagal menyimpan. Periksa koneksi lalu coba lagi.', { tone: 'error' })
      }
    } finally {
      setSaving(false)
    }
  }

  // Kerangka selama data dimuat: menjaga tata letak tidak melompat.
  if (account === null) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-title tracking-tight text-ink-900">Akun Saya</h1>
          <p className="mt-0.5 text-body text-ink-500">
            Nama &amp; kontak akun — berbeda dari profil usaha di menu Pengaturan.
          </p>
        </div>

        {loadError ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-meta leading-relaxed text-rose-800"
          >
            {loadError}
          </div>
        ) : (
          <Card>
            <CardBody>
              <div className="h-14 w-full animate-pulse rounded-lg bg-ink-100" />
            </CardBody>
          </Card>
        )}
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <h1 className="text-title tracking-tight text-ink-900">Akun Saya</h1>
        <p className="mt-0.5 text-body text-ink-500">
          Nama &amp; kontak akun — berbeda dari profil usaha di menu Pengaturan.
        </p>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-lead font-semibold text-brand-700">
            {account.avatarUrl ? (
              <img src={account.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              initials(account.name)
            )}
          </span>
          <div className="min-w-0">
            <p className="text-lead font-semibold text-ink-900">{account.name}</p>
            <p className="mt-0.5 text-meta text-ink-500">{account.email}</p>
            <p className="mt-1 flex items-center gap-1 text-caption text-ink-400">
              <IdCard className="size-3.5" />
              {account.role === 'admin' ? 'Peran: Admin' : 'Peran: Vendor'}
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Data Akun"
          description="Email dipakai untuk masuk dan tidak bisa diubah di sini."
        />
        <CardBody>
          <FormSection title="">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="accountName" label="Nama" required error={errors.name}>
                <input
                  id="accountName"
                  data-field="name"
                  value={values.name}
                  onChange={(event) => update('name', event.target.value)}
                  autoComplete="name"
                  className={inputClass(Boolean(errors.name))}
                />
              </Field>

              <Field id="accountEmail" label="Email" hint="Tidak dapat diubah — dipakai untuk masuk.">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
                  <input
                    id="accountEmail"
                    value={account.email}
                    disabled
                    className={cn(inputClass(false), 'bg-ink-50 pl-9 text-ink-500')}
                  />
                </div>
              </Field>

              <Field
                id="accountPhone"
                label="Nomor HP"
                error={errors.phone}
                hint="Opsional — dipakai untuk kontak penting akun."
              >
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
                  <input
                    id="accountPhone"
                    data-field="phone"
                    value={values.phone}
                    onChange={(event) => update('phone', event.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="08123456789"
                    className={cn(inputClass(Boolean(errors.phone)), 'pl-9')}
                  />
                </div>
              </Field>
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-caption leading-relaxed text-sky-900">
              <User className="mt-0.5 size-3.5 shrink-0" />
              Nama di sini adalah nama pemilik akun. Nama usaha diatur di menu Pengaturan.
            </p>
          </FormSection>
        </CardBody>
      </Card>

      <Card>
        <CardFooter className="sm:justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan akun'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
