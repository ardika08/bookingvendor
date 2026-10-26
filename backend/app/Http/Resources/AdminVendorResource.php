<?php

namespace App\Http\Resources;

use App\Services\SubscriptionStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Vendor untuk daftar & detail panel admin.
 *
 * Admin mengelola *akun* vendor: identitas usaha, akun pemilik, status akun,
 * dan status langganan. Jumlah booking/invoice hanya angka pemakaian — admin
 * tidak membuka isinya (PRD).
 *
 * Status langganan diturunkan lewat `SubscriptionStatus` sehingga `grace`
 * (lewat tanggal berakhir tapi masih dalam tenggang) ikut terbaca benar tanpa
 * kolom tersendiri.
 *
 * @mixin \App\Models\Vendor
 */
class AdminVendorResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $subscription = app(SubscriptionStatus::class)->resolve($this->resource);
        $user = $this->whenLoaded('user', fn () => $this->user);

        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'ownerName' => $user?->name ?? '',
            'email' => $user?->email ?? '',
            'category' => $this->whenLoaded('category', fn () => $this->category?->name),
            'city' => $this->location,
            'description' => $this->description,
            'contact' => $this->contact,
            'isActive' => (bool) $this->is_active,
            'subscription' => [
                'status' => $subscription['status'],
                'endsAt' => $subscription['endsAt'],
            ],
            'bookingsCount' => (int) ($this->bookings_count ?? 0),
            'invoicesCount' => (int) ($this->invoices_count ?? 0),
            'createdAt' => optional($this->created_at)->toDateString(),
        ];
    }
}
