<?php

namespace App\Services;

use App\Models\User;

/**
 * Verifikasi akun Google & penentuan tujuan setelah masuk.
 *
 * Satu tempat untuk aturan akses (PRD "Masuk dengan Google"):
 * - akun harus **sudah terdaftar** — tidak ada registrasi publik; vendor dibuat
 *   admin lebih dulu;
 * - akun nonaktif (`is_active = false`) ditolak walau kredensial Google valid;
 * - tujuan ditentukan peran: `admin` → panel admin, selain itu → dashboard
 *   vendor.
 *
 * Dipisah dari controller supaya aturan ini bisa dipakai ulang (mis. tes,
 * command pembersihan, atau endpoint lain) tanpa menyalin logika.
 */
class UserAccessResolver
{
    public const STATUS_OK = 'ok';
    public const STATUS_NOT_REGISTERED = 'not_registered';
    public const STATUS_INACTIVE = 'inactive';

    /** Tujuan SPA per peran. */
    public const DESTINATION_ADMIN = '/admin';
    public const DESTINATION_VENDOR = '/dashboard';

    /**
     * Cocokkan akun Google dengan pengguna lokal.
     *
     * Pencocokan: `google_id` lebih dulu; bila akun belum pernah terikat,
     * email yang sama dipakai untuk mengikat (hanya bila `google_id` masih
     * null — email milik akun yang sudah terikat tidak boleh diambil alih).
     *
     * @return array{status: string, user: User|null, destination: string|null}
     */
    public function resolve(?string $googleId, ?string $email): array
    {
        $user = $this->findUser($googleId, $email);

        if ($user === null) {
            return $this->result(self::STATUS_NOT_REGISTERED, null);
        }

        if (! $user->is_active) {
            return $this->result(self::STATUS_INACTIVE, $user);
        }

        return $this->result(self::STATUS_OK, $user);
    }

    /** Tujuan dashboard sesuai peran pengguna. */
    public function destinationFor(User $user): string
    {
        return $user->isAdmin() ? self::DESTINATION_ADMIN : self::DESTINATION_VENDOR;
    }

    /** True bila status hasil resolve boleh melanjutkan login. */
    public function isAllowed(array $result): bool
    {
        return $result['status'] === self::STATUS_OK;
    }

    private function findUser(?string $googleId, ?string $email): ?User
    {
        if ($googleId !== null && $googleId !== '') {
            $byGoogle = User::query()->where('google_id', $googleId)->first();
            if ($byGoogle !== null) {
                return $byGoogle;
            }
        }

        if ($email === null || $email === '') {
            return null;
        }

        return User::query()
            ->whereNull('google_id')
            ->where('email', $email)
            ->first();
    }

    /**
     * @return array{status: string, user: User|null, destination: string|null}
     */
    private function result(string $status, ?User $user): array
    {
        return [
            'status' => $status,
            'user' => $user,
            'destination' => $user !== null && $status === self::STATUS_OK
                ? $this->destinationFor($user)
                : null,
        ];
    }
}
