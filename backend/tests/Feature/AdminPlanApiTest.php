<?php

namespace Tests\Feature;

use App\Models\Plan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji API manajemen harga paket langganan untuk admin.
 *
 * Admin mengatur harga (boleh dikosongkan = "Segera") dan status aktif paket.
 * Identitas paket (code/nama/durasi) tidak bisa diubah dari endpoint ini.
 */
class AdminPlanApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->loginAsAdmin();
    }

    private function makePlans(): void
    {
        Plan::create([
            'code' => 'monthly',
            'name' => 'Bulanan',
            'duration_months' => 1,
            'price' => 50000,
            'is_active' => true,
        ]);
        Plan::create([
            'code' => 'quarterly',
            'name' => '3 Bulan',
            'duration_months' => 3,
            'price' => null,
            'is_active' => true,
        ]);
        Plan::create([
            'code' => 'yearly',
            'name' => 'Tahunan',
            'duration_months' => 12,
            'price' => null,
            'is_active' => true,
        ]);
    }

    public function test_daftar_paket_urut_durasi_dengan_harga_nullable(): void
    {
        $this->makePlans();

        $response = $this->getJson('/api/admin/plans')->assertOk();

        $this->assertSame(
            ['Bulanan', '3 Bulan', 'Tahunan'],
            array_column($response->json(), 'name'),
        );

        $response->assertJsonPath('0.price', 50000)
            ->assertJsonPath('1.price', null)
            ->assertJsonPath('0.durationMonths', 1)
            ->assertJsonPath('0.isActive', true);
    }

    public function test_menetapkan_harga_paket(): void
    {
        $this->makePlans();
        $quarterly = Plan::query()->where('code', 'quarterly')->firstOrFail();

        $this->putJson("/api/admin/plans/{$quarterly->id}", ['price' => 135000])
            ->assertOk()
            ->assertJsonPath('price', 135000)
            ->assertJsonPath('name', '3 Bulan');

        $this->assertDatabaseHas('plans', ['id' => $quarterly->id, 'price' => 135000]);
    }

    public function test_mengosongkan_harga_menjadi_segera(): void
    {
        $this->makePlans();
        $monthly = Plan::query()->where('code', 'monthly')->firstOrFail();

        $this->patchJson("/api/admin/plans/{$monthly->id}", ['price' => null])
            ->assertOk()
            ->assertJsonPath('price', null);

        $this->assertNull($monthly->fresh()->price);
    }

    public function test_menonaktifkan_paket(): void
    {
        $this->makePlans();
        $yearly = Plan::query()->where('code', 'yearly')->firstOrFail();

        $this->patchJson("/api/admin/plans/{$yearly->id}", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('isActive', false);

        $this->assertFalse($yearly->fresh()->is_active);
    }

    public function test_harga_harus_lebih_besar_dari_nol(): void
    {
        $this->makePlans();
        $monthly = Plan::query()->where('code', 'monthly')->firstOrFail();

        $this->putJson("/api/admin/plans/{$monthly->id}", ['price' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors('price');
    }

    public function test_harga_harus_angka(): void
    {
        $this->makePlans();
        $monthly = Plan::query()->where('code', 'monthly')->firstOrFail();

        $this->putJson("/api/admin/plans/{$monthly->id}", ['price' => 'gratis'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('price');
    }

    public function test_paket_tidak_dikenal_menghasilkan_404(): void
    {
        $this->putJson('/api/admin/plans/99999', ['price' => 50000])->assertNotFound();
    }

    /**
     * `code` tetap tidak bisa diubah — itu penanda internal untuk sorotan
     * katalog. Tetapi `duration_months` SEKARANG bisa diubah, karena modal
     * edit admin menyediakan field "Masa aktif (bulan)".
     */
    public function test_code_tidak_bisa_diubah_tetapi_durasi_bisa(): void
    {
        $this->makePlans();
        $monthly = Plan::query()->where('code', 'monthly')->firstOrFail();

        $this->putJson("/api/admin/plans/{$monthly->id}", [
            'price' => 75000,
            'code' => 'yearly',
            'duration_months' => 12,
        ])->assertOk();

        $fresh = $monthly->fresh();

        // code diabaikan: tetap monthly.
        $this->assertSame('monthly', $fresh->code);

        // durasi berubah sesuai isian admin.
        $this->assertSame(12, $fresh->duration_months);

        $this->assertSame('75000.00', $fresh->price);
    }
}
