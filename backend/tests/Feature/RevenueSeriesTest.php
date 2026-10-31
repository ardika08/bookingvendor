<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Models\Vendor;
use App\Services\RevenueSeries;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Endpoint seri pendapatan (grafik dashboard).
 *
 * Dua hal yang mudah salah dan karena itu diuji eksplisit di sini:
 * 1. Booking **batal** tidak boleh ikut menghitung nilai kontrak.
 * 2. Jumlah bulan yang diminta tidak bisa melampaui batas yang ditentukan,
 *    supaya satu vendor tidak meminta seluruh riwayat usahanya.
 */
class RevenueSeriesTest extends TestCase
{
    use RefreshDatabase;

    private RevenueSeries $series;

    protected function setUp(): void
    {
        parent::setUp();
        $this->series = new RevenueSeries();
    }

    public function test_endpoint_membutuhkan_login(): void
    {
        $this->getJson('/api/revenue/series')->assertStatus(401);
    }

    public function test_grafik_memakai_booking_confirmed_dan_completed_tanpa_yang_batal(): void
    {
        $vendor = $this->vendorWithBookings();

        $this->actingAsUser($vendor)
            ->getJson('/api/revenue/series?months=3')
            ->assertOk()
            ->assertJsonPath('months', 3)
            ->assertJsonCount(3, 'series');
    }

    public function test_booking_batal_tidak_menggelembungkan_nilai_kontrak(): void
    {
        $series = $this->series->build(
            [
                $this->booking('2026-08-10', 12_000_000, Booking::STATUS_CONFIRMED),
                $this->booking('2026-08-12', 40_000_000, Booking::STATUS_CANCELLED),
            ],
            [],
            '2026-08',
            1,
        );

        $this->assertSame(12_000_000.0, $series[0]['contractValue']);
        // Jumlah booking tetap terhitung: batal tetap acara yang dicatat.
        $this->assertSame(2, $series[0]['bookingCount']);
    }

    public function test_seri_diurut_kronologis_bukan_kebalikan(): void
    {
        $series = $this->series->build([], [], '2026-10', 4);

        $this->assertSame(
            ['2026-07', '2026-08', '2026-09', '2026-10'],
            array_column($series, 'month'),
        );
    }

