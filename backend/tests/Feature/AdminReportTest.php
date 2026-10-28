<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Laporan tahunan admin (`GET /api/admin/reports`).
 *
 * Yang diuji adalah KEJUJURAN ANGKA, bukan bentuk JSON semata:
 * - pendapatan hanya dari transaksi `paid`;
 * - pengelompokan bulan memakai tanggal BAYAR, bukan tanggal dibuat;
 * - transaksi di tahun lain tidak bocor ke laporan tahun ini;
 * - "segera habis" hanya 7 hari dan hanya langganan aktif.
 */
class AdminReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->loginAsAdmin();
    }

    private function makeVendor(string $name = 'Vendor Uji', ?Carbon $createdAt = null): Vendor
    {
        static $sequence = 0;
        $sequence++;

        $user = User::create([
            'name' => "Pemilik {$sequence}",
            'email' => "vendor{$sequence}@example.test",
            'password' => 'password',
        ]);

        $vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => $name,
            'slug' => "vendor-uji-{$sequence}",
            'is_active' => true,
        ]);

        if ($createdAt !== null) {
            $vendor->created_at = $createdAt;
            $vendor->save();
        }

        return $vendor;
    }

    private function makePlan(string $name = 'Bulanan'): Plan
    {
        return Plan::create([
            'code' => 'plan-'.uniqid(),
            'name' => $name,
            'duration_months' => 1,
            'price' => 50000,
            'is_active' => true,
        ]);
    }

    private function makePayment(
        Vendor $vendor,
        Plan $plan,
        float $amount,
        string $status,
        ?Carbon $paidAt = null,
        ?Carbon $createdAt = null,
    ): SubscriptionPayment {
        $createdAt ??= $paidAt ?? Carbon::now();

        $payment = new SubscriptionPayment([
            'vendor_id' => $vendor->id,
            'plan_id' => $plan->id,
            'order_id' => 'ORD-'.uniqid(),
            'gateway' => 'duitku',
            'amount' => $amount,
            'status' => $status,
            'payment_method' => 'qris',
            'paid_at' => $paidAt,
        ]);
        $payment->created_at = $createdAt;
        $payment->save();

        return $payment;
    }

    private function makeSubscription(
        Vendor $vendor,
        Plan $plan,
        string $status,
        ?Carbon $endsAt,
    ): Subscription {
        return Subscription::create([
            'vendor_id' => $vendor->id,
            'plan_id' => $plan->id,
            'status' => $status,
            'starts_at' => Carbon::today()->subMonth()->toDateString(),
            'ends_at' => $endsAt?->toDateString(),
        ]);
    }

    public function test_laporan_mengelompokkan_pendapatan_per_bulan(): void
    {
        $vendor = $this->makeVendor();
        $plan = $this->makePlan();

        $this->makePayment($vendor, $plan, 50000, 'paid', Carbon::create(2026, 3, 10));
        $this->makePayment($vendor, $plan, 150000, 'paid', Carbon::create(2026, 3, 20));
        $this->makePayment($vendor, $plan, 100000, 'paid', Carbon::create(2026, 7, 5));

        $response = $this->getJson('/api/admin/reports?year=2026')->assertOk();

        $response->assertJsonPath('year', 2026);

        $monthly = collect($response->json('revenue.monthly'))->keyBy('month');
        $this->assertSame(200000.0, (float) $monthly[3]['revenue']);
        $this->assertSame(2, $monthly[3]['count']);
        $this->assertSame(100000.0, (float) $monthly[7]['revenue']);
        // Bulan tanpa transaksi tetap ada dan bernilai nol, bukan hilang.
        $this->assertSame(0.0, (float) $monthly[1]['revenue']);
        $this->assertCount(12, $monthly);

        $this->assertSame(300000.0, (float) $response->json('revenue.total'));
        $this->assertSame(3, $response->json('revenue.paidCount'));
        $this->assertSame(100000.0, (float) $response->json('revenue.averagePerTransaction'));
    }

    /**
     * Transaksi `pending` dan `failed` TIDAK boleh masuk total pendapatan,
     * tetapi tetap terlihat di sebaran status agar admin tahu ada kegagalan.
     */
    public function test_status_selain_paid_tidak_dihitung_sebagai_pendapatan(): void
    {
        $vendor = $this->makeVendor();
        $plan = $this->makePlan();

        $this->makePayment($vendor, $plan, 50000, 'paid', Carbon::create(2026, 5, 1));
        $this->makePayment($vendor, $plan, 999000, 'pending', null, Carbon::create(2026, 5, 2));
        $this->makePayment($vendor, $plan, 888000, 'failed', null, Carbon::create(2026, 5, 3));

        $response = $this->getJson('/api/admin/reports?year=2026')->assertOk();

        $this->assertSame(50000.0, (float) $response->json('revenue.total'));
        $this->assertSame(1, $response->json('revenue.paidCount'));

        $statuses = collect($response->json('revenue.byStatus'))->keyBy('status');
        $this->assertSame(1, $statuses['paid']['count']);
        $this->assertSame(1, $statuses['pending']['count']);
        $this->assertSame(1, $statuses['failed']['count']);
    }

    /**
     * Pendapatan mengikuti tanggal BAYAR. Transaksi yang dibuat 31 Desember
     * tetapi dibayar 2 Januari harus masuk Januari tahun berikutnya.
     */
    public function test_pendapatan_memakai_tanggal_bayar_bukan_tanggal_dibuat(): void
    {
        $vendor = $this->makeVendor();
        $plan = $this->makePlan();

        $this->makePayment(
            $vendor,
            $plan,
            75000,
            'paid',
            paidAt: Carbon::create(2027, 1, 2),
            createdAt: Carbon::create(2026, 12, 31),
        );

        $report2026 = $this->getJson('/api/admin/reports?year=2026')->assertOk();
        $this->assertSame(0.0, (float) $report2026->json('revenue.total'));

        $report2027 = $this->getJson('/api/admin/reports?year=2027')->assertOk();
        $this->assertSame(75000.0, (float) $report2027->json('revenue.total'));
    }

    public function test_transaksi_tahun_lain_tidak_bocor_ke_laporan_tahun_ini(): void
    {
        $vendor = $this->makeVendor();
        $plan = $this->makePlan();

        $this->makePayment($vendor, $plan, 50000, 'paid', Carbon::create(2025, 6, 1));
        $this->makePayment($vendor, $plan, 60000, 'paid', Carbon::create(2026, 6, 1));

        $this->getJson('/api/admin/reports?year=2026')
            ->assertOk()
            ->assertJsonPath('revenue.total', 60000);
    }

    public function test_sebaran_paket_urut_dari_pendapatan_terbesar(): void
    {
        $vendor = $this->makeVendor();
        $murah = $this->makePlan('Bulanan');
        $mahal = $this->makePlan('Tahunan');

        $this->makePayment($vendor, $mahal, 480000, 'paid', Carbon::create(2026, 2, 1));
        $this->makePayment($vendor, $murah, 50000, 'paid', Carbon::create(2026, 2, 2));
        $this->makePayment($vendor, $murah, 50000, 'paid', Carbon::create(2026, 2, 3));

        $byPlan = $this->getJson('/api/admin/reports?year=2026')->assertOk()->json('revenue.byPlan');

        $this->assertSame('Tahunan', $byPlan[0]['planName']);
        $this->assertSame(480000.0, (float) $byPlan[0]['revenue']);
        $this->assertSame('Bulanan', $byPlan[1]['planName']);
        $this->assertSame(100000.0, (float) $byPlan[1]['revenue']);
    }

    public function test_vendor_baru_dihitung_per_bulan_pendaftaran(): void
    {
        $this->makeVendor('Vendor Maret A', Carbon::create(2026, 3, 4));
        $this->makeVendor('Vendor Maret B', Carbon::create(2026, 3, 9));
        $this->makeVendor('Vendor Agustus', Carbon::create(2026, 8, 1));
        $this->makeVendor('Vendor Lama', Carbon::create(2025, 1, 1));

        $response = $this->getJson('/api/admin/reports?year=2026')->assertOk();

        $monthly = collect($response->json('vendors.monthlyNew'))->keyBy('month');
        $this->assertSame(2, $monthly[3]['count']);
        $this->assertSame(1, $monthly[8]['count']);
        $this->assertSame(0, $monthly[1]['count']);

        // Hanya 3 vendor yang mendaftar di 2026.
        $this->assertSame(3, $response->json('vendors.newThisYear'));
        // Total & aktif adalah keadaan sekarang, mencakup semua tahun.
        $this->assertSame(4, $response->json('vendors.total'));
        $this->assertSame(4, $response->json('vendors.active'));
    }

    public function test_langganan_segera_habis_hanya_tujuh_hari_ke_depan(): void
    {
        $plan = $this->makePlan();
        $hariIni = Carbon::today();

        $mendesak = $this->makeVendor('Habis Besok');
        $this->makeSubscription($mendesak, $plan, Subscription::STATUS_ACTIVE, $hariIni->copy()->addDay());

        $batas = $this->makeVendor('Habis Tujuh Hari');
        $this->makeSubscription($batas, $plan, Subscription::STATUS_ACTIVE, $hariIni->copy()->addDays(7));

        $terlaluJauh = $this->makeVendor('Habis Dua Puluh Hari');
        $this->makeSubscription($terlaluJauh, $plan, Subscription::STATUS_ACTIVE, $hariIni->copy()->addDays(20));

        $sudahLewat = $this->makeVendor('Sudah Lewat');
        $this->makeSubscription($sudahLewat, $plan, Subscription::STATUS_ACTIVE, $hariIni->copy()->subDay());

        $trial = $this->makeVendor('Masih Trial');
        $this->makeSubscription($trial, $plan, Subscription::STATUS_TRIAL, $hariIni->copy()->addDays(3));

        $expiring = $this->getJson('/api/admin/reports')->assertOk()->json('expiring');

        $names = array_column($expiring, 'vendorName');
        $this->assertContains('Habis Besok', $names);
        $this->assertContains('Habis Tujuh Hari', $names);
        $this->assertNotContains('Habis Dua Puluh Hari', $names);
        $this->assertNotContains('Sudah Lewat', $names);
        $this->assertNotContains('Masih Trial', $names);

        // Urut dari yang paling mendesak.
        $this->assertSame('Habis Besok', $expiring[0]['vendorName']);
        $this->assertSame(1, $expiring[0]['daysLeft']);
        $this->assertSame(7, $expiring[1]['daysLeft']);
    }

    public function test_tahun_tanpa_data_tetap_mengembalikan_dua_belas_bulan(): void
    {
        $response = $this->getJson('/api/admin/reports?year=2019')->assertOk();

        $response->assertJsonPath('year', 2019);
        $response->assertJsonPath('revenue.total', 0);
        $this->assertCount(12, $response->json('revenue.monthly'));
        $this->assertCount(12, $response->json('vendors.monthlyNew'));
    }

    public function test_tahun_berjalan_selalu_ada_di_pilihan_tahun(): void
    {
        // Belum ada transaksi sama sekali: dropdown tidak boleh kosong.
        $years = $this->getJson('/api/admin/reports')->assertOk()->json('availableYears');

        $this->assertContains((int) now()->format('Y'), $years);
    }

    public function test_tahun_tidak_valid_ditolak(): void
    {
        $this->getJson('/api/admin/reports?year=abc')->assertStatus(422);
        $this->getJson('/api/admin/reports?year=1800')->assertStatus(422);
    }

    public function test_vendor_biasa_tidak_boleh_membuka_laporan(): void
    {
        $vendor = $this->makeVendor();
        $this->actingAs($vendor->user)->getJson('/api/admin/reports')->assertForbidden();
    }

    public function test_tamu_ditolak(): void
    {
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/admin/reports')->assertUnauthorized();
    }
}
