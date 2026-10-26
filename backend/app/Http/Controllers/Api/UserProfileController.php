<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateUserProfileRequest;
use App\Http\Resources\UserAccountResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Profil akun pengguna ("Akun Saya") — vendor maupun admin.
 *
 * Mengelola data akun (`users`), bukan profil usaha. Email dan foto tidak bisa
 * diubah: keduanya berasal dari akun Google yang dipakai masuk.
 */
class UserProfileController extends Controller
{
    /**
     * GET /api/user/profile
     */
    public function show(): JsonResponse
    {
        return (new UserAccountResource($this->currentUser()))->response();
    }

    /**
     * PUT/PATCH /api/user/profile
     */
    public function update(UpdateUserProfileRequest $request): JsonResponse
    {
        $user = $this->currentUser();
        $validated = $request->validated();

        $user->name = $validated['name'];
        $user->phone = $validated['phone'] ?? null;
        $user->save();

        return (new UserAccountResource($user))->response();
    }

    /**
     * Akun yang sedang login; tanpa sesi (mode pengembangan) pakai akun pertama.
     * Middleware auth peran akan menegakkan ini begitu login aktif.
     */
    private function currentUser(): User
    {
        $user = auth()->user();

        if ($user instanceof User) {
            return $user;
        }

        return User::query()->orderBy('id')->first()
            ?? abort(404, 'Akun pengguna belum tersedia.');
    }
}
