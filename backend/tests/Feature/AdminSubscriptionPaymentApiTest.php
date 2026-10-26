<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji API riwayat transaksi langganan untuk panel admin.
 *
 * Admin memantau pembayaran gateway per vendor (pending/paid/failed/expired/
 * refunded) — bentuk respons mengikuti tipe `AdminSubscriptionPayment` di UI.
 */
class AdminSubscriptionPaymentApiTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;
    private Plan $plan;

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

        $this->plan = Plan::create([
            'code' => 'monthly',
            'name' => 'Bulanan',
            'duration_months' => 1,
            'price' => 50000,
            'is_active' => true,
        ]);
    
        $this->loginAsAdmin();
    }

    private function makePayment(array $overrides = []): SubscriptionPayment
    {
        static $sequence = 0;
        $sequence++;

        return SubscriptionPayment::create(array_merge([
            'vendor_id' => $this->vendor->id,
            'plan_id' => $this->plan->id,
            'order_id' => "PAY-2026-{$sequence}",
            'gateway' => 'midtrans',
            'amount' => 50000,
            'status' => 'paid',
            'payment_method' => 'midtrans-qris',
            'paid_at' => '2026-10-20 10:00:00',
        ], $overrides));
    }

    public function test_riwayat_transaksi_per_vendor(): void
    {
        $this->makePayment();

        $this->getJson("/api/admin/vendors/{$this->vendor->id}/payments")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.reference', 'PAY-2026-1')
            ->assertJsonPath('0.vendorId', (string) $this->vendor->id)
            ->assertJsonPath('0.planName', 'Bulanan')
            ->assertJsonPath('0.amount', 50000)
            ->assertJsonPath('0.status', 'paid')
            ->assertJsonPath('0.method', 'midtrans-qris')
            ->assertJsonPath('0.paidAt', '2026-10-20');
    }

    public function test_terbaru_di_atas(): void
    {
        $old = $this->makePayment(['order_id' => 'PAY-LAMA']);
        $old->forceFill(['created_at' => now()->subDays(5)])->save();

        $this->makePayment(['order_id' => 'PAY-BARU']);

        $references = array_column(
            $this->getJson("/api/admin/vendors/{$this->vendor->id}/payments")->assertOk()->json(),
            'reference',
        );

        $this->assertSame(['PAY-BARU', 'PAY-LAMA'], $references);
    }

    public function test_metode_fallback_ke_gateway_bila_kosong(): void
    {
        $this->makePayment(['payment_method' => null, 'gateway' => 'duitku']);

        $this->getJson("/api/admin/vendors/{$this->vendor->id}/payments")
            ->assertOk()
            ->assertJsonPath('0.method', 'duitku');
    }

    public function test_status_pending_tanpa_tanggal_bayar(): void
    {
        $this->makePayment([
            'status' => 'pending',
            'paid_at' => null,
            'order_id' => 'PAY-PENDING',
        ]);

        $this->getJson("/api/admin/vendors/{$this->vendor->id}/payments")
            ->assertOk()
            ->assertJsonPath('0.status', 'pending')
            ->assertJsonPath('0.paidAt', null)
            ->assertJsonPath('0.createdAt', now()->toDateString());
    }

    public function test_vendor_tanpa_transaksi_mengembalikan_daftar_kosong(): void
    {
        $this->getJson("/api/admin/vendors/{$this->vendor->id}/payments")
            ->assertOk()
            ->assertJsonCount(0);
    }

    public function test_transaksi_vendor_lain_tidak_ikut(): void
    {
        $otherUser = User::create([
            'name' => 'Vendor Lain',
            'email' => 'lain@example.test',
            'password' => 'password',
        ]);
        $other = Vendor::create([
            'user_id' => $otherUser->id,
            'name' => 'Vendor Lain',
            'slug' => 'vendor-lain',
        ]);

        $this->makePayment();
        $this->makePayment(['vendor_id' => $other->id, 'order_id' => 'PAY-OTHER']);

        $this->getJson("/api/admin/vendors/{$this->vendor->id}/payments")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.vendorId', (string) $this->vendor->id);
    }

    public function test_vendor_tidak_dikenal_menghasilkan_404(): void
    {
        $this->getJson('/api/admin/vendors/99999/payments')->assertNotFound();
    }
}
