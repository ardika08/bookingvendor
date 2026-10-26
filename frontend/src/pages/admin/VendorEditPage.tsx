import { ArrowLeft, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card'
import { Field, FormSection, inputClass, textareaClass } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { getMockAdminVendor, setMockAdminVendorActive, updateMockAdminVendor } from '@/lib/mock/admin'
import { VENDOR_CATEGORIES } from '@/lib/vendor-profile'

/**
 * Form edit vendor (`/admin/vendors/:id/edit`).
 *
 * Admin memperbarui profil usaha vendor (PRD: "memperbarui profil vendor").
 * Email akun Google sengaja tidak bisa diubah — itu identitas login, bukan
 * data profil; kalau vendor minta ganti akun, itu urusan akun baru.
 *
 * Zona nonaktif ada di halaman ini (bukan detail) karena keputusan
 * menonaktifkan biasanya diambil saat meninjau lalu memperbaiki data vendor.
 */

interface VendorEditValues {
  name: string
  ownerName: string
  category: string
  city: string
  description: string
  contact: string
}

type VendorEditErrors = Partial<Record<keyof VendorEditValues, string>>

export function VendorEditPage() {
  const { vendorId = '' } = useParams()
  const navigate = useNavigate()
  const { notify } = useToast()
  const formRef = useRef<HTMLFormElement>(null)

  const [current, setCurrent] = useState(() => getMockAdminVendor(vendorId))
  const [values, setValues] = useState<VendorEditValues>(() => ({
    name: current?.name ?? '',
    ownerName: current?.ownerName ?? '',
    category: current?.category ?? '',
    city: current?.city ?? '',
    description: current?.description ?? '',
    contact: current?.contact ?? '',
  }))
  const [errors, setErrors] = useState<VendorEditErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  if (current === null) {
    return (
      <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-16 text-center">
        <ShieldCheck className="mx-auto size-6 text-ink-400" />
        <h2 className="mt-3 text-base font-semibold text-ink-900">Vendor tidak ditemukan</h2>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-500">
          Vendor mungkin sudah dihapus atau tautannya tidak berlaku.
        </p>
        <Link
          to="/admin/vendors"
          className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-[13px] font-medium text-ink-700 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50"
        >
          <ArrowLeft className="size-3.5" /> Kembali ke daftar vendor
        </Link>
      </div>
    )
  }

  function update<K extends keyof VendorEditValues>(key: K, value: VendorEditValues[K]) {
    const next = { ...values, [key]: value }
    setValues(next)
    if (submitted) setErrors(validate(next))
  }

  function validate(valuesToCheck: VendorEditValues): VendorEditErrors {
    const errors: VendorEditErrors = {}

    if (!valuesToCheck.name.trim()) {
      errors.name = 'Nama usaha wajib diisi.'
    } else if (valuesToCheck.name.trim().length < 2) {
      errors.name = 'Nama usaha terlalu pendek.'
    }

    if (!valuesToCheck.ownerName.trim()) {
      errors.ownerName = 'Nama pemilik wajib diisi.'
    }

    if (!valuesToCheck.category) {
      errors.category = 'Pilih kategori usaha.'
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
      const updated = updateMockAdminVendor(vendorId, {
        name: values.name.trim(),
        ownerName: values.ownerName.trim(),
        category: values.category,
        city: values.city.trim(),
        description: values.description.trim(),
        contact: values.contact.trim(),
      })

      if (updated) setCurrent(updated)
      notify('Perubahan profil vendor tersimpan.', { tone: 'success' })
    } finally {
      setSaving(false)
    }
  }

  function handleToggleActive() {
    // Function declaration di-hoist, jadi narrowing `current` tidak berlaku di sini.
    if (current === null) return
    const updated = setMockAdminVendorActive(vendorId, !current.isActive)
    if (updated) setCurrent(updated)
    notify(
      updated?.isActive
        ? `"${updated.name}" diaktifkan kembali.`
        : `"${updated?.name}" dinonaktifkan — vendor tidak bisa masuk sementara data tetap utuh.`,
      { tone: 'success' },
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to={`/admin/vendors/${vendorId}`}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="size-3.5" />
          Detail vendor
        </Link>
        <span
          className={
            current.isActive
              ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200'
              : 'rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-medium text-ink-500'
          }
        >
          {current.isActive ? 'Akun aktif' : 'Akun nonaktif'}
        </span>
      </div>

      <Card>
        <CardHeader
          title="Identitas Usaha"
          description="Email akun Google tidak bisa diubah — itu identitas login vendor."
        />
        <CardBody>
          <FormSection title="">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="editVendorName" label="Nama usaha" required error={errors.name}>
                <input
                  id="editVendorName"
                  data-field="name"
                  value={values.name}
                  onChange={(event) => update('name', event.target.value)}
                  className={inputClass(Boolean(errors.name))}
                />
              </Field>

              <Field
                id="editOwnerName"
                label="Nama pemilik"
                required
                error={errors.ownerName}
              >
                <input
                  id="editOwnerName"
                  data-field="ownerName"
                  value={values.ownerName}
                  onChange={(event) => update('ownerName', event.target.value)}
                  className={inputClass(Boolean(errors.ownerName))}
                />
              </Field>

              <Field id="editCategory" label="Kategori" required error={errors.category}>
                <select
                  id="editCategory"
                  data-field="category"
                  value={values.category}
                  onChange={(event) => update('category', event.target.value)}
                  className={inputClass(Boolean(errors.category))}
                >
                  <option value="">Pilih kategori</option>
                  {VENDOR_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </Field>

              <Field id="editCity" label="Kota / wilayah" error={errors.city}>
                <input
                  id="editCity"
                  data-field="city"
                  value={values.city}
                  onChange={(event) => update('city', event.target.value)}
                  className={inputClass(Boolean(errors.city))}
                />
              </Field>

              <Field
                id="editOwnerEmail"
                label="Email akun Google"
                hint="Tidak bisa diubah oleh admin."
                className="sm:col-span-2"
              >
                <input
                  id="editOwnerEmail"
                  value={current.email}
                  disabled
                  className={`${inputClass(false)} bg-ink-50 text-ink-500`}
                />
              </Field>

              <Field id="editContact" label="Kontak / WhatsApp" error={errors.contact}>
                <input
                  id="editContact"
                  data-field="contact"
                  value={values.contact}
                  onChange={(event) => update('contact', event.target.value)}
                  placeholder="0812-3456-7890"
                  className={inputClass(Boolean(errors.contact))}
                />
              </Field>
            </div>
          </FormSection>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Deskripsi" description="Tampil di profil publik vendor." />
        <CardBody>
          <Field id="editDescription" label="Deskripsi singkat" error={errors.description}>
            <textarea
              id="editDescription"
              data-field="description"
              value={values.description}
              onChange={(event) => update('description', event.target.value)}
              rows={3}
              className={textareaClass(Boolean(errors.description))}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardFooter className="sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/admin/vendors/${vendorId}`)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan perubahan'}
          </Button>
        </CardFooter>
      </Card>

      <Card className={current.isActive ? 'border-rose-200' : 'border-emerald-200'}>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className={cnStatusIcon(current.isActive)}
              aria-hidden
            />
            <div>
              <p className="text-[13px] font-semibold text-ink-900">
                {current.isActive ? 'Nonaktifkan akun vendor' : 'Aktifkan kembali akun vendor'}
              </p>
              <p className="mt-0.5 max-w-md text-[12px] leading-relaxed text-ink-500">
                {current.isActive
                  ? 'Vendor tidak bisa masuk dan link publiknya ditutup. Data booking, invoice, dan langganannya tetap utuh — nonaktif bukan hapus.'
                  : 'Vendor bisa masuk kembali dan link publiknya dibuka. Langganan tidak berubah.'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant={current.isActive ? 'secondary' : 'primary'}
            onClick={handleToggleActive}
            className="shrink-0"
          >
            {current.isActive ? 'Nonaktifkan' : 'Aktifkan kembali'}
          </Button>
        </CardBody>
      </Card>
    </form>
  )
}

function cnStatusIcon(isActive: boolean): string {
  return [
    'mt-0.5 size-4 shrink-0',
    isActive ? 'text-rose-500' : 'text-emerald-600',
  ].join(' ')
}
