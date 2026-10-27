<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\UserAccessResolver;
use App\Support\FrontendRedirect;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;

/**
 * Google OAuth untuk akun vendor/admin yang sudah disiapkan admin.
 *
 * Aturan akses (terdaftar? aktif? ke mana diarahkan?) sepenuhnya di
 * `UserAccessResolver`; controller hanya menerjemahkan hasilnya menjadi
 * redirect ke SPA.
 */
class GoogleAuthController extends Controller
{
    public function __construct(private readonly UserAccessResolver $access)
    {
    }

    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')->redirect();
    }

    public function callback(): RedirectResponse
    {
        try {
            $google = Socialite::driver('google')->stateless()->user();
        } catch (\Throwable) {
            return FrontendRedirect::to('/login?error=oauth_failed');
        }

        $result = $this->access->resolve($google->getId(), $google->getEmail());

        if ($result['status'] === UserAccessResolver::STATUS_NOT_REGISTERED) {
            return FrontendRedirect::to('/login?error=account_not_registered');
        }

        if ($result['status'] === UserAccessResolver::STATUS_INACTIVE) {
            return FrontendRedirect::to('/login?error=account_inactive');
        }

        /** @var \App\Models\User $user */
        $user = $result['user'];

        $user->forceFill([
            'google_id' => $google->getId(),
            'name' => $google->getName() ?: $user->name,
            'avatar_url' => $google->getAvatar(),
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        Auth::login($user, true);
        request()->session()->regenerate();

        return FrontendRedirect::to($this->access->destinationFor($user));
    }
}
