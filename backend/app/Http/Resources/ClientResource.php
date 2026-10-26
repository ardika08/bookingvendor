<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Satu baris klien pada daftar Klien.
 *
 * `bookingCount`, `totalValue`, `lastEventDate`, dan `lastStatus` dihitung di
 * controller lewat agregat SQL, bukan dengan memuat seluruh booking ke memori.
 * Tanpa itu, vendor dengan ratusan booking akan memicu ratusan query.
 *
 * `totalValue` sengaja tidak menjumlahkan booking berstatus `cancelled`:
 * pembatalan bukan pendapatan, dan vendor memakai angka ini untuk melihat
 * nilai klien yang benar-benar jadi.
 */
class ClientResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'notes' => $this->notes,
            'bookingCount' => (int) ($this->bookings_count ?? 0),
            'totalValue' => (float) ($this->bookings_sum_total_price ?? 0),
            // Subquery `addSelect` mengembalikan datetime penuh
            // (`2027-01-10 00:00:00`), bukan tanggal saja seperti cast model.
            // Dipotong di sini supaya kontraknya tetap `YYYY-MM-DD`.
            'lastEventDate' => $this->last_event_date
                ? substr((string) $this->last_event_date, 0, 10)
                : null,
            'lastStatus' => $this->last_status,
            'createdAt' => optional($this->created_at)->toDateString(),
        ];
    }
}
