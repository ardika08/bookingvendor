<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    private function googleUser(string $id = 'google-123', string $email = 'vendor@gmail.com'): object
    {
        return new class($id, $email)
        {
            public function __construct(private string $id, private string $email) {}
            public function getId(): string { return $this->id; }
            public function getEmail(): string { return $this->email; }
            public function getName(): string { return 'Nama Google'; }
            public function getAvatar(): string { return 'https://example.test/avatar.png'; }
        };
    }

    private function mockSocialite(object $googleUser): void
    {
        $driver = \Mockery::mock();
        $driver->shouldReceive('stateless')->once()->andReturnSelf();
        $driver->shouldReceive('user')->once()->andReturn($googleUser);
        Socialite::shouldReceive('driver')->with('google')->andReturn($driver);
    }

    public function test_redirect_masuk_google_mengarah_ke_provider(): void
    {
        $driver = \Mockery::mock();
        $driver->shouldReceive('redirect')->once()->andReturn(redirect('https://accounts.google.test'));
        Socialite::shouldReceive('driver')->with('google')->andReturn($driver);

        $this->get('/auth/google/redirect')->assertRedirect('https://accounts.google.test');
    }

    public function test_vendor_terdaftar_bisa_masuk_dan_diarahkan_ke_dashboard(): void
    {
        $user = User::create(['name' => 'Lama', 'email' => 'vendor@gmail.com', 'role' => 'vendor']);
        $this->mockSocialite($this->googleUser());

        $this->get('/auth/google/callback')
            ->assertRedirect('/dashboard');

        $this->assertAuthenticatedAs($user->fresh());
        $this->assertSame('google-123', $user->fresh()->google_id);
    }

    public function test_admin_diarahkan_ke_panel_admin(): void
    {
        User::create(['name' => 'Admin', 'email' => 'admin@gmail.com', 'role' => 'admin']);
        $this->mockSocialite($this->googleUser('admin-google', 'admin@gmail.com'));

        $this->get('/auth/google/callback')->assertRedirect('/admin');
    }

    public function test_akun_belum_didaftarkan_ditolak(): void
    {
        $this->mockSocialite($this->googleUser());

        $this->get('/auth/google/callback')
            ->assertRedirect('/login?error=account_not_registered');
        $this->assertGuest();
    }

    public function test_akun_nonaktif_ditolak(): void
    {
        User::create(['name' => 'Nonaktif', 'email' => 'vendor@gmail.com', 'role' => 'vendor', 'is_active' => false]);
        $this->mockSocialite($this->googleUser());

        $this->get('/auth/google/callback')
            ->assertRedirect('/login?error=account_inactive');
        $this->assertGuest();
    }

    public function test_error_provider_dikembalikan_ke_login(): void
    {
        $driver = \Mockery::mock();
        $driver->shouldReceive('stateless')->once()->andReturnSelf();
        $driver->shouldReceive('user')->once()->andThrow(new \RuntimeException('oauth down'));
        Socialite::shouldReceive('driver')->with('google')->andReturn($driver);

        $this->get('/auth/google/callback')
            ->assertRedirect('/login?error=oauth_failed');
        $this->assertGuest();
    }
}
