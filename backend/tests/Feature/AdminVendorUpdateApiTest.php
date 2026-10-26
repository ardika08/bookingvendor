<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji API admin: detail, edit, dan aktif/nonaktifkan vendor.
 *
 * Aturan penting: email login tidak bisa diubah, slug publik tetap, dan
 * menonaktifkan akun tidak menghapus data apa pun.
 */
class AdminVendorUpdateApiTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Dika Pratama',
            'email' => 'dika@lumenwedding.id',
            'password' => 'password',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $this->user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
            'location' => 'Jakarta Selatan',
            'description' => 'WO berbasis Jakarta.',
            'contact' => '0812-9000-1122',
            'is_active' => true,
        ]);
    }

    public function test_detail_vendor_memuat_kontak_dan_deskripsi(): void
    {
        $this->getJson("/api/admin/vendors/{$this->vendor->id}")
            ->assertOk()
            ->assertJsonPath('id', (string) $this->vendor->id)
            ->assertJsonPath('name', 'Lumen Wedding Story')
            ->assertJsonPath('ownerName', 'Dika Pratama')
            ->assertJsonPath('email', 'dika@lumenwedding.id')
            ->assertJsonPath('city', 'Jakarta Selatan')
            ->assertJsonPath('description', 'WO berbasis Jakarta.')
            ->assertJsonPath('contact', '0812-9000-1122')
            ->assertJsonPath('isActive', true)
            ->assertJsonPath('subscription.status', 'trial');
    }

    public function test_id_tidak_dikenal_menghasilkan_404(): void
    {
        $this->getJson('/api/admin/vendors/99999')->assertNotFound();
    }

    public function test_mengubah_profil_vendor_dan_nama_pemilik(): void
    {
        $this->putJson("/api/admin/vendors/{$this->vendor->id}", [
            'name' => 'Lumen Wedding Story Baru',
            'owner_name' => 'Dika P.',
            'category' => 'Wedding Organizer',
            'city' => 'Bandung',
            'description' => 'Deskripsi baru.',
            'contact' => '0813-1111-2222',
        ])
            ->assertOk()
            ->assertJsonPath('name', 'Lumen Wedding Story Baru')
            ->assertJsonPath('ownerName', 'Dika P.')
            ->assertJsonPath('category', 'Wedding Organizer')
            ->assertJsonPath('city', 'Bandung')
            ->assertJsonPath('description', 'Deskripsi baru.')
            ->assertJsonPath('contact', '0813-1111-2222');

        $this->assertDatabaseHas('vendors', [
            'id' => $this->vendor->id,
            'name' => 'Lumen Wedding Story Baru',
            'location' => 'Bandung',
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $this->user->id,
            'name' => 'Dika P.',
            'email' => 'dika@lumenwedding.id',
        ]);
    }

    public function test_email_dan_slug_tidak_berubah_saat_update(): void
    {
        $this->putJson("/api/admin/vendors/{$this->vendor->id}", [
            'name' => 'Nama Usaha Lain',
            'owner_name' => 'Dika Pratama',
            'category' => 'Wedding Organizer',
            'email' => 'palsu@example.test',
        ])->assertOk();

        $fresh = $this->vendor->fresh();

        $this->assertSame('lumen-wedding-story', $fresh->slug);
        $this->assertSame('dika@lumenwedding.id', $fresh->user->email);
    }

    public function test_kategori_baru_dibuat_otomatis_saat_update(): void
    {
        $this->putJson("/api/admin/vendors/{$this->vendor->id}", [
            'name' => 'Lumen Wedding Story',
            'owner_name' => 'Dika Pratama',
            'category' => 'MUA',
        ])
            ->assertOk()
            ->assertJsonPath('category', 'MUA');

        $this->assertDatabaseHas('categories', ['name' => 'MUA']);
    }

    public function test_kategori_lama_tidak_diduplikasi(): void
    {
        Category::create(['name' => 'MUA', 'slug' => 'mua']);

        $this->putJson("/api/admin/vendors/{$this->vendor->id}", [
            'name' => 'Lumen Wedding Story',
            'owner_name' => 'Dika Pratama',
            'category' => 'mua',
        ])->assertOk();

        $this->assertSame(1, Category::query()->whereRaw('lower(name) = ?', ['mua'])->count());
    }

    public function test_validasi_field_wajib_saat_update(): void
    {
        $this->putJson("/api/admin/vendors/{$this->vendor->id}", [
            'name' => '',
            'owner_name' => '',
            'category' => '',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'owner_name', 'category']);
    }

    public function test_menonaktifkan_vendor_tanpa_menghapus_data(): void
    {
        $this->patchJson("/api/admin/vendors/{$this->vendor->id}/status", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('isActive', false);

        $this->assertFalse($this->vendor->fresh()->is_active);
        $this->assertDatabaseCount('vendors', 1);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_mengaktifkan_kembali_vendor(): void
    {
        $this->vendor->update(['is_active' => false]);

        $this->patchJson("/api/admin/vendors/{$this->vendor->id}/status", ['is_active' => true])
            ->assertOk()
            ->assertJsonPath('isActive', true);

        $this->assertTrue($this->vendor->fresh()->is_active);
    }

    public function test_status_wajib_boolean(): void
    {
        $this->patchJson("/api/admin/vendors/{$this->vendor->id}/status", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('is_active');
    }
}
