<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Paket langganan untuk panel admin (`/admin/plans`).
 *
 * Bentuk camelCase sesuai tipe `AdminPlan` di frontend. `price` boleh `null`
 * — artinya harga belum ditetapkan dan katalog vendor menampilkan "Segera".
 *
 * @mixin \App\Models\Plan
 */
class AdminPlanResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'durationMonths' => (int) $this->duration_months,
            // `price` = harga yang dibayar (istilah pemilik produk: "harga coret").
            'price' => $this->price === null ? null : (float) $this->price,
            // `normalPrice` = harga sebelum diskon, ditampilkan dicoret.
            'normalPrice' => $this->normal_price === null ? null : (float) $this->normal_price,
            'description' => $this->description,
            'isActive' => (bool) $this->is_active,
        ];
    }
}
