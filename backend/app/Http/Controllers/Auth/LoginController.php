<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * Masuk dengan email dan kata sandi.
 *
 * Menggantikan login Google (OAuth). Vendor mendaftar dengan email + kata
 * sandi sendiri; admin ditambahkan lewat tinker. Sesi dibuat pada guard `web`
 * (cookie), sama seperti alur Google sebelumnya — sehingga seluruh endpoint
 * API yang memakai `auth:sanctum` tetap berfungsi tanpa perubahan.
 */
class LoginController extends Controller
{
    /**
     * POST /api/login
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email', 'max:150'],
            'password' => ['required', 'string', 'min:8', 'max:100'],
        ], [
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'password.required' => 'Kata sandi wajib diisi.',
            'password.min' => 'Kata sandi minimal 8 karakter.',
        ]);

        $user = User::query()
            ->where('email', strtolower(trim($validated['email'])))
            ->first();

        /*
         * Pesan error sengaja sama untuk "email tidak ada" dan "sandi salah"
         * supaya penyerang tidak tahu mana yang benar — mengurangi serangan
         * enumerasi email.
         */
        if (! $user || $user->password === null || ! password_verify($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Email atau kata sandi salah.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Akun ini dinonaktifkan. Hubungi admin platform.'],
            ]);
        }

        Auth::guard('web')->login($user, $request->boolean('remember'));

        return response()->json([
            'message' => 'Berhasil masuk.',
            'role' => $user->role,
        ]);
    }
}
