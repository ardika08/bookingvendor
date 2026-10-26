<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\UserAccessResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;

/**
 * Login dev: langsung masuk tanpa Google OAuth.
 *
 * Hanya aktif saat `APP_ENV=local`. Dipakai selama pengembangan frontend agar
 * alur SPA bisa diuji tanpa kredensial Google. Bila aplikasi dipindah ke
 * environment lain, route ini menolak 404.
 */
class DevLoginController extends Controller
{
    public function __construct(private readonly UserAccessResolver $access)
    {
    }

    public function __invoke(): RedirectResponse
    {
        if (app()->environment('local', 'testing')) {
            $user = User::query()->where('role', User::ROLE_VENDOR)->first();

            if ($user === null) {
                $frontend = rtrim((string) config('app.frontend_url'), '/');

                return redirect()->away($frontend . '/login?error=account_not_registered');
            }

            Auth::login($user, true);
            request()->session()->regenerate();

            $frontend = rtrim((string) config('app.frontend_url'), '/');

            return redirect()->away($frontend . $this->access->destinationFor($user));
        }

        abort(404);
    }
}
