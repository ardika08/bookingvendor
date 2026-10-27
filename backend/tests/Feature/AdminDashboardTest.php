<?php

namespace Tests\Feature;

use App\Models\{Subscription, SubscriptionPayment, User, Vendor};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Dashboard admin: jumlah vendor + pendapatan langganan aplikasi.
 *
 * Cakupan sengaja dibatasi — admin tidak butuh data booking atau pemasukan
 * vendor. Tes di bawah juga memastikan angka itu TIDAK ikut terhitung:
 * booking dan pembayaran klien dibuat besar, lalu dipastikan pendapatan
 * langganan tetap hanya berasal dari `subscription_payments`.
 */
class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    private function buatAdmin(): User
    {
        return User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'is_active' => true,
        ]);
    }

    private function buatVendor(string $nama, bool $aktif = true): Vendor
    {
        $user = User::factory()->create([
            'role' => User::ROLE_VENDOR,
            'is_active' => true,
        ]);

        return Vendor::create([
            'user_id' => $user->id,
            'name' => $nama,
            'slug' => str()->slug($nama),
            'is_active' => $aktif,
        ]);
    }

    /** Buat langganan + transaksi lunas pada bulan tertentu. */
    private function buatPembayaranLangganan(Vendor $vendor, float $jumlah, ?string $paidAt = null): void
    {
        $plan = \App\Models\Plan::query()->firstOrCreate(
            ['code' => 'monthly'],
            ['name' => 'Bulanan', 'duration_months' => 1, 'price' => 50_000, 'is_active' => true],
        );

        $subscription = Subscription::create([
            'vendor_id' => $vendor->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'starts_at' => now()->subMonth()->toDateString(),
            'ends_at' => now()->addMonth()->toDateString(),
        ]);

        SubscriptionPayment::create([
            'subscription_id' => $subscription->id,
            'vendor_id' => $vendor->id,
            'plan_id' => $plan->id,
            'order_id' => 'ORD-'.uniqid(),
            'gateway' => 'duitku',
            'amount' => $jumlah,
            'status' => 'paid',
            'paid_at' => $paidAt ?? now(),
        ]);
    }

    public function test_summary_menghitung_vendor_dan_pendapatan_langganan(): void
    {
        $admin = $this->buatAdmin();

        $v1 = $this->buatVendor('Vendor Alpha', true);
        $v2 = $this->buatVendor('Vendor Beta', true);
        $this->buatVendor('Vendor Gamma', false);

        $this->buatPembayaranLangganan($v1, 50_000, now()->toDateTimeString());
        $this->buatPembayaranLangganan($v2, 150_000, now()->subMonths(2)->toDateTimeString());

        $response = $this->actingAs($admin)->getJson('/api/admin/dashboard/summary');

        $response->assertOk()
            ->assertJsonPath('vendors.total', 3)
            ->assertJsonPath('vendors.active', 2)
            ->assertJsonPath('vendors.inactive', 1)
            ->assertJsonPath('subscription.revenueTotal', 200000)
            ->assertJsonPath('subscription.revenueThisMonth', 50000)
            ->assertJsonPath('subscription.paidCount', 2);
    }

    public function test_pendapatan_tidak_menghitung_booking_atau_pembayaran_klien(): void
    {
        $admin = $this->buatAdmin();
        $vendor = $this->buatVendor('Vendor Alpha');

        // Data operasional vendor dalam jumlah besar — TIDAK boleh masuk
        // hitungan pendapatan aplikasi.
        $client = \App\Models\Client::create([
            'vendor_id' => $vendor->id,
            'name' => 'Klien Uji',
            'phone' => '0812',
        ]);
        $booking = \App\Models\Booking::create([
            'vendor_id' => $vendor->id,
            'client_id' => $client->id,
            'event_date' => now()->toDateString(),
            'status' => 'confirmed',
            'total_price' => 99_000_000,
        ]);
        $invoice = \App\Models\Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-X',
            'public_token' => 'tok-x',
            'type' => 'dp',
            'amount' => 99_000_000,
            'paid_amount' => 99_000_000,
            'status' => 'paid',
            'due_date' => now()->addDays(7)->toDateString(),
            'link_active' => true,
        ]);
        \App\Models\Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 99_000_000,
            'method' => 'transfer',
            'paid_at' => now(),
            'created_by' => $vendor->user_id,
        ]);

        $this->buatPembayaranLangganan($vendor, 50_000, now()->toDateTimeString());

        $response = $this->actingAs($admin)->getJson('/api/admin/dashboard/summary');

        // Hanya 50rb dari langganan; 99jt dari booking klien diabaikan.
        $response->assertOk()->assertJsonPath('subscription.revenueTotal', 50000);
    }

    public function test_summary_menolak_vendor(): void
    {
        $vendor = $this->buatVendor('Vendor Biasa');

        $this->actingAs($vendor->user)
            ->getJson('/api/admin/dashboard/summary')
            ->assertForbidden();
    }

    public function test_revenue_series_hanya_pendapatan_langganan(): void
    {
        $admin = $this->buatAdmin();
        $v1 = $this->buatVendor('Vendor Alpha');
        $v2 = $this->buatVendor('Vendor Beta');

        $this->buatPembayaranLangganan($v1, 50_000, now()->toDateTimeString());
        $this->buatPembayaranLangganan($v2, 100_000, now()->toDateTimeString());

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/dashboard/revenue-series?months=6');

        $response->assertOk()->assertJsonStructure(['series', 'totals', 'months']);

        $this->assertEquals(150_000.0, $response->json('totals.revenue'));

        // Bulan berjalan harus memuat kedua transaksi.
        $currentMonth = now()->format('Y-m');
        $point = collect($response->json('series'))->firstWhere('month', $currentMonth);
        $this->assertNotNull($point);
        $this->assertEquals(150_000.0, $point['revenue']);
        $this->assertSame(2, $point['paymentCount']);
    }

    public function test_revenue_series_transaksi_belum_lunas_tidak_dihitung(): void
    {
        $admin = $this->buatAdmin();
        $vendor = $this->buatVendor('Vendor Alpha');

        $plan = \App\Models\Plan::query()->firstOrCreate(
            ['code' => 'monthly'],
            ['name' => 'Bulanan', 'duration_months' => 1, 'price' => 50_000, 'is_active' => true],
        );
        SubscriptionPayment::create([
            'vendor_id' => $vendor->id,
            'plan_id' => $plan->id,
            'order_id' => 'ORD-PENDING',
            'gateway' => 'duitku',
            'amount' => 500_000,
            'status' => 'pending',
            'paid_at' => null,
        ]);

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/dashboard/revenue-series?months=6');

        $response->assertOk();
        $this->assertEquals(0.0, $response->json('totals.revenue'));
    }

    public function test_revenue_series_menolak_vendor(): void
    {
        $vendor = $this->buatVendor('Vendor Biasa');

        $this->actingAs($vendor->user)
            ->getJson('/api/admin/dashboard/revenue-series')
            ->assertForbidden();
    }

    public function test_revenue_series_tanpa_login_menolak(): void
    {
        $this->getJson('/api/admin/dashboard/revenue-series')->assertUnauthorized();
    }
}
