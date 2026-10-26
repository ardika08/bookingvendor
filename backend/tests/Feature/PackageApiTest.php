<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Package;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji CRUD katalog paket layanan (`/api/packages`).
 *
 * Fokus: bentuk camelCase + usageCount sesuai frontend, urutan aktif-dulu
 * harga termurah, filter status/kata kunci, dan aturan hapus (paket terpakai
 * hanya boleh dinonaktifkan).
 */
class PackageApiTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;
    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Vendor Uji',
            'email' => 'vendor@example.test',
            'password' => 'password',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
        ]);

        $this->client = Client::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Rani & Bagas',
            'phone' => '6281234567890',
        ]);
    }

    private function makePackage(array $overrides = []): Package
    {
        return Package::create(array_merge([
            'vendor_id' => $this->vendor->id,
            'name' => 'Paket Silver',
            'price' => 8500000,
            'description' => '1 crew, 6 jam.',
            'duration_hours' => 6,
            'is_active' => true,
        ], $overrides));
    }

    public function test_daftar_paket_urut_aktif_dulu_lalu_harga_termurah(): void
    {
        $this->makePackage(['name' => 'Gold', 'price' => 15000000]);
        $this->makePackage(['name' => 'Silver', 'price' => 8500000]);
        $this->makePackage(['name' => 'Nonaktif Mahal', 'price' => 1000000, 'is_active' => false]);

        $response = $this->getJson('/api/packages')->assertOk();

        $this->assertSame(
            ['Silver', 'Gold', 'Nonaktif Mahal'],
            array_column($response->json(), 'name'),
        );
    }

    public function test_daftar_paket_menyertakan_jumlah_pemakaian(): void
    {
        $package = $this->makePackage(['name' => 'Gold']);

        Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'package_id' => $package->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);

        $this->getJson('/api/packages')
            ->assertOk()
            ->assertJsonPath('0.usageCount', 1);
    }

    public function test_filter_status_dan_kata_kunci(): void
    {
        $this->makePackage(['name' => 'Silver Aktif', 'price' => 8500000]);
        $this->makePackage(['name' => 'Platinum Aktif', 'price' => 24500000]);
        $this->makePackage(['name' => 'Intimate Nonaktif', 'price' => 4500000, 'is_active' => false]);

        $this->getJson('/api/packages?active=1')
            ->assertOk()
            ->assertJsonCount(2);

        $this->getJson('/api/packages?active=0')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Intimate Nonaktif');

        $this->getJson('/api/packages?q=platinum')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Platinum Aktif');
    }

    public function test_membuat_paket_baru(): void
    {
        $this->postJson('/api/packages', [
            'name' => 'Paket Gold',
            'price' => 15000000,
            'duration_hours' => 10,
            'description' => 'Full day + album.',
            'active' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('name', 'Paket Gold')
            ->assertJsonPath('price', 15000000)
            ->assertJsonPath('durationHours', 10)
            ->assertJsonPath('active', true)
            ->assertJsonPath('usageCount', 0);

        $this->assertDatabaseHas('packages', [
            'vendor_id' => $this->vendor->id,
            'name' => 'Paket Gold',
            'is_active' => true,
        ]);
    }

    public function test_paket_baru_default_aktif(): void
    {
        $this->postJson('/api/packages', [
            'name' => 'Paket Hemat',
            'price' => 4500000,
        ])
            ->assertCreated()
            ->assertJsonPath('active', true)
            ->assertJsonPath('durationHours', null);
    }

    public function test_validasi_paket_baru(): void
    {
        $this->postJson('/api/packages', [
            'name' => '',
            'price' => 0,
            'duration_hours' => 72,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'price', 'duration_hours']);
    }

    public function test_mengubah_paket(): void
    {
        $package = $this->makePackage();

        $this->putJson("/api/packages/{$package->id}", [
            'name' => 'Paket Gold Revisi',
            'price' => 17500000,
            'active' => false,
        ])
            ->assertOk()
            ->assertJsonPath('name', 'Paket Gold Revisi')
            ->assertJsonPath('price', 17500000)
            ->assertJsonPath('active', false);

        $this->assertDatabaseHas('packages', [
            'id' => $package->id,
            'name' => 'Paket Gold Revisi',
        ]);
    }

    public function test_durasi_bisa_dikosongkan(): void
    {
        $package = $this->makePackage(['duration_hours' => 6]);

        $this->putJson("/api/packages/{$package->id}", ['duration_hours' => null])
            ->assertOk()
            ->assertJsonPath('durationHours', null);
    }

    public function test_paket_belum_dipakai_bisa_dihapus(): void
    {
        $package = $this->makePackage();

        $this->deleteJson("/api/packages/{$package->id}")->assertNoContent();

        $this->assertDatabaseMissing('packages', ['id' => $package->id]);
    }

    public function test_paket_yang_sudah_dipakai_tidak_bisa_dihapus(): void
    {
        $package = $this->makePackage();

        Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'package_id' => $package->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);

        $this->deleteJson("/api/packages/{$package->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Paket sudah dipakai booking. Nonaktifkan saja supaya riwayat tetap akurat.');

        $this->assertDatabaseHas('packages', ['id' => $package->id]);
    }

    public function test_paket_terpisah_antar_vendor(): void
    {
        $user = User::create([
            'name' => 'Vendor Lain',
            'email' => 'lain@example.test',
            'password' => 'password',
        ]);
        $other = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Vendor Lain',
            'slug' => 'vendor-lain',
        ]);

        Package::create([
            'vendor_id' => $other->id,
            'name' => 'Paket Milik Lain',
            'price' => 1000000,
        ]);
        $this->makePackage(['name' => 'Paket Sendiri']);

        $this->getJson('/api/packages')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Paket Sendiri');
    }
}
