import assert from 'node:assert/strict'
import { fetchVendorProfile, updateVendorProfile } from '../src/lib/api/vendor-profile.ts'

/** Pastikan rekening dari profil mock tersedia bagi halaman invoice. */

async function run() {
  const current = await fetchVendorProfile()
  const updated = await updateVendorProfile({
    business_name: current.businessName,
    category: current.category,
    description: current.description,
    contact_phone: current.contactPhone,
    contact_email: current.contactEmail,
    city: current.city,
    bank: {
      name: 'BCA',
      account_number: '1234567890',
      account_holder: 'Lumen Wedding Story',
    },
  })

  assert.equal(updated.bank.name, 'BCA')
  const saved = await fetchVendorProfile()
  assert.equal(saved.bank.accountNumber, '1234567890')
  assert.equal(saved.bank.accountHolder, 'Lumen Wedding Story')
  console.log('ok - rekening vendor tersimpan dan dapat dibaca kembali untuk invoice')
}

void run()
