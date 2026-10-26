<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Tanggal terblokir untuk kalender vendor.
 *
 * Bentuk camelCase sesuai kontrak frontend: `{ id, date, reason, createdAt }`.
 * `reason` dipetakan dari kolom `note`.
 *
 * @mixin \App\Models\VendorSchedule
 */
class BlockedDateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'date' => optional($this->date)->toDateString(),
            'reason' => $this->note,
            'createdAt' => optional($this->created_at)->toDateString(),
        ];
    }
}
