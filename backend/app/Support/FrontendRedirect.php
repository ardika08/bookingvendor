<?php

namespace App\Support;

use Illuminate\Http\RedirectResponse;

/**
 * Redirect kembali ke halaman SPA setelah alur auth di server.
 *
 * MASALAH YANG DIPERBAIKI
 * Sebelumnya controller memakai `redirect()->away(config('app.frontend_url').$path)`.
 * `away()` memaksa URL absolut, jadi host tujuan selalu ditentukan oleh
 * `FRONTEND_URL` di `.env` — bukan oleh host yang sedang dipakai pengguna.
 *
 * Akibatnya, bila `FRONTEND_URL=http://43.134.66.81:4173` tetapi pengguna
 * membuka `http://127.0.0.1:4173`, setelah login browser dipindahkan ke
 * `43.134.66.81`. Cookie sesi Laravel terikat pada host asal (`127.0.0.1`),
 * sehingga tidak ikut terkirim. Server menganggap pengguna belum login,
 * `/api/me` menjawab 401, dan SPA melempar balik ke `/login` — login tampak
 * "mental" padahal kredensial benar.
 *
 * SOLUSI
 * Redirect relatif. Browser tidak berpindah host, jadi cookie tetap sah.
 * Ini aman karena SPA memang selalu mencapai backend lewat origin-nya
 * sendiri: `vite.config.ts` mem-proxy `/api` dan `/auth` ke Laravel, dan
 * fitur cookie sesi (`credentials: include`) memang mengharuskan hal itu.
 * URL absolut hanya dipakai bila pemanggil memang memberi URL absolut.
 */
class FrontendRedirect
{
    /**
     * Arahkan ke path SPA tanpa memaksa pindah host.
     *
     * @param  string  $path  Path SPA, mis. `/dashboard` atau `/login?error=oauth_failed`.
     */
    public static function to(string $path): RedirectResponse
    {
        /*
         * PENTING: jangan memakai `redirect()->to()`.
         *
         * `redirect()->to('/dashboard')` memanggil `UrlGenerator::to()` yang
         * MENGABSOLUTKAN path terhadap `APP_URL`, sehingga hasilnya kembali
         * menjadi `http://localhost/dashboard`. Itu mengembalikan bug yang
         * sama dalam bentuk lain.
         *
         * `RedirectResponse` dibuat langsung agar header `Location` tetap
         * berisi path relatif apa adanya.
         */
        return new RedirectResponse(self::normalize($path));
    }

    /**
     * Pastikan path selalu diawali `/` dan bukan URL absolut.
     *
     * Nilai seperti `dashboard` (tanpa slash) akan ditafsirkan browser sebagai
     * path relatif terhadap halaman saat ini dan bisa menghasilkan URL yang
     * salah, jadi dinormalkan di sini.
     */
    private static function normalize(string $path): string
    {
        // URL absolut dibiarkan apa adanya; pemanggil yang menentukan.
        if (preg_match('#^https?://#i', $path) === 1) {
            return $path;
        }

        return '/'.ltrim($path, '/');
    }
}
