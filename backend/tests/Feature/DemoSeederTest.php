<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Package;
use App\Models\User;
use App\Models\Vendor;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Seeder & dev-login.
 *
 * Cacat yang dijaga di sini: `DatabaseSeeder` dulu membuat user vendor tanpa
 * baris `vendors`, sehingga login berhasil tetapi seluruh endpoint vendor
 * menjawab 403 `vendor_not_linked`.
 */
class DemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_membuat_vendor_lengkap_dengan_profil(): void
    {
        $this->seed(DatabaseSeeder::class);

        $user = User::where('email', 'test@example.com')->first();

        $this->assertNotNull($user, 'User vendor contoh harus ada.');
        $this->assertTrue($user->isVendor());
        $this->assertTrue($user->is_active);

        $vendor = $user->vendor;

        $this->assertNotNull($vendor, 'User vendor wajib punya baris vendors.');
        $this->assertSame('Lumen Wedding Story', $vendor->name);
        $this->assertSame('lumen-wedding-story', $vendor->slug);
        $this->assertTrue($vendor->is_active);
        $this->assertNotNull($vendor->category_id, 'Kategori harus terisi.');
    }

    public function test_seeder_membuat_admin_dan_kategori(): void
    {
        $this->seed(DatabaseSeeder::class);

        $admin = User::where('email', 'admin@example.com')->first();

        $this->assertNotNull($admin);
        $this->assertTrue($admin->isAdmin());
        // Admin tidak butuh profil vendor.
        $this->assertNull($admin->vendor);

        $this->assertSame(13, Category::count());
    }

    public function test_seeder_membuat_paket_termasuk_satu_nonaktif(): void
    {
        $this->seed(DatabaseSeeder::class);

        $vendor = Vendor::first();

        $this->assertSame(3, Package::where('vendor_id', $vendor->id)->count());
        $this->assertSame(2, Package::where('vendor_id', $vendor->id)->where('is_active', true)->count());
    }

    public function test_seeder_idempoten_dijalankan_dua_kali(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(DatabaseSeeder::class);

        // Tanpa `updateOrCreate`, menjalankan ulang akan menggandakan semuanya
        // dan memicu unique constraint pada slug/email.
        $this->assertSame(1, Vendor::count());
        $this->assertSame(3, Package::count());
        $this->assertSame(13, Category::count());
        $this->assertSame(2, User::count());
    }

    public function test_dev_login_masuk_sebagai_vendor_yang_punya_profil(): void
    {
        $this->seed(DatabaseSeeder::class);

        $response = $this->get('/auth/dev-login');

        $response->assertRedirect();
        $this->assertStringContainsString('/dashboard', $response->headers->get('Location'));

        $this->assertAuthenticated();
        $this->assertNotNull(auth()->user()->vendor);
    }

    public function test_dev_login_memberi_pesan_jelas_bila_profil_vendor_hilang(): void
    {
        // Akun vendor ada, tetapi tanpa baris `vendors`.
        User::create([
            'name' => 'Vendor Tanpa Profil',
            'email' => 'tanpa@example.com',
            'password' => bcrypt('password'),
            'role' => User::ROLE_VENDOR,
            'is_active' => true,
        ]);

        $response = $this->get('/auth/dev-login');

        $response->assertRedirect();
        $this->assertStringContainsString(
            'error=vendor_profile_missing',
            $response->headers->get('Location'),
        );
        $this->assertGuest();
    }

    public function test_dev_login_memberi_pesan_bila_belum_ada_akun(): void
    {
        $response = $this->get('/auth/dev-login');

        $response->assertRedirect();
        $this->assertStringContainsString(
            'error=account_not_registered',
            $response->headers->get('Location'),
        );
    }
}
