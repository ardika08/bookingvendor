<?php

use App\Http\Controllers\Auth\DevLoginController;
use App\Http\Controllers\Auth\LogoutController;
use Illuminate\Support\Facades\Route;

// Dev bypass: langsung login sebagai vendor pertama.
// Hanya aktif saat APP_ENV=local/testing; di environment lain mengembalikan 404.
Route::get('/auth/dev-login', DevLoginController::class)
    ->name('auth.dev-login');

/*
 * Keluar dari sesi (guard web).
 * GET dipakai karena SPA memakai redirect flow yang tidak menyertakan CSRF
 * token untuk POST. Logout lewat anchor/link lebih konsisten.
 */
Route::get('/auth/logout', LogoutController::class)
    ->name('auth.logout');

/*
 * Middleware `auth` mengarahkan request yang belum login ke route bernama
 * `login` lewat `redirect()->guest(route('login'))`. Route itu tidak pernah
 * ada karena SPA memakai halaman login sendiri di origin terpisah, sehingga
 * setiap request tanpa header `Accept: application/json` berujung
 * RouteNotFoundException alias HTTP 500 — bukan 401.
 *
 * Route ini menutup lubang tersebut: request web diarahkan ke halaman login
 * frontend, sementara request `api/*` tetap dijawab JSON 401 oleh handler di
 * `bootstrap/app.php`.
 */
Route::get('/login', fn () => redirect()->away(config('app.frontend_url').'/login'))
    ->name('login');

Route::get('/', function () {
    return view('welcome');
});
