<?php

namespace Tests\Unit;

use App\Models\User;
use App\Services\UserAccessResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji service verifikasi akun Google & penentuan peran.
 *
 * Aturan PRD: tidak ada registrasi publik (akun harus sudah dibuat admin),
 * akun nonaktif ditolak, dan tujuan ditentukan peran.
 */
class UserAccessResolverTest extends TestCase
{
    use RefreshDatabase;

    private UserAccessResolver $resolver;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resolver = new UserAccessResolver();
    }

    public function test_akun_tidak_terdaftar_ditolak(): void
    {
        $result = $this->resolver->resolve('google-999', 'baru@gmail.com');

        $this->assertSame(UserAccessResolver::STATUS_NOT_REGISTERED, $result['status']);
        $this->assertNull($result['user']);
        $this->assertNull($result['destination']);
        $this->assertFalse($this->resolver->isAllowed($result));
    }

    public function test_cocok_lewat_google_id(): void
    {
        $user = User::create([
            'name' => 'Vendor',
            'email' => 'vendor@gmail.com',
            'role' => User::ROLE_VENDOR,
            'google_id' => 'google-1',
        ]);

        $result = $this->resolver->resolve('google-1', 'vendor@gmail.com');

        $this->assertSame(UserAccessResolver::STATUS_OK, $result['status']);
        $this->assertTrue($result['user']->is($user));
        $this->assertSame(UserAccessResolver::DESTINATION_VENDOR, $result['destination']);
    }

    public function test_cocok_lewat_email_saat_belum_terikat_google(): void
    {
        $user = User::create([
            'name' => 'Admin',
            'email' => 'admin@gmail.com',
            'role' => User::ROLE_ADMIN,
        ]);

        $result = $this->resolver->resolve('google-admin', 'admin@gmail.com');

        $this->assertSame(UserAccessResolver::STATUS_OK, $result['status']);
        $this->assertTrue($result['user']->is($user));
        $this->assertSame(UserAccessResolver::DESTINATION_ADMIN, $result['destination']);
    }

    public function test_email_milik_akun_terikat_lain_tidak_diambil_alih(): void
    {
        User::create([
            'name' => 'Vendor',
            'email' => 'vendor@gmail.com',
            'role' => User::ROLE_VENDOR,
            'google_id' => 'google-lama',
        ]);

        $result = $this->resolver->resolve('google-baru', 'vendor@gmail.com');

        $this->assertSame(UserAccessResolver::STATUS_NOT_REGISTERED, $result['status']);
    }

    public function test_akun_nonaktif_ditolak_tapi_user_diketahui(): void
    {
        $user = User::create([
            'name' => 'Vendor',
            'email' => 'vendor@gmail.com',
            'role' => User::ROLE_VENDOR,
            'is_active' => false,
        ]);

        $result = $this->resolver->resolve('google-1', 'vendor@gmail.com');

        $this->assertSame(UserAccessResolver::STATUS_INACTIVE, $result['status']);
        $this->assertTrue($result['user']->is($user));
        $this->assertNull($result['destination']);
        $this->assertFalse($this->resolver->isAllowed($result));
    }

    public function test_tujuan_sesuai_peran(): void
    {
        $vendor = User::create([
            'name' => 'Vendor',
            'email' => 'v@gmail.com',
            'role' => User::ROLE_VENDOR,
        ]);
        $admin = User::create([
            'name' => 'Admin',
            'email' => 'a@gmail.com',
            'role' => User::ROLE_ADMIN,
        ]);

        $this->assertSame('/dashboard', $this->resolver->destinationFor($vendor));
        $this->assertSame('/admin', $this->resolver->destinationFor($admin));
    }

    public function test_google_id_kosong_tidak_mencocokkan_apa_pun(): void
    {
        User::create([
            'name' => 'Vendor',
            'email' => 'vendor@gmail.com',
            'role' => User::ROLE_VENDOR,
            'google_id' => 'google-1',
        ]);

        $result = $this->resolver->resolve('', null);

        $this->assertSame(UserAccessResolver::STATUS_NOT_REGISTERED, $result['status']);
    }
}
