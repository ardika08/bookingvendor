<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji tautan portofolio vendor.
 *
 * Vendor fotografer menampilkan hasil kerjanya lewat URL eksternal
 * (Instagram/website/Drive). URL wajib https agar tidak jadi jalur tautan
 * tidak aman, dan tampil di halaman jadwal publik.
 */
class VendorPortfolioTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Rani Foto',
            'email' => 'rani@example.test',
            'password' => 'password',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Rani Photography',
            'slug' => 'rani-photography',
            'is_active' => true,
            'schedule_link_active' => true,
        ]);

        $this->loginAsVendorOf($this->vendor);
    }

    public function test_menyimpan_tautan_portofolio(): void
    {
        $response = $this->putJson('/api/vendor/profile', [
            'business_name' => 'Rani Photography',
            'portfolio_url' => 'https://instagram.com/raniphotography',
            'portfolio_label' => 'Instagram portofolio',
        ]);

        $response->assertOk()
            ->assertJsonPath('portfolioUrl', 'https://instagram.com/raniphotography')
            ->assertJsonPath('portfolioLabel', 'Instagram portofolio');

        $this->assertDatabaseHas('vendors', [
            'id' => $this->vendor->id,
            'portfolio_url' => 'https://instagram.com/raniphotography',
            'portfolio_label' => 'Instagram portofolio',
        ]);
    }

    public function test_menolak_tautan_tanpa_https(): void
    {
        $response = $this->putJson('/api/vendor/profile', [
            'business_name' => 'Rani Photography',
            'portfolio_url' => 'http://instagram.com/raniphotography',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['portfolio_url']);
    }

    public function test_tautan_tampil_di_jadwal_publik(): void
    {
        $this->vendor->update([
            'portfolio_url' => 'https://ranifoto.com/portofolio',
            'portfolio_label' => 'Portofolio lengkap',
        ]);

        $response = $this->getJson('/api/public/schedules/rani-photography');

        $response->assertOk()
            ->assertJsonPath('vendor.portfolioUrl', 'https://ranifoto.com/portofolio')
            ->assertJsonPath('vendor.portfolioLabel', 'Portofolio lengkap');
    }

    public function test_label_dikosongkan_saat_tautan_dihapus(): void
    {
        $this->vendor->update([
            'portfolio_url' => 'https://ranifoto.com',
            'portfolio_label' => 'Portofolio',
        ]);

        $this->putJson('/api/vendor/profile', [
            'business_name' => 'Rani Photography',
            'portfolio_url' => null,
            'portfolio_label' => 'Portofolio',
        ])->assertOk();

        $this->assertDatabaseHas('vendors', [
            'id' => $this->vendor->id,
            'portfolio_url' => null,
            'portfolio_label' => null,
        ]);
    }
}
