<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Login dev dengan pemilihan peran (`?as=admin|vendor`).
 *
 * Sebelumnya endpoint ini selalu mengambil user ber-role vendor, sehingga
 * panel admin tidak punya jalan masuk sama sekali: OAuth belum dikonfigurasi
 * dan tidak ada login kata sandi. Tes ini mengunci perilaku barunya.
 */
class DevLoginRoleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        putenv('DEV_LOGIN_ALLOW_PUBLIC=true');
    }

    protected function tearDown(): void
    {
        putenv('DEV_LOGIN_ALLOW_PUBLIC');
        parent::tearDown();
    }

    private function buatAdmin(): User
    {
        return User::factory()->create([
            'name' => 'Admin Uji',
            'email' => 'admin@example.com',
            'role' => User::ROLE_ADMIN,
            'is_active' => true,
        ]);
    }

    private function buatVendor(): User
    {
        $user = User::factory()->create([
            'name' => 'Vendor Uji',
            'email' => 'vendor@example.com',
            'role' => User::ROLE_VENDOR,
            'is_active' => true,
        ]);
        $user->vendor()->create(['name' => 'Usaha Uji', 'slug' => 'usaha-uji']);

        return $user;
    }

    public function test_as_admin_mendarat_di_panel_admin(): void
    {
        $admin = $this->buatAdmin();
        $this->buatVendor();

        $this->get('/auth/dev-login?as=admin')->assertRedirect('/admin');

        $this->assertAuthenticatedAs($admin);
    }

    public function test_tanpa_parameter_tetap_vendor(): void
    {
        $this->buatAdmin();
        $vendor = $this->buatVendor();

        $this->get('/auth/dev-login')->assertRedirect('/dashboard');

        $this->assertAuthenticatedAs($vendor);
    }

    public function test_as_vendor_tidak_memilih_admin(): void
    {
        $this->buatAdmin();
        $vendor = $this->buatVendor();

        $this->get('/auth/dev-login?as=vendor')->assertRedirect('/dashboard');

        $this->assertAuthenticatedAs($vendor);
    }

    public function test_nilai_as_tidak_dikenal_jatuh_ke_vendor(): void
    {
        $this->buatAdmin();
        $vendor = $this->buatVendor();

        // Mencegah parameter aneh (mis. `as=hacker`) membuka jalur tak terduga.
        $this->get('/auth/dev-login?as=hacker')->assertRedirect('/dashboard');

        $this->assertAuthenticatedAs($vendor);
    }

    public function test_as_admin_tanpa_akun_admin_mengembalikan_error(): void
    {
        $this->buatVendor();

        $this->get('/auth/dev-login?as=admin')
            ->assertRedirect('/login?error=account_not_registered');

        $this->assertGuest();
    }

    public function test_admin_nonaktif_tidak_dipilih(): void
    {
        $admin = $this->buatAdmin();
        $admin->update(['is_active' => false]);
        $this->buatVendor();

        // Pesan harus "nonaktif", bukan "belum terdaftar" — beda penanganan.
        $this->get('/auth/dev-login?as=admin')
            ->assertRedirect('/login?error=account_inactive');

        $this->assertGuest();
    }
}
