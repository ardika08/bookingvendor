<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\UserAccessResolver;
use App\Support\FrontendRedirect;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\RedirectResponse;
use Laravel\Socialite\Facades\Socialite;
use Tests\TestCase;

/**
 * Regresi: redirect auth tidak boleh memindahkan browser ke host lain.
 *
 * Bug yang dijaga: `redirect()->away(config('app.frontend_url').$path)` membuat
 * host tujuan selalu mengikuti `FRONTEND_URL`, bukan host yang dipakai
 * pengguna. Bila keduanya berbeda (mis. `FRONTEND_URL` berisi IP publik
 * tetapi pengguna membuka `127.0.0.1`), cookie sesi Laravel — yang terikat
 * pada host asal — tidak ikut terkirim, `/api/me` menjawab 401, dan SPA
 * melempar pengguna kembali ke `/login`. Login tampak gagal padahal berhasil.
 *
 * Tes ini memastikan semua redirect auth bersifat relatif, sehingga host
 * tidak pernah berubah.
 */
class AuthRedirectHostTest extends TestCase
{
    use RefreshDatabase;

    public function test_dev_login_mengarah_ke_path_relatif_bukan_host_lain(): void
    {
        // FRONTEND_URL sengaja diisi host yang BERBEDA dari host request.
        config(['app.frontend_url' => 'http://contoh-lain.test:4173']);

        $user = User::factory()->create([
            'role' => User::ROLE_VENDOR,
            'is_active' => true,
        ]);
        $user->vendor()->create([
            'name' => 'Vendor Uji',
            'slug' => 'vendor-uji',
        ]);

        $response = $this->get('/auth/dev-login');

        $response->assertRedirect('/dashboard');

        $target = $response->headers->get('Location');
        $this->assertStringStartsWith('/', $target);
        $this->assertStringNotContainsString('contoh-lain.test', $target);
    }

    public function test_callback_google_mengarah_ke_path_relatif_bukan_host_lain(): void
    {
        config(['app.frontend_url' => 'http://contoh-lain.test:4173']);

        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'is_active' => true,
            'google_id' => null,
        ]);

        $driver = \Mockery::mock();
        $driver->shouldReceive('stateless')->andReturnSelf();
        $driver->shouldReceive('user')->andReturn(new class($admin->email)
        {
            public function __construct(private string $email) {}

            public function getId(): string
            {
                return 'g-123';
            }

            public function getEmail(): string
            {
                return $this->email;
            }

            public function getName(): string
            {
                return 'Admin Uji';
            }

            public function getAvatar(): string
            {
                return 'https://contoh.test/a.png';
            }
        });
        Socialite::shouldReceive('driver')->with('google')->andReturn($driver);

        $response = $this->get('/auth/google/callback');

        $response->assertRedirect('/admin');

        $target = $response->headers->get('Location');
        $this->assertStringStartsWith('/', $target);
        $this->assertStringNotContainsString('contoh-lain.test', $target);
    }

    public function test_error_oauth_juga_relatif(): void
    {
        config(['app.frontend_url' => 'http://contoh-lain.test:4173']);

        $driver = \Mockery::mock();
        $driver->shouldReceive('stateless')->andReturnSelf();
        $driver->shouldReceive('user')->andThrow(new \RuntimeException('oauth down'));
        Socialite::shouldReceive('driver')->with('google')->andReturn($driver);

        $response = $this->get('/auth/google/callback');

        $response->assertRedirect('/login?error=oauth_failed');
        $this->assertStringStartsWith('/', $response->headers->get('Location'));
    }

    public function test_helper_menormalkan_path_tanpa_slash_di_depan(): void
    {
        $response = FrontendRedirect::to('dashboard');

        $this->assertInstanceOf(RedirectResponse::class, $response);
        // Path dinormalkan menjadi relatif, TANPA diabsolutkan ke APP_URL.
        $this->assertSame('/dashboard', $response->headers->get('Location'));
    }

    public function test_helper_membiarkan_url_absolut_bila_memang_diberikan(): void
    {
        $response = FrontendRedirect::to('https://mitra.test/masuk');

        $this->assertSame('https://mitra.test/masuk', $response->headers->get('Location'));
    }

    public function test_destination_admin_dan_vendor_berbeda(): void
    {
        $resolver = new UserAccessResolver();

        $admin = new User(['role' => User::ROLE_ADMIN]);
        $vendor = new User(['role' => User::ROLE_VENDOR]);

        $this->assertSame('/admin', $resolver->destinationFor($admin));
        $this->assertSame('/dashboard', $resolver->destinationFor($vendor));
    }
}
