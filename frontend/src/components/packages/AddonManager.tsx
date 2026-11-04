import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, inputClass } from '@/components/ui/Field'
import { formatCurrency } from '@/lib/format'
import { formatThousands, parseThousands } from '@/lib/vendor-packages'
import { addonToFormValues, toAddonPayload, validateAddonForm, type Addon, type AddonFormValues } from '@/lib/vendor-addons'
import { createAddon, deleteAddon, fetchAddons, updateAddon } from '@/lib/api/vendor-addons'

const empty: AddonFormValues = { name: '', price: '', active: true }
export function AddonManager({ onChanged }: { onChanged?: (addons: Addon[]) => void }) {
  const [addons, setAddons] = useState<Addon[]>([])
  const [editing, setEditing] = useState<Addon | null>(null)
  const [values, setValues] = useState<AddonFormValues>(empty)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const load = () => fetchAddons().then((items) => { setAddons(items); onChanged?.(items) }).catch((e: Error) => setError(e.message))
  useEffect(() => { load() }, [])
  async function save(event: React.FormEvent) {
    event.preventDefault(); const errors = validateAddonForm(values)
    if (Object.keys(errors).length) { setError(Object.values(errors)[0] ?? 'Periksa isian.'); return }
    setSaving(true); setError('')
    try { const result = editing ? await updateAddon(editing.id, toAddonPayload(values)) : await createAddon(toAddonPayload(values)); setAddons((old) => editing ? old.map((a) => a.id === result.id ? result : a) : [...old, result]); setEditing(null); setValues(empty) } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menyimpan tambahan.') } finally { setSaving(false) }
  }
  return <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
    <div className="rounded-xl border border-ink-200 bg-white">
      <div className="border-b border-ink-100 px-4 py-3"><h2 className="font-semibold text-ink-900">Tambahan</h2><p className="text-meta text-ink-500">Layanan opsional untuk paket.</p></div>
      <div className="divide-y divide-ink-100">{addons.length ? addons.map((addon) => <div className="flex items-center gap-3 px-4 py-3" key={addon.id}><div className="min-w-0 flex-1"><p className="font-medium text-ink-800">{addon.name}</p><p className="text-meta text-ink-500">{formatCurrency(addon.price)} · {addon.active ? 'Aktif' : 'Nonaktif'}</p></div><Button size="sm" variant="secondary" onClick={() => { setEditing(addon); setValues(addonToFormValues(addon)); setError('') }}>Edit</Button><button className="text-meta text-rose-600" onClick={() => void deleteAddon(addon.id).then(() => setAddons((old) => old.filter((a) => a.id !== addon.id))).catch((e: Error) => setError(e.message))}>Hapus</button></div>) : <p className="px-4 py-8 text-body text-ink-500">Belum ada tambahan.</p>}</div>
    </div>
    <form className="rounded-xl border border-ink-200 bg-white p-4" onSubmit={save}><h2 className="font-semibold text-ink-900">{editing ? 'Edit tambahan' : 'Tambahan baru'}</h2><div className="mt-3 space-y-3"><Field id="addon-name" label="Nama" required><input id="addon-name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className={inputClass(false)} /></Field><Field id="addon-price" label="Harga" required><input id="addon-price" value={values.price} inputMode="numeric" onChange={(e) => setValues({ ...values, price: formatThousands(parseThousands(e.target.value)) })} className={inputClass(false)} /></Field><label className="flex gap-2 text-meta text-ink-700"><input type="checkbox" checked={values.active} onChange={(e) => setValues({ ...values, active: e.target.checked })} /> Aktif</label></div>{error && <p className="mt-3 text-meta text-rose-700">{error}</p>}<div className="mt-4 flex gap-2"><Button type="submit" size="sm" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>{editing && <Button type="button" size="sm" variant="secondary" onClick={() => { setEditing(null); setValues(empty); setError('') }}>Batal</Button>}</div></form>
  </div>
}
