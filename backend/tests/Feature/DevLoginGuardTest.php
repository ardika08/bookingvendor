<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pengaman `/auth/dev-login`.
 *
 * Route ini membuat sesi login TANPA kredensial. Selama pengembangan di VPS,
 * aplikasi diakses lewat IP publik, sehingga tanpa pembatasan siapa pun bisa
 * masuk sebagai vendor pertama dan melihat seluruh data booking/klien.
 *
 * Perilaku yang dikunci di sini:
 * - permintaan dari IP publik ditolak 404;
 * - permintaan dari loopback diterima (jalur SSH tunnel);
 * - bila `DEV_LOGIN_ALLOW_PUBLIC=true`, IP publik diizinkan secara eksplisit;
 * - di luar environment local/testing selalu 404, apa pun pengaturannya.
 */
class DevLoginGuardTest extends TestCase
{
    use RefreshDatabase;

    private function buatVendor(): User
    {
        $user = User::factory()->create([
            'role' => User::ROLE_VENDOR,
            'is_active' => true,
        ]);
        $user->vendor()->create([
            'name' => 'Vendor Uji',
            'slug' => 'vendor-uji',
        ]);

        return $user;
    }

    public function test_ip_publik_ditolak_404_secara_default(): void
    {
        $this->buatVendor();
        putenv('DEV_LOGIN_ALLOW_PUBLIC');
        unset($_ENV['DEV_LOGIN_ALLOW_PUBLIC'], $_SERVER['DEV_LOGIN_ALLOW_PUBLIC']);

        $this->withServerVariables(['REMOTE_ADDR' => '43.134.66.81'])
            ->get('/auth/dev-login')
            ->assertNotFound();

        $this->assertGuest();
    }

    public function test_loopback_diterima(): void
    {
        $this->buatVendor();
        putenv('DEV_LOGIN_ALLOW_PUBLIC');
        unset($_ENV['DEV_LOGIN_ALLOW_PUBLIC'], $_SERVER['DEV_LOGIN_ALLOW_PUBLIC']);

        $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])
            ->get('/auth/dev-login')
            ->assertRedirect('/dashboard');

        $this->assertAuthenticated();
    }

    public function test_ip_publik_diizinkan_bila_flag_aktif(): void
    {
        $this->buatVendor();
        putenv('DEV_LOGIN_ALLOW_PUBLIC=true');

        $this->withServerVariables(['REMOTE_ADDR' => '43.134.66.81'])
            ->get('/auth/dev-login')
            ->assertRedirect('/dashboard');

        $this->assertAuthenticated();

        putenv('DEV_LOGIN_ALLOW_PUBLIC');
    }

    public function test_ip_private_lan_diterima(): void
    {
        $this->buatVendor();
        putenv('DEV_LOGIN_ALLOW_PUBLIC');
        unset($_ENV['DEV_LOGIN_ALLOW_PUBLIC'], $_SERVER['DEV_LOGIN_ALLOW_PUBLIC']);

        $this->withServerVariables(['REMOTE_ADDR' => '192.168.1.10'])
            ->get('/auth/dev-login')
            ->assertRedirect('/dashboard');
    }

    public function test_di_luar_local_selalu_404(): void
    {
        $this->buatVendor();
        putenv('DEV_LOGIN_ALLOW_PUBLIC=true');
        app()['env'] = 'production';

        $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])
            ->get('/auth/dev-login')
            ->assertNotFound();

        $this->assertGuest();

        putenv('DEV_LOGIN_ALLOW_PUBLIC');
    }
}
