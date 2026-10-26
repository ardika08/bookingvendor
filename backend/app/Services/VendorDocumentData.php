<?php

namespace App\Services;

use App\Models\Vendor;

/**
 * Penyedia data profil vendor untuk **dokumen** (invoice tercetak, PDF, dan
 * halaman publik).
 *
 * Dokumen butuh bentuk data yang siap cetak — bukan entitas model mentah:
 * tautan WhatsApp yang sudah dinormalisasi, satu baris rekening, dan tautan
 * jadwal publik yang hanya ada bila diaktifkan vendor. Endpoint/detail halaman
 * memakai resource; layanan ini khusus pemakaian dokumen sehingga format tidak
 * tergantung UI.
 */
class VendorDocumentData
{
    /**
     * Profil lengkap untuk dokumen.
     *
     * @return array<string, mixed>
     */
    public function for(Vendor $vendor): array
    {
        $vendor->loadMissing('category', 'user');

        return [
            'name' => $vendor->name,
            'category' => $vendor->category?->name,
            'slug' => $vendor->slug,
            'description' => $vendor->description,
            'location' => $vendor->location,
            'contact' => $vendor->contact,
            'contactEmail' => $vendor->contact_email,
            'whatsapp' => $this->waLink($vendor->contact),
            'scheduleUrl' => $vendor->schedule_link_active
                ? url("/jadwal/{$vendor->slug}")
                : null,
            'bank' => [
                'name' => $vendor->bank_name,
                'accountNumber' => $vendor->bank_account_number,
                'accountHolder' => $vendor->bank_account_name,
                'complete' => $vendor->hasCompleteBankAccount(),
                'line' => $this->bankLine($vendor),
            ],
        ];
    }

    /**
     * Header ringkas untuk lembar invoice.
     *
     * @return array<string, mixed>
     */
    public function invoiceHeader(Vendor $vendor): array
    {
        $vendor->loadMissing('category');

        return [
            'name' => $vendor->name,
            'category' => $vendor->category?->name,
            'location' => $vendor->location,
            'contact' => $vendor->contact,
            'whatsapp' => $this->waLink($vendor->contact),
            'bankLine' => $this->bankLine($vendor),
        ];
    }

    /**
     * `0812-3456-7890` → `https://wa.me/6281234567890`.
     *
     * Format `0…`, `62…`, dan `+62…` dianggap sama (aturan yang sama dengan
     * pencarian klien). Nomor tidak valid mengembalikan null, bukan link rusak.
     */
    public function waLink(?string $phone, ?string $text = null): ?string
    {
        if ($phone === null) {
            return null;
        }

        $digits = preg_replace('/\D/', '', $phone);

        if ($digits === '' || $digits === null) {
            return null;
        }

        if ($digits[0] === '0') {
            $digits = '62' . substr($digits, 1);
        }

        $link = "https://wa.me/{$digits}";

        return $text !== null
            ? $link . '?text=' . rawurlencode($text)
            : $link;
    }

    /**
     * Satu baris instruksi transfer: `BCA 1234567890 a.n. Lumen Wedding Story`.
     *
     * Null bila rekening belum lengkap — dokumen tidak boleh mencetak
     * instruksi setengah yang membingungkan klien.
     */
    public function bankLine(Vendor $vendor): ?string
    {
        if (! $vendor->hasCompleteBankAccount()) {
            return null;
        }

        return sprintf(
            '%s %s a.n. %s',
            $vendor->bank_name,
            $vendor->bank_account_number,
            $vendor->bank_account_name,
        );
    }
}
