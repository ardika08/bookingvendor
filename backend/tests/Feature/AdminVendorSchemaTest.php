<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Skema vendor untuk panel admin "Kelola Vendor".
 *
 * Admin mengelola *akun* vendor: menambah, mengubah, dan mengaktifkan/
 * menonaktifkan. Skema harus mendukung daftar yang terfilter status akun dan
 * dicari berdasarkan nama usaha, tanpa pernah kehilangan riwayat data vendor
 * yang dinonaktifkan (nonaktif bukan hapus).
 */
class AdminVendorSchemaTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $email = 'vendor@example.test'): User
    {
        return User::create([
            'name' => 'Dika Pratama',
            'email' => $email,
            'password' => 'password',
        ]);
    }

    private function makeVendor(array $overrides = []): Vendor
    {
        static $sequence = 0;
        $sequence++;

        return Vendor::create(array_merge([
            'user_id' => $this->makeUser("vendor{$sequence}@example.test")->id,
            'name' => 'Lumen Wedding Story',
            'slug' => "lumen-wedding-story-{$sequence}",
        ], $overrides));
    }

    public function test_kolom_vendor_yang_dipakai_admin_lengkap(): void
    {
        foreach ([
            'name',
            'slug',
            'category_id',
            'is_active',
            'location',
            'contact',
            'contact_email',
            'created_at',
        ] as $column) {
            $this->assertTrue(
                Schema::hasColumn('vendors', $column),
                "Kolom vendors.{$column} tidak ditemukan.",
            );
        }
    }

    public function test_vendor_baru_default_aktif(): void
    {
        $this->assertTrue($this->makeVendor()->fresh()->is_active);
    }

    public function test_daftar_dapat_difilter_status_akun(): void
    {
        $this->makeVendor(['name' => 'Aktif Satu', 'is_active' => true]);
        $this->makeVendor(['name' => 'Aktif Dua', 'is_active' => true]);
        $this->makeVendor(['name' => 'Nonaktif Tiga', 'is_active' => false]);

        $this->assertSame(2, Vendor::query()->where('is_active', true)->count());
        $this->assertSame(1, Vendor::query()->where('is_active', false)->count());
    }

    public function test_daftar_dapat_dicari_berdasarkan_nama(): void
    {
        $this->makeVendor(['name' => 'Lumen Wedding Story']);
        $this->makeVendor(['name' => 'Aurora Frame']);

        $this->assertSame(
            1,
            Vendor::query()->where('name', 'like', '%aurora%')->count(),
        );
    }

    public function test_kategori_vendor_terhubung_dan_aman_saat_dihapus(): void
    {
        $category = Category::create(['name' => 'Wedding Organizer', 'slug' => 'wo']);
        $vendor = $this->makeVendor(['category_id' => $category->id]);

        $this->assertTrue($vendor->category->is($category));

        $category->delete();

        $this->assertNull($vendor->fresh()->category_id);
        $this->assertDatabaseCount('vendors', 1);
    }

    public function test_satu_akun_hanya_satu_profil_vendor(): void
    {
        $user = $this->makeUser();

        Vendor::create(['user_id' => $user->id, 'name' => 'Usaha Pertama', 'slug' => 'usaha-pertama']);

        $this->expectException(UniqueConstraintViolationException::class);

        Vendor::create(['user_id' => $user->id, 'name' => 'Usaha Kedua', 'slug' => 'usaha-kedua']);
    }

    public function test_slug_vendor_unik(): void
    {
        $this->makeVendor(['slug' => 'lumen']);

        $this->expectException(UniqueConstraintViolationException::class);

        $this->makeVendor(['slug' => 'lumen']);
    }

    public function test_vendor_wajib_punya_akun(): void
    {
        $this->expectException(\Illuminate\Database\QueryException::class);

        Vendor::create(['user_id' => 99999, 'name' => 'Tanpa Akun', 'slug' => 'tanpa-akun']);
    }

    public function test_menonaktifkan_vendor_tidak_menghapus_datanya(): void
    {
        $vendor = $this->makeVendor(['is_active' => true]);

        $vendor->update(['is_active' => false]);

        $this->assertFalse($vendor->fresh()->is_active);
        $this->assertDatabaseCount('vendors', 1);
    }

    public function test_indeks_admin_tersedia(): void
    {
        $indexes = collect(DB::select('PRAGMA index_list(vendors)'))
            ->pluck('name')
            ->all();

        // Indeks nama mengikuti konvensi Laravel: {table}_{column}_index.
        $this->assertContains('vendors_is_active_index', $indexes);
        $this->assertContains('vendors_name_index', $indexes);
    }
}
