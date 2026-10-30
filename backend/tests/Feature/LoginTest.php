<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Masuk dengan email + kata sandi.
 *
 * Menggantikan tes Google OAuth yang dihapus saat login Google diganti dengan
 * login berbasis kata sandi.
 */
class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_vendor_bisa_masuk_dengan_email_dan_password(): void
    {
        $user = User::factory()->create([
            'email' => 'vendor@test.com',
            'password' => bcrypt('passwo...ah'),
            'role' => User::ROLE_VENDOR,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'vendor@test.com',
            'password' => 'passwo...ah',
        ]);

        $response->assertOk()->assertJson(['role' => 'vendor']);
        $this->assertAuthenticatedAs($user);
    }

    public function test_admin_bisa_masuk_dan_dapat_role_admin(): void
    {
        User::factory()->create([
            'email' => 'admin@test.com',
            'password' => bcrypt('passwo...ah'),
            'role' => User::ROLE_ADMIN,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'admin@test.com',
            'password' => 'passwo...ah',
        ]);

        $response->assertOk()->assertJson(['role' => 'admin']);
    }

    public function test_password_salah_ditolak(): void
    {
        User::factory()->create([
            'email' => 'vendor@test.com',
            'password' => bcrypt('passwo...ah'),
            'role' => User::ROLE_VENDOR,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'vendor@test.com',
            'password' => 'salah-sekali',
        ]);

        $response->assertUnprocessable();
        $this->assertGuest();
    }

    public function test_email_tidak_terdaftar_ditolak(): void
    {
        $response = $this->postJson('/api/login', [
            'email' => 'tidak.ada@test.com',
            'password' => 'passwo...ah',
        ]);

        $response->assertUnprocessable();
        $this->assertGuest();
    }

    /**
     * Pesan error sama untuk "email tidak ada" dan "sandi salah" — mencegah
     * penyerang mengetahui mana yang benar (enumerasi email).
     */
    public function test_pesan_error_sama_untuk_email_dan_sandi(): void
    {
        User::factory()->create([
            'email' => 'ada@test.com',
            'password' => bcrypt('passwo...ah'),
            'role' => User::ROLE_VENDOR,
            'is_active' => true,
        ]);

        $salahSandi = $this->postJson('/api/login', [
            'email' => 'ada@test.com',
            'password' => 'salah-sekali',
        ]);

        $tidakAda = $this->postJson('/api/login', [
            'email' => 'tidak.ada@test.com',
            'password' => 'passwo...ah',
        ]);

        // Kedua respons harus 422 dan punya pesan error yang sama persis.
        $salahSandi->assertUnprocessable();
        $tidakAda->assertUnprocessable();

        $this->assertSame(
            $salahSandi->json('errors.email.0'),
            $tidakAda->json('errors.email.0'),
        );
    }

    public function test_akun_nonaktif_tidak_bisa_masuk(): void
    {
        User::factory()->create([
            'email' => 'nonaktif@test.com',
            'password' => bcrypt('passwo...ah'),
            'role' => User::ROLE_VENDOR,
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'nonaktif@test.com',
            'password' => 'passwo...ah',
        ]);

        $response->assertUnprocessable();
        $this->assertGuest();
    }

    public function test_password_minimal_8_karakter(): void
    {
        $response = $this->postJson('/api/login', [
            'email' => 'vendor@test.com',
            'password' => 'pendek',
        ]);

        $response->assertJsonValidationErrors(['password']);
    }
}
