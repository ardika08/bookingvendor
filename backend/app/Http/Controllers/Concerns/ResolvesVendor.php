<?php

namespace App\Http\Controllers\Concerns;

use App\Models\User;
use App\Models\Vendor;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;

/**
 * Pencarian vendor konteks untuk endpoint dashboard vendor.
 *
 * Vendor SELALU diturunkan dari pengguna yang sedang login (`user → vendor`).
 * Tidak ada lagi fallback ke "vendor pertama" — fallback seperti itu membuat
 * siapa pun yang memanggil endpoint tanpa kredensial menerima data vendor lain.
 *
 * Kegagalan dibedakan supaya frontend bisa bereaksi tepat:
 * - belum/tidak login       → 401 berkode `unauthenticated`
 * - login tapi bukan vendor → 403 berkode `vendor_not_linked`
 */
trait ResolvesVendor
{
    protected function resolveVendor(): Vendor
    {
        /** @var User|null $user */
        $user = auth()->user();

        if ($user === null) {
            throw new AuthenticationException('Silakan masuk terlebih dahulu.');
        }

        $vendor = $user->vendor;

        if ($vendor === null) {
            abort(response()->json([
                'message' => 'Akun ini tidak terhubung ke profil vendor.',
                'code' => 'vendor_not_linked',
            ], 403));
        }

        return $vendor;
    }
}
