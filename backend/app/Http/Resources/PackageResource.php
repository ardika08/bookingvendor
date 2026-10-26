<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Paket layanan untuk katalog vendor (`/packages`).
 *
 * `usageCount` menghitung booking yang memakai paket — dipakai UI untuk
 * memutuskan tombol "Hapus" (boleh) atau "Arsipkan saja" (sudah terpakai).
 *
 * @mixin \App\Models\Package
 */
class PackageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'price' => (float) $this->price,
            'description' => $this->description,
            'durationHours' => $this->duration_hours,
            'active' => $this->is_active,
            'usageCount' => (int) ($this->bookings_count ?? $this->bookings()->count()),
        ];
    }
}
