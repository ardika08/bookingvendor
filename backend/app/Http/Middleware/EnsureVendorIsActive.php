<?php

namespace App\Http\Middleware;

use App\Models\Vendor;
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
 * Vendor diturunkan dari sesi login (relasi `user → vendor`); tanpa sesi
 * (mode pengembangan) dipakai vendor pertama, sama seperti controller lain.
 */
class EnsureVendorIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $vendor = $user?->vendor ?? Vendor::query()->first();

        if ($vendor !== null && ! $vendor->is_active) {
            return response()->json([
                'message' => 'Akun vendor sedang dinonaktifkan. Hubungi admin platform.',
                'code' => 'vendor_inactive',
            ], 403);
        }

        return $next($request);
    }
}
