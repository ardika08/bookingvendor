<?php

namespace Tests;

use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Login sebagai pengguna tertentu untuk request API berikutnya.
     *
     * Endpoint `/api/*` dilindungi `auth:sanctum`, jadi test WAJIB menentukan
     * siapa yang sedang login. `actingAs()` pada guard default sudah cukup di
     * lingkungan test karena Sanctum membaca guard `web`; tidak perlu membuat
     * token bearer asli.
     */
    protected function loginAs(?User $user): static
    {
        if ($user === null) {
            $this->app['auth']->forgetGuards();

            return $this;
        }

        return $this->actingAs($user);
    }

    /**
     * Login sebagai pemilik vendor (peran vendor).
     */
    protected function loginAsVendorOf(?Vendor $vendor): static
    {
        return $this->loginAs($vendor?->user);
    }

    /**
     * Login sebagai admin platform.
     *
     * Bila `$admin` tidak diberikan, akun admin yang SUDAH ADA di database
     * dipakai ulang. Membuat akun baru di sini akan mengubah jumlah baris
     * `users` dan merusak test yang menghitung isi tabel — jadi akun baru hanya
     * dibuat kalau memang belum ada satu pun admin.
     */
    protected function loginAsAdmin(?User $admin = null): static
    {
        $admin ??= User::query()->where('role', User::ROLE_ADMIN)->first();

        if ($admin === null) {
            // Akun pemilik vendor yang sudah ada dinaikkan perannya agar jumlah
            // baris `users` tidak bertambah.
            $admin = User::query()->first();

            if ($admin !== null) {
                $admin->forceFill(['role' => User::ROLE_ADMIN])->save();
            }
        }

        $admin ??= User::create([
            'name' => 'Admin Platform',
            'email' => 'admin-platform@bookingvendor.test',
            'role' => User::ROLE_ADMIN,
        ]);

        return $this->actingAs($admin);
    }
}
