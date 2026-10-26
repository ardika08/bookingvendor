<?php

use App\Http\Controllers\Auth\DevLoginController;
use App\Http\Controllers\Auth\GoogleAuthController;
use App\Http\Controllers\Auth\LogoutController;
use Illuminate\Support\Facades\Route;

Route::get('/auth/google/redirect', [GoogleAuthController::class, 'redirect'])
    ->name('auth.google.redirect');
Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback'])
    ->name('auth.google.callback');

// Dev bypass: langsung login sebagai vendor pertama tanpa Google.
// Hanya aktif saat APP_ENV=local/testing; di environment lain mengembalikan 404.
Route::get('/auth/dev-login', DevLoginController::class)
    ->name('auth.dev-login');

// Keluar dari sesi (guard web).
// GET dipakai karena SPA memakai redirect flow (Google OAuth) yang tidak
// menyertakan CSRF token untuk POST. Logout lewat anchor/link lebih konsisten.
Route::get('/auth/logout', LogoutController::class)
    ->name('auth.logout');

Route::get('/', function () {
    return view('welcome');
});
