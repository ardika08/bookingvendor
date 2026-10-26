<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Profil vendor untuk halaman pengaturan (`/settings`).
 *
 * Bentuk camelCase sesuai kontrak frontend, dengan rekening digabung dalam
 * objek `bank`. `category` dikirim sebagai nama (string), bukan id, supaya
 * dropdown kategori di frontend tidak perlu tahu tabel referensi.
 *
 * @mixin \App\Models\Vendor
 */
class VendorProfileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $this->whenLoaded('user', fn () => $this->user);

        return [
            'id' => (string) $this->id,
            'businessName' => $this->name,
            'category' => $this->whenLoaded('category', fn () => $this->category?->name),
            'slug' => $this->slug,
            'avatarUrl' => $user?->avatar_url,
            'description' => $this->description,
            'contactPhone' => $this->contact,
            'contactEmail' => $this->contact_email,
            'city' => $this->location,
            'isActive' => $this->is_active,
            'bank' => [
                'name' => $this->bank_name,
                'accountNumber' => $this->bank_account_number,
                'accountHolder' => $this->bank_account_name,
            ],
        ];
    }
}
