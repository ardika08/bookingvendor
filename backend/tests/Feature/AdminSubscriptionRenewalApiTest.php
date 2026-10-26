<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji aktivasi & perpanjangan langganan manual oleh admin.
 *
 * Aturan tanggal: perpanjangan menambah durasi paket ke tanggal berakhir yang
 * masih berlaku; langganan lewat/belum ada mulai dari hari ini. Penghitung
 * trial tidak pernah direset.
 */
class AdminSubscriptionRenewalApiTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;
    private Plan $monthly;
    private Plan $yearly;

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
        ]);

        $this->monthly = Plan::create([
            'code' => 'monthly',
            'name' => 'Bulanan',
            'duration_months' => 1,
            'price' => 50000,
            'is_active' => true,
        ]);

        $this->yearly = Plan::create([
            'code' => 'yearly',
            'name' => 'Tahunan',
            'duration_months' => 12,
            'price' => null,
            'is_active' => true,
        ]);
    }

    public function test_aktivasi_dari_trial_mulai_hari_ini(): void
    {
        Subscription::create([
            'vendor_id' => $this->vendor->id,
            'status' => Subscription::STATUS_TRIAL,
            'trial_bookings_used' => 2,
            'trial_invoices_used' => 1,
        ]);

        $this->postJson("/api/admin/vendors/{$this->vendor->id}/subscriptions/renew", [
            'plan_id' => $this->monthly->id,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('planName', 'Bulanan')
            ->assertJsonPath('startsAt', now()->toDateString())
            ->assertJsonPath('endsAt', now()->addMonth()->toDateString())
            ->assertJsonPath('trialBookingsUsed', 2)
            ->assertJsonPath('trialInvoicesUsed', 1);

        $this->assertDatabaseHas('subscriptions', [
            'vendor_id' => $this->vendor->id,
            'status' => Subscription::STATUS_ACTIVE,
            'plan_id' => $this->monthly->id,
        ]);
    }

    public function test_aktivasi_tanpa_baris_langganan(): void
    {
        $this->postJson("/api/admin/vendors/{$this->vendor->id}/subscriptions/renew", [
            'plan_id' => $this->monthly->id,
        ])->assertOk()->assertJsonPath('status', 'active');

        $this->assertDatabaseCount('subscriptions', 1);
    }

    public function test_perpanjangan_menambah_dari_tanggal_berakhir_yang_ada(): void
    {
        Subscription::create([
            'vendor_id' => $this->vendor->id,
            'plan_id' => $this->monthly->id,
            'status' => Subscription::STATUS_ACTIVE,
            'starts_at' => now()->subDays(10)->toDateString(),
            'ends_at' => now()->addDays(20)->toDateString(),
        ]);

        $this->postJson("/api/admin/vendors/{$this->vendor->id}/subscriptions/renew", [
            'plan_id' => $this->monthly->id,
        ])
            ->assertOk()
            ->assertJsonPath('endsAt', now()->addDays(20)->addMonth()->toDateString());
    }

    public function test_langganan_lewat_mulai_dari_hari_ini(): void
    {
        Subscription::create([
            'vendor_id' => $this->vendor->id,
            'plan_id' => $this->monthly->id,
            'status' => Subscription::STATUS_EXPIRED,
            'starts_at' => now()->subMonths(2)->toDateString(),
            'ends_at' => now()->subMonths(1)->toDateString(),
        ]);

        $this->postJson("/api/admin/vendors/{$this->vendor->id}/subscriptions/renew", [
            'plan_id' => $this->yearly->id,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('planName', 'Tahunan')
            ->assertJsonPath('startsAt', now()->subMonths(2)->toDateString())
            ->assertJsonPath('endsAt', now()->addYear()->toDateString());
    }

    public function test_paket_tanpa_harga_tetap_bisa_diaktifkan_manual(): void
    {
        $this->postJson("/api/admin/vendors/{$this->vendor->id}/subscriptions/renew", [
            'plan_id' => $this->yearly->id,
        ])->assertOk()->assertJsonPath('planName', 'Tahunan');
    }

    public function test_paket_nonaktif_ditolak(): void
    {
        $plan = Plan::create([
            'code' => 'quarterly',
            'name' => '3 Bulan',
            'duration_months' => 3,
            'price' => 120000,
            'is_active' => false,
        ]);

        $this->postJson("/api/admin/vendors/{$this->vendor->id}/subscriptions/renew", [
            'plan_id' => $plan->id,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('plan_id');
    }

    public function test_paket_tidak_dikenal_ditolak(): void
    {
        $this->postJson("/api/admin/vendors/{$this->vendor->id}/subscriptions/renew", [
            'plan_id' => 99999,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('plan_id');
    }

    public function test_paket_wajib_dipilih(): void
    {
        $this->postJson("/api/admin/vendors/{$this->vendor->id}/subscriptions/renew", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('plan_id');
    }

    public function test_vendor_tidak_dikenal_menghasilkan_404(): void
    {
        $this->postJson('/api/admin/vendors/99999/subscriptions/renew', [
            'plan_id' => $this->monthly->id,
        ])->assertNotFound();
    }
}
