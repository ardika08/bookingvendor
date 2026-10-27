<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\UserAccessResolver;
use App\Support\FrontendRedirect;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Login dev: langsung masuk tanpa Google OAuth.
 *
 * Hanya aktif saat `APP_ENV=local`. Dipakai selama pengembangan frontend agar
 * alur SPA bisa diuji tanpa kredensial Google. Bila aplikasi dipindah ke
 * environment lain, route ini menolak 404.
 *
 * PEMBATASAN JARINGAN (penting)
 * Route ini membuat sesi login TANPA kredensial apa pun. Selama pengembangan
 * di VPS, aplikasi diakses lewat IP publik, sehingga tanpa pembatasan siapa pun
 * di internet bisa membuka `/auth/dev-login` dan masuk sebagai vendor pertama
 * — termasuk melihat seluruh data booking dan klien.
 *
 * Karena itu route ini hanya melayani permintaan dari jaringan lokal/private
 * (loopback, RFC1918, IPv6 ULA). Permintaan dari IP publik ditolak 404, sama
 * seperti di environment produksi. Untuk mengakses dari komputer sendiri,
 * gunakan SSH tunnel sehingga request tampak berasal dari loopback:
 *
 *   ssh -L 4173:127.0.0.1:4173 user@vps
 *   # lalu buka http://localhost:4173
 *
 * Bila memang perlu membuka dari IP publik saat pengembangan, set
 * `DEV_LOGIN_ALLOW_PUBLIC=true` di `.env` dan sadari risikonya.
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

    public function __invoke(Request $request): RedirectResponse
    {
        abort_unless(app()->environment('local', 'testing'), 404);

        // Tolak permintaan dari IP publik kecuali memang diizinkan eksplisit.
        if (! $this->isLocalRequest($request) && ! $this->allowPublic()) {
            abort(404);
        }

        // Pilih akun sesuai peran yang diminta lewat `?as=admin|vendor`.
        // Tanpa parameter, perilaku lama dipertahankan (vendor) agar tautan
        // lama dan tes yang sudah ada tidak berubah.
        $as = (string) $request->query('as', 'vendor');
        $as = $as === 'admin' ? 'admin' : 'vendor';

        $user = $this->pickUser($as);

        if ($user === null) {
            /*
             * Bedakan tiga penyebab supaya penanganannya jelas:
             * - akun ada tetapi nonaktif -> account_inactive (bukan "belum terdaftar")
             * - akun vendor ada tetapi baris `vendors` belum dibuat -> butuh seeder
             * - tidak ada akun sama sekali -> account_not_registered
             *
             * Sebelumnya kasus "nonaktif" dilaporkan sebagai "belum terdaftar",
             * sehingga admin mengira akunnya hilang padahal hanya dinonaktifkan.
             */
            $role = $as === 'admin' ? User::ROLE_ADMIN : User::ROLE_VENDOR;
            $akunRole = User::query()->where('role', $role);

            if ((clone $akunRole)->where('is_active', false)->exists()) {
                $error = 'account_inactive';
            } elseif ((clone $akunRole)->exists()) {
                $error = 'vendor_profile_missing';
            } else {
                $error = 'account_not_registered';
            }

            return FrontendRedirect::to('/login?error=' . $error);
        }

        Auth::login($user, true);
        $request->session()->regenerate();

        return FrontendRedirect::to($this->access->destinationFor($user));
    }

    /**
     * Ambil akun yang akan dipakai untuk login dev.
     *
     * Vendor: harus punya profil usaha, karena tanpa baris `vendors` semua
     * endpoint vendor menjawab 403 `vendor_not_linked` dan dashboard tampak
     * rusak padahal datanya memang belum ada.
     *
     * Admin: tidak butuh profil apa pun — panel admin justru mengelola vendor
     * lain, jadi akun admin selalu berdiri sendiri.
     */
    private function pickUser(string $as): ?User
    {
        if ($as === 'admin') {
            return User::query()
                ->where('role', User::ROLE_ADMIN)
                ->where('is_active', true)
                ->orderBy('id')
                ->first();
        }

        return User::query()
            ->where('role', User::ROLE_VENDOR)
            ->whereHas('vendor')
            ->orderBy('id')
            ->first();
    }

    /**
     * True bila permintaan berasal dari jaringan lokal/private.
     *
     * Loopback selalu diterima karena itulah jalur SSH tunnel. Rentang private
     * (10/8, 172.16/12, 192.168/16, 100.64/10, ULA fd00::/8) juga diterima
     * agar pengembangan di LAN tidak terganggu.
     *
     * Cara kerjanya: tolak dulu semua yang publik, lalu terima sisanya.
     * `FILTER_FLAG_NO_PRIV_RANGE` membuat validasi GAGAL untuk IP private,
     * sehingga `=== false` berarti "ini IP private".
     */
    private function isLocalRequest(Request $request): bool
    {
        $ip = $request->ip();

        if ($ip === null || filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return false;
        }

        if ($ip === '127.0.0.1' || $ip === '::1') {
            return true;
        }

        // IP publik murni -> tolak.
        $isPublic = filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
        ) !== false;

        return ! $isPublic;
    }

    /** Izin eksplisit untuk membuka dev-login dari IP publik. */
    private function allowPublic(): bool
    {
        return filter_var(env('DEV_LOGIN_ALLOW_PUBLIC', false), FILTER_VALIDATE_BOOLEAN);
    }
}
