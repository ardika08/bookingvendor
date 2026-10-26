<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Keluar dari sesi.
 *
 * Dipanggil oleh SPA saat vendor menekan tombol "Keluar". Karena login
 * menggunakan guard `web` (sesi cookie), logout juga harus melewati guard yang
 * sama — tidak cukup menghapus token bearer saja.
 */
class LogoutController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $frontend = rtrim((string) config('app.frontend_url'), '/');

        return redirect()->away($frontend . '/login');
    }
}
