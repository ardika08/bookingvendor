<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Profil akun pengguna ("Akun Saya") untuk vendor & admin.
 *
 * Akun = baris `users`: nama, email Google, nomor HP, foto, dan peran. Berbeda
 * dari profil usaha vendor (`/vendor/profile`) yang menyimpan data usaha.
 *
 * @mixin \App\Models\User
 */
class UserAccountResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'avatarUrl' => $this->avatar_url,
            'role' => $this->role,
        ];
    }
}
