<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\UserAccessResolver;
use App\Support\FrontendRedirect;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;

/**
 * Login dev: langsung masuk tanpa Google OAuth.
 *
 * Hanya aktif saat `APP_ENV=local`. Dipakai selama pengembangan frontend agar
 * alur SPA bisa diuji tanpa kredensial Google. Bila aplikasi dipindah ke
 * environment lain, route ini menolak 404.
 *
 * Pemilihan akun: user vendor yang **punya profil vendor** lebih dulu. Sebelum
 * ini yang diambil sekadar user pertama ber-role vendor; bila baris `vendors`
 * belum ada, login tetap berhasil tetapi semua endpoint vendor menjawab 403
 * `vendor_not_linked` — dashboard tampak rusak padahal datanya tidak ada.
 * Sekarang kondisi itu menghasilkan pesan yang jelas di halaman login.
 */
class DevLoginController extends Controller
{
    public function __construct(private readonly UserAccessResolver $access)
    {
    }

    public function __invoke(): RedirectResponse
    {
        abort_unless(app()->environment('local', 'testing'), 404);

        $user = User::query()
            ->where('role', User::ROLE_VENDOR)
            ->whereHas('vendor')
            ->orderBy('id')
            ->first();

        if ($user === null) {
            // Bedakan "belum ada akun" dari "akun ada tapi profil vendor belum
            // dibuat" supaya penanganannya jelas: yang kedua butuh seeder.
            $adaAkunVendor = User::query()->where('role', User::ROLE_VENDOR)->exists();

            return FrontendRedirect::to(
                '/login?error=' . ($adaAkunVendor ? 'vendor_profile_missing' : 'account_not_registered'),
            );
        }

        Auth::login($user, true);
        request()->session()->regenerate();

        return FrontendRedirect::to($this->access->destinationFor($user));
    }
}
