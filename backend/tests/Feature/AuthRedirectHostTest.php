<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\UserAccessResolver;
use App\Support\FrontendRedirect;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\RedirectResponse;
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