    /**
     * Jendela bulan harus tepat, apa pun tanggal hari ini.
     *
     * Regresi: `Carbon::createFromFormat('Y-m', ...)` mengisi tanggal dari
     * waktu sekarang. Pada tanggal 30–31 bulan melompat (diamati `2025-02` →
     * `2025-03-03`), sehingga grafik menampilkan bulan yang salah dan booking
     * di bulan itu hilang dari total. Tes ini dijalankan pada tanggal berapa
     * pun, jadi tidak boleh bergantung pada hari ini.
     */
    public function test_jendela_bulan_tepat_tanpa_terpengaruh_tanggal_hari_ini(): void
    {
        Carbon::setTestNow('2026-10-31 23:00:00');

        try {
            $series = $this->series->build([], [], '2026-09', 2);

            $this->assertSame(['2026-08', '2026-09'], array_column($series, 'month'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_label_bulan_pakai_bahasa_indonesia(): void
    {
        $series = $this->series->build([], [], '2026-01', 2);

        $this->assertSame('Des', $series[0]['label']);
        $this->assertSame('Jan', $series[1]['label']);
    }

    public function test_permintaan_bulan_melebihi_batas_dibatasi(): void
    {
        $series = $this->series->build([], [], '2026-10', 99);

        $this->assertCount(RevenueSeries::MAX_MONTHS, $series);
    }

    public function test_total_terhitung_dari_seluruh_titik_bukan_halaman(): void
    {
        $series = $this->series->build(
            [
                $this->booking('2026-08-10', 5_000_000, Booking::STATUS_CONFIRMED),
                $this->booking('2026-09-10', 7_500_000, Booking::STATUS_COMPLETED),
            ],
            [new Payment(['amount' => 2_000_000, 'paid_at' => '2026-08-20'])],
            '2026-09',
            2,
        );

        $this->assertSame(12_500_000.0, $this->series->totalContractValue($series));
        $this->assertSame(2_000_000.0, $this->series->totalPaid($series));
    }

    public function test_tanpa_bulan_akhir_memakai_bulan_berjalan(): void
    {
        $series = $this->series->build([], [], null, 3);

        $this->assertCount(3, $series);
        $this->assertSame(now()->format('Y-m'), $series[2]['month']);
    }

    public function test_endpoint_mengembalikan_total_untuk_kartu_ringkasan(): void
    {
        $vendor = $this->vendorWithBookings();

        $payload = $this->actingAsUser($vendor)
            ->getJson('/api/revenue/series?months=6')
            ->assertOk()
            ->json();

        $this->assertArrayHasKey('totals', $payload);
        $this->assertArrayHasKey('contractValue', $payload['totals']);
        $this->assertArrayHasKey('paid', $payload['totals']);
    }

    public function test_bulan_di_luar_jendela_tidak_dihitung(): void
    {
        $series = $this->series->build(
            [$this->booking('2025-01-10', 9_000_000, Booking::STATUS_CONFIRMED)],
            [],
            '2026-10',
            6,
        );

        $this->assertSame(0.0, $this->series->totalContractValue($series));
    }

    /**
     * Regresi: controller sempat memilih kolom `event_date` + `total_price`
     * tanpa `status`, sehingga `$booking->status` null dan `contractValue`
     * selalu nol — grafik tetap terlihat "normal" tapi garisnya rata di nol.
     * Endpoint diuji end-to-end supaya hilangnya kolom ketahuan.
     */
    public function test_endpoint_menghitung_nilai_kontrak_bukan_nol(): void
    {
        $vendor = $this->vendorWithBookings();

        $payload = $this->actingAsUser($vendor)
            ->getJson('/api/revenue/series?months=6')
            ->assertOk()
            ->json();

        $this->assertGreaterThan(
            0.0,
            $payload['totals']['contractValue'],
            'contractValue nol: kolom `status` tidak ikut di-query.',
        );
        $this->assertGreaterThan(0.0, $payload['totals']['paid']);
    }

    public function test_booking_di_luar_status_aktif_masih_terhitung_sebagai_acara(): void
    {
        $series = $this->series->build(
            [
                $this->booking('2026-10-10', 10_000_000, Booking::STATUS_CONFIRMED),
                $this->booking('2026-10-12', 4_000_000, Booking::STATUS_TENTATIVE),
            ],
            [],
            '2026-10',
            1,
        );

        $this->assertSame(10_000_000.0, $series[0]['contractValue']);
        $this->assertSame(2, $series[0]['bookingCount']);
    }

    /** Vendor dengan satu klien dan beberapa booking lintas bulan. */
    private function vendorWithBookings(): Vendor
    {
        $user = User::factory()->create(['role' => User::ROLE_VENDOR]);
        $vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
            'phone' => '081200000000',
            'email' => 'vendor@example.com',
            'city' => 'Bandung',
        ]);
        $client = Client::create([
            'vendor_id' => $vendor->id,
            'name' => 'Rani Kusuma',
            'phone' => '081234567890',
            'email' => 'rani@example.com',
        ]);

        $confirmed = Booking::create([
            'vendor_id' => $vendor->id,
            'client_id' => $client->id,
            'status' => Booking::STATUS_CONFIRMED,
            'total_price' => 12_000_000,
            'event_date' => now()->startOfMonth()->toDateString(),
        ]);

        $invoice = Invoice::create([
            'booking_id' => $confirmed->id,
            'invoice_number' => 'INV/TEST/0001',
            'public_token' => 'tok-test-0001',
            'status' => Invoice::STATUS_PAID,
            'type' => 'dp',
            'amount' => 6_000_000,
            'paid_amount' => 6_000_000,
            'due_date' => now()->addWeek()->toDateString(),
        ]);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 6_000_000,
            'method' => 'transfer',
            'paid_at' => now()->startOfMonth()->toDateString(),
            'created_by' => $user->id,
        ]);

        return $vendor;
    }

    private function booking(string $date, int $price, string $status): Booking
    {
        $booking = new Booking();
        $booking->event_date = $date;
        $booking->total_price = $price;
        $booking->status = $status;

        return $booking;
    }

    private function actingAsUser(Vendor $vendor): static
    {
        return $this->actingAs($vendor->user);
    }
}
