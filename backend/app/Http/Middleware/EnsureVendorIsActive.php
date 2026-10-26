<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pastikan akun vendor masih aktif.
 *
 * Admin dapat menonaktifkan akun vendor (`vendors.is_active = false`). Selama
 * nonaktif, vendor tidak boleh memakai aplikasi: semua endpoint vendor
 * dihentikan dengan 403 berkode `vendor_inactive`, sementara datanya tetap utuh
 * dan bisa diaktifkan kembali kapan saja.
 *
 * Vendor diturunkan dari sesi login (`user → vendor`). Middleware ini dipasang
 * setelah `auth:sanctum`, jadi pengguna dijamin ada. Akun tanpa profil vendor
 * tidak diblokir di sini — `ResolvesVendor` yang akan menjawabnya dengan 403
 * yang lebih spesifik.
 */
class EnsureVendorIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();
        $vendor = $user?->vendor;

        if ($vendor !== null && ! $vendor->is_active) {
            return response()->json([
                'message' => 'Akun vendor sedang dinonaktifkan. Hubungi admin platform.',
                'code' => 'vendor_inactive',
            ], 403);
        }

        return $next($request);
    }
}
