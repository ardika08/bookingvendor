import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card'
import { Field, FormSection, inputClass } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { addMockAdminVendor } from '@/lib/mock/admin'
import { VENDOR_CATEGORIES } from '@/lib/vendor-profile'

/**
 * Form tambah vendor (`/admin/vendors/new`).
 *
 * Admin mendaftarkan vendor baru dengan akun Google yang sudah ditentukan
 * (PRD: tidak ada registrasi publik). Vendor baru langsung mendapat masa
 * trial 2 booking + 2 invoice tanpa perlu verifikasi.
 *
 * Fase frontend: submit menyimpan ke state mock; begitu API admin tersedia,
 * `addMockAdminVendor` diganti panggilan `POST /api/admin/vendors`.
 */

interface VendorCreateValues {
  name: string
  ownerName: string
  email: string
  category: string
  city: string
}

type VendorCreateErrors = Partial<Record<keyof VendorCreateValues, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function VendorCreatePage() {
  const navigate = useNavigate()
  const { notify } = useToast()
  const formRef = useRef<HTMLFormElement>(null)

  const [values, setValues] = useState<VendorCreateValues>({
    name: '',
    ownerName: '',
    email: '',
    category: '',
    city: '',
  })
  const [errors, setErrors] = useState<VendorCreateErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof VendorCreateValues>(key: K, value: VendorCreateValues[K]) {
    const next = { ...values, [key]: value }
    setValues(next)
    if (submitted) setErrors(validate(next))
  }

  function validate(valuesToCheck: VendorCreateValues): VendorCreateErrors {
    const errors: VendorCreateErrors = {}

    if (!valuesToCheck.name.trim()) {
      errors.name = 'Nama usaha wajib diisi.'
    } else if (valuesToCheck.name.trim().length < 2) {
      errors.name = 'Nama usaha terlalu pendek.'
    }

    if (!valuesToCheck.ownerName.trim()) {
      errors.ownerName = 'Nama pemilik wajib diisi.'
    }

    if (!valuesToCheck.email.trim()) {
      errors.email = 'Email akun Google wajib diisi.'
    } else if (!EMAIL_PATTERN.test(valuesToCheck.email.trim())) {
      errors.email = 'Format email tidak valid.'
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
      addMockAdminVendor({
        name: values.name.trim(),
        ownerName: values.ownerName.trim(),
        email: values.email.trim(),
        category: values.category,
        city: values.city.trim(),
      })

      notify(`Vendor "${values.name.trim()}" ditambahkan — akun siap dengan masa trial.`, {
        tone: 'success',
      })
      navigate('/admin/vendors')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">Tambah Vendor</h2>
          <p className="mt-0.5 text-[13px] text-ink-500">
            Vendor langsung aktif dengan masa trial — tanpa proses verifikasi.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Akun Pemilik"
          description="Dipakai vendor untuk masuk lewat akun Google."
        />
        <CardBody>
          <FormSection title="">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="ownerName" label="Nama pemilik" required error={errors.ownerName}>
                <input
                  id="ownerName"
                  data-field="ownerName"
                  value={values.ownerName}
                  onChange={(event) => update('ownerName', event.target.value)}
                  placeholder="Dika Pratama"
                  className={inputClass(Boolean(errors.ownerName))}
                />
              </Field>

              <Field
                id="vendorEmail"
                label="Email akun Google"
                required
                error={errors.email}
                hint="Harus akun Google — login memakai akun ini."
              >
                <input
                  id="vendorEmail"
                  data-field="email"
                  type="email"
                  value={values.email}
                  onChange={(event) => update('email', event.target.value)}
                  placeholder="vendor@gmail.com"
                  className={inputClass(Boolean(errors.email))}
                />
              </Field>
            </div>
          </FormSection>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Identitas Usaha" description="Tampil di jadwal & halaman publik." />
        <CardBody>
          <FormSection title="">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="vendorName" label="Nama usaha" required error={errors.name}>
                <input
                  id="vendorName"
                  data-field="name"
                  value={values.name}
                  onChange={(event) => update('name', event.target.value)}
                  placeholder="Lumen Wedding Story"
                  className={inputClass(Boolean(errors.name))}
                />
              </Field>

              <Field id="vendorCategory" label="Kategori" required error={errors.category}>
                <select
                  id="vendorCategory"
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

              <Field id="vendorCity" label="Kota / wilayah" error={errors.city}>
                <input
                  id="vendorCity"
                  data-field="city"
                  value={values.city}
                  onChange={(event) => update('city', event.target.value)}
                  placeholder="Jakarta Selatan"
                  className={inputClass(Boolean(errors.city))}
                />
              </Field>
            </div>
          </FormSection>
        </CardBody>
      </Card>

      <Card>
        <CardFooter className="sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/admin/vendors')}
            disabled={saving}
          >
            Batal
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Tambah vendor'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
