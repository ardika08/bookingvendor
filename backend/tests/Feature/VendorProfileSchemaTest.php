<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Verifikasi skema & model profil vendor.
 *
 * Profil vendor menyimpan identitas usaha, kontak publik, dan rekening transfer
 * yang dicetak di invoice. Satu akun hanya boleh punya satu profil.
 */
class VendorProfileSchemaTest extends TestCase
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

    public function test_kolom_tabel_vendor_lengkap(): void
    {
        foreach ([
            'id',
            'user_id',
            'category_id',
            'name',
            'slug',
            'description',
            'location',
            'contact',
            'bank_name',
            'bank_account_number',
            'bank_account_name',
            'schedule_link_active',
            'is_active',
            'created_at',
            'updated_at',
        ] as $column) {
            $this->assertTrue(
                Schema::hasColumn('vendors', $column),
                "Kolom vendors.{$column} tidak ditemukan.",
            );
        }
    }

    public function test_profil_terikat_satu_akun(): void
    {
        $user = $this->makeUser();

        $vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
        ]);

        $this->assertTrue($vendor->user->is($user));
        $this->assertTrue($user->fresh()->vendor->is($vendor));
    }

    public function test_user_id_unik_per_profil(): void
    {
        $user = $this->makeUser();

        Vendor::create([
            'user_id' => $user->id,
            'name' => 'Usaha Pertama',
            'slug' => 'usaha-pertama',
        ]);

        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);

        Vendor::create([
            'user_id' => $user->id,
            'name' => 'Usaha Kedua',
            'slug' => 'usaha-kedua',
        ]);
    }

    public function test_slug_harus_unik(): void
    {
        Vendor::create([
            'user_id' => $this->makeUser('a@example.test')->id,
            'name' => 'Lumen',
            'slug' => 'lumen',
        ]);

        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);

        Vendor::create([
            'user_id' => $this->makeUser('b@example.test')->id,
            'name' => 'Lumen Lain',
            'slug' => 'lumen',
        ]);
    }

    public function test_default_status_vendor(): void
    {
        $vendor = Vendor::create([
            'user_id' => $this->makeUser()->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
        ])->fresh();

        $this->assertTrue($vendor->is_active);
        $this->assertFalse($vendor->schedule_link_active);
    }

    public function test_rekening_dianggap_lengkap_hanya_bila_ketiganya_terisi(): void
    {
        $vendor = Vendor::create([
            'user_id' => $this->makeUser()->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
        ]);

        $this->assertFalse($vendor->hasCompleteBankAccount());

        $vendor->update([
            'bank_name' => 'BCA',
            'bank_account_number' => '1234567890',
        ]);
        $this->assertFalse($vendor->fresh()->hasCompleteBankAccount());

        $vendor->update(['bank_account_name' => 'Lumen Wedding Story']);
        $this->assertTrue($vendor->fresh()->hasCompleteBankAccount());
    }

    public function test_vendor_terhubung_ke_kategori(): void
    {
        $category = Category::create(['name' => 'Wedding Organizer', 'slug' => 'wedding-organizer']);

        $vendor = Vendor::create([
            'user_id' => $this->makeUser()->id,
            'category_id' => $category->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
        ]);

        $this->assertTrue($vendor->category->is($category));
        $this->assertCount(1, $category->vendors);
    }

    public function test_menghapus_kategori_tidak_menghapus_vendor(): void
    {
        $category = Category::create(['name' => 'Dekorasi', 'slug' => 'dekorasi']);

        $vendor = Vendor::create([
            'user_id' => $this->makeUser()->id,
            'category_id' => $category->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
        ]);

        $category->delete();

        $this->assertNull($vendor->fresh()->category_id);
    }

    public function test_scope_active_menyaring_vendor_nonaktif(): void
    {
        Vendor::create([
            'user_id' => $this->makeUser('aktif@example.test')->id,
            'name' => 'Aktif',
            'slug' => 'aktif',
            'is_active' => true,
        ]);
        Vendor::create([
            'user_id' => $this->makeUser('nonaktif@example.test')->id,
            'name' => 'Nonaktif',
            'slug' => 'nonaktif',
            'is_active' => false,
        ]);

        $this->assertSame(1, Vendor::query()->active()->count());
    }

    public function test_menghapus_akun_menghapus_profil_vendor(): void
    {
        $user = $this->makeUser();

        Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
        ]);

        $user->delete();

        $this->assertDatabaseCount('vendors', 0);
    }
}
