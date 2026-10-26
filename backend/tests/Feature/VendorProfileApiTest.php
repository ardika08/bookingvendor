<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji endpoint profil vendor (`/api/vendor/profile`).
 *
 * Fokus: bentuk camelCase sesuai frontend, validasi rekening all-or-none,
 * kategori yang dibuat otomatis, dan slug yang tidak berubah saat update.
 */
class VendorProfileApiTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Dika Pratama',
            'email' => 'dika@example.test',
            'password' => 'password',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
            'location' => 'Jakarta Selatan',
            'contact' => '081290001122',
        ]);
    }

    private function updatePayload(array $overrides = []): array
    {
        return array_merge([
            'business_name' => 'Lumen Wedding Story',
            'category' => 'Wedding Organizer',
            'description' => 'Wedding organizer berbasis Jakarta.',
            'contact_phone' => '081290001122',
            'contact_email' => 'hello@lumenwedding.id',
            'city' => 'Jakarta Selatan',
            'bank' => [
                'name' => 'BCA',
                'account_number' => '1234567890',
                'account_holder' => 'Lumen Wedding Story',
            ],
        ], $overrides);
    }

    public function test_menampilkan_profil_dalam_bentuk_camelcase(): void
    {
        $this->getJson('/api/vendor/profile')
            ->assertOk()
            ->assertJsonPath('businessName', 'Lumen Wedding Story')
            ->assertJsonPath('slug', 'lumen-wedding-story')
            ->assertJsonPath('contactPhone', '081290001122')
            ->assertJsonPath('city', 'Jakarta Selatan')
            ->assertJsonPath('bank.name', null);
    }

    public function test_menyimpan_profil_dan_rekening(): void
    {
        $this->putJson('/api/vendor/profile', $this->updatePayload())
            ->assertOk()
            ->assertJsonPath('businessName', 'Lumen Wedding Story')
            ->assertJsonPath('contactEmail', 'hello@lumenwedding.id')
            ->assertJsonPath('bank.name', 'BCA')
            ->assertJsonPath('bank.accountNumber', '1234567890')
            ->assertJsonPath('bank.accountHolder', 'Lumen Wedding Story');

        $this->assertDatabaseHas('vendors', [
            'id' => $this->vendor->id,
            'bank_name' => 'BCA',
            'contact_email' => 'hello@lumenwedding.id',
        ]);
    }

    public function test_slug_tidak_berubah_saat_update(): void
    {
        $this->putJson('/api/vendor/profile', $this->updatePayload([
            'business_name' => 'Nama Baru Usaha',
        ]))
            ->assertOk()
            ->assertJsonPath('slug', 'lumen-wedding-story');
    }

    public function test_kategori_baru_dibuat_otomatis(): void
    {
        $this->putJson('/api/vendor/profile', $this->updatePayload([
            'category' => 'MUA',
        ]))
            ->assertOk()
            ->assertJsonPath('category', 'MUA');

        $this->assertDatabaseHas('categories', ['name' => 'MUA']);
    }

    public function test_kategori_dengan_nama_sama_tidak_diduplikasi(): void
    {
        Category::create(['name' => 'MUA', 'slug' => 'mua']);

        $this->putJson('/api/vendor/profile', $this->updatePayload([
            'category' => 'MUA',
        ]))
            ->assertOk()
            ->assertJsonPath('category', 'MUA');

        $this->assertSame(1, Category::query()->where('name', 'MUA')->count());
    }

    public function test_kategori_dikosongkan_melepas_relasi(): void
    {
        $category = Category::create(['name' => 'MUA', 'slug' => 'mua']);
        $this->vendor->update(['category_id' => $category->id]);

        $this->putJson('/api/vendor/profile', $this->updatePayload([
            'category' => null,
        ]))
            ->assertOk()
            ->assertJsonPath('category', null);

        $this->assertNull($this->vendor->fresh()->category_id);
    }

    public function test_rekening_setengah_jadi_ditolak(): void
    {
        $this->putJson('/api/vendor/profile', $this->updatePayload([
            'bank' => ['name' => 'BCA', 'account_number' => null, 'account_holder' => null],
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('bank.name');
    }

    public function test_nomor_rekening_tidak_valid_ditolak(): void
    {
        $this->putJson('/api/vendor/profile', $this->updatePayload([
            'bank' => [
                'name' => 'BCA',
                'account_number' => 'abc123',
                'account_holder' => 'Lumen',
            ],
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('bank.account_number');
    }

    public function test_nama_usaha_wajib(): void
    {
        $this->putJson('/api/vendor/profile', $this->updatePayload([
            'business_name' => '',
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('business_name');
    }

    public function test_nomor_telepon_tidak_valid_ditolak(): void
    {
        $this->putJson('/api/vendor/profile', $this->updatePayload([
            'contact_phone' => '123',
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('contact_phone');
    }

    public function test_rekening_bisa_dihapus_seluruhnya(): void
    {
        $this->vendor->update([
            'bank_name' => 'BCA',
            'bank_account_number' => '1234567890',
            'bank_account_name' => 'Lumen',
        ]);

        $this->putJson('/api/vendor/profile', $this->updatePayload([
            'bank' => ['name' => null, 'account_number' => null, 'account_holder' => null],
        ]))
            ->assertOk()
            ->assertJsonPath('bank.name', null);

        $this->assertDatabaseHas('vendors', [
            'id' => $this->vendor->id,
            'bank_name' => null,
        ]);
    }
}
