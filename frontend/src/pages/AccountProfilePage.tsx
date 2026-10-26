import { IdCard, Mail, Phone, User } from 'lucide-react'
import { useRef, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card'
import { Field, FormSection, inputClass } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { getUserAccount, updateUserAccount } from '@/lib/mock/user-account'
import { initials } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { CurrentUser } from '@/types/booking'

/**
 * Halaman akun pengguna ("Akun Saya") — tersedia untuk vendor & admin.
 *
 * Akun = baris `users`: nama, email Google, dan nomor HP. Berbeda dari
 * `/settings` yang mengelola profil usaha vendor. Email tidak bisa diedit —
 * identitas OAuth; foto profil juga diambil dari Google saat login (PRD).
 *
 * Halaman yang sama dipasang di dua layout (vendor & admin): dibaca dari
 * outlet context, peran menentukan data mock akun mana yang dimuat.
 */
export function AccountProfilePage() {
  const { user } = useOutletContext<{ user: CurrentUser }>()
  const { notify } = useToast()
  const formRef = useRef<HTMLFormElement>(null)

  const initial = useMemo(() => getUserAccount(user.role), [user.role])
  const [values, setValues] = useState(() => ({
    name: initial.name,
    phone: initial.phone ?? '',
  }))
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

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
      updateUserAccount(user.role, {
        name: values.name.trim(),
        phone: values.phone.trim() || null,
      })
      notify('Profil akun tersimpan.', { tone: 'success' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">Akun Saya</h2>
        <p className="mt-0.5 text-[13px] text-ink-500">
          Nama &amp; kontak akun — berbeda dari profil usaha di menu Pengaturan.
        </p>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[17px] font-semibold text-brand-700">
            {initial.avatarUrl ? (
              <img src={initial.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              initials(initial.name)
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink-900">{initial.name}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-500">{initial.email}</p>
            <p className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-400">
              <IdCard className="size-3.5" />
              {user.role === 'admin' ? 'Peran: Admin' : 'Peran: Vendor'}
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Data Akun"
          description="Email & foto diambil dari akun Google dan tidak bisa diedit di sini."
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
                  className={inputClass(Boolean(errors.name))}
                />
              </Field>

              <Field
                id="accountEmail"
                label="Email (Google)"
                hint="Tidak dapat diubah — berasal dari login Google."
              >
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
                  <input
                    id="accountEmail"
                    value={initial.email}
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
                    placeholder="08123456789"
                    className={cn(inputClass(Boolean(errors.phone)), 'pl-9')}
                  />
                </div>
              </Field>
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11.5px] leading-relaxed text-sky-900">
              <User className="mt-0.5 size-3.5 shrink-0" />
              Foto profil tampil otomatis dari akun Google yang dipakai masuk.
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
