<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Vendor;

/**
 * Pencarian vendor konteks untuk endpoint dashboard vendor.
 *
 * Vendor diturunkan dari sesi login (relasi `user → vendor`). Selama fitur
 * autentikasi belum aktif, mode pengembangan memakai vendor pertama supaya
 * endpoint tetap bisa diuji. Ownership per-vendor ditegakkan middleware auth
 * begitu fitur login selesai.
 */
trait ResolvesVendor
{
    protected function resolveVendor(): Vendor
    {
        $user = auth()->user();

        if ($user && $user->vendor) {
            return $user->vendor;
        }

        return Vendor::query()->first()
            ?? abort(404, 'Profil vendor belum terdaftar.');
    }
}
