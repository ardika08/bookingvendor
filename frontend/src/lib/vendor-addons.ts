import { formatThousands, parseThousands } from './vendor-packages'

export interface Addon { id: string; name: string; price: number; active: boolean }
export interface AddonFormValues { name: string; price: string; active: boolean }
export interface PackageAddonSelection { addonId: string; price: number; overridePrice: string }
export interface PackageAddonPayload { addon_id: string; price: number }

export function addonToFormValues(addon: Addon): AddonFormValues {
  return { name: addon.name, price: formatThousands(addon.price), active: addon.active }
}
export function validateAddonForm(values: AddonFormValues): Partial<Record<keyof AddonFormValues, string>> {
  const errors: Partial<Record<keyof AddonFormValues, string>> = {}
  if (!values.name.trim()) errors.name = 'Nama tambahan wajib diisi.'
  if (!values.price.trim()) errors.price = 'Harga tambahan wajib diisi.'
  else if (parseThousands(values.price) <= 0) errors.price = 'Harga harus lebih besar dari nol.'
  return errors
}
export function toAddonPayload(values: AddonFormValues) {
  return { name: values.name.trim(), price: parseThousands(values.price), active: values.active }
}
export function toPackageAddonPayload(values: PackageAddonSelection[]): PackageAddonPayload[] {
  return values.map((v) => ({ addon_id: v.addonId, price: v.overridePrice.trim() ? parseThousands(v.overridePrice) : v.price }))
}
