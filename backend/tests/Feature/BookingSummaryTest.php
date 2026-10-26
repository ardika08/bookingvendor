<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Endpoint agregat `GET /api/bookings/summary`.
 *
 * Kartu ringkasan di halaman booking butuh angka seluruh periode, bukan hanya
 * baris yang kebetulan ada di halaman tabel aktif. Tes ini mengunci dua hal
 * yang mudah rusak diam-diam:
 *
 *  1. Angka dihitung dari seluruh data vendor, bukan dari satu halaman.
 *  2. Filter (`month`, `q`, `status`) benar-benar mempersempit angka, supaya
 *     kartu tidak bertentangan dengan tabel di bawahnya.
 */
class BookingSummaryTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Vendor $vendor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create(['role' => User::ROLE_VENDOR]);
        $this->vendor = Vendor::create([
            'user_id' => $this->user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
            'phone' => '081200000000',
            'email' => 'vendor@example.com',
            'city' => 'Bandung',
        ]);
    }

    private function booking(string $date, string $status, int $price, string $name = 'Klien Uji'): Booking
    {
        $client = Client::create([
            'vendor_id' => $this->vendor->id,
            'name' => $name,
            'phone' => '0812'.random_int(10000000, 99999999),
            'email' => null,
        ]);

        return Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $client->id,
            'package_id' => null,
            'event_date' => $date,
            'event_time' => '09:00',
            'event_location' => 'Bandung',
            'status' => $status,
            'total_price' => $price,
            'notes' => null,
        ]);
    }

    public function test_ringkasan_menghitung_seluruh_booking_bukan_satu_halaman(): void
    {
        /* 15 booking: cukup untuk membuktikan angka tidak dibatasi per_page. */
        for ($i = 1; $i <= 15; $i++) {
            $this->booking(sprintf('2026-11-%02d', $i), Booking::STATUS_CONFIRMED, 1_000_000);
        }

        $response = $this->actingAs($this->user)->getJson('/api/bookings/summary');

        $response->assertOk();
        $response->assertJsonPath('total', 15);
        $response->assertJsonPath('byStatus.confirmed', 15);
        $response->assertJsonPath('revenue', 15_000_000);
    }

    public function test_nilai_kontrak_hanya_menghitung_terkonfirmasi_dan_selesai(): void
    {
        $this->booking('2026-11-01', Booking::STATUS_CONFIRMED, 5_000_000);
        $this->booking('2026-11-02', Booking::STATUS_COMPLETED, 3_000_000);
        $this->booking('2026-11-03', Booking::STATUS_TENTATIVE, 7_000_000);
        $this->booking('2026-11-04', Booking::STATUS_CANCELLED, 9_000_000);

        $response = $this->actingAs($this->user)->getJson('/api/bookings/summary');

        $response->assertOk();
        $response->assertJsonPath('total', 4);
        /* 5jt + 3jt saja — tentatif & batal tidak dihitung sebagai pendapatan. */
        $response->assertJsonPath('revenue', 8_000_000);
        $response->assertJsonPath('byStatus.tentative', 1);
        $response->assertJsonPath('byStatus.cancelled', 1);
    }

    public function test_filter_bulan_mempersempit_angka_ringkasan(): void
    {
        $this->booking('2026-10-05', Booking::STATUS_CONFIRMED, 2_000_000);
        $this->booking('2026-11-10', Booking::STATUS_CONFIRMED, 4_000_000);
        $this->booking('2026-11-20', Booking::STATUS_TENTATIVE, 6_000_000);

        $response = $this->actingAs($this->user)->getJson('/api/bookings/summary?month=2026-11');

        $response->assertOk();
        $response->assertJsonPath('total', 2);
        $response->assertJsonPath('revenue', 4_000_000);
    }

    public function test_filter_pencarian_mempersempit_angka_ringkasan(): void
    {
        $this->booking('2026-11-01', Booking::STATUS_CONFIRMED, 2_000_000, 'Rani & Bagas');
        $this->booking('2026-11-02', Booking::STATUS_CONFIRMED, 5_000_000, 'Dita & Yoga');

        $response = $this->actingAs($this->user)->getJson('/api/bookings/summary?q=Rani');

        $response->assertOk();
        $response->assertJsonPath('total', 1);
        $response->assertJsonPath('revenue', 2_000_000);
    }

    public function test_ringkasan_terpisah_antar_vendor(): void
    {
        $this->booking('2026-11-01', Booking::STATUS_CONFIRMED, 5_000_000);

        $otherUser = User::factory()->create(['role' => User::ROLE_VENDOR]);
        $otherVendor = Vendor::create([
            'user_id' => $otherUser->id,
            'name' => 'Vendor Lain',
            'slug' => 'vendor-lain',
            'phone' => '081200000001',
            'email' => 'lain@example.com',
            'city' => 'Jakarta',
        ]);
        $otherClient = Client::create([
            'vendor_id' => $otherVendor->id,
            'name' => 'Klien Lain',
            'phone' => '081299999999',
            'email' => null,
        ]);
        Booking::create([
            'vendor_id' => $otherVendor->id,
            'client_id' => $otherClient->id,
            'package_id' => null,
            'event_date' => '2026-11-05',
            'event_time' => '10:00',
            'event_location' => 'Jakarta',
            'status' => Booking::STATUS_CONFIRMED,
            'total_price' => 99_000_000,
            'notes' => null,
        ]);

        $response = $this->actingAs($this->user)->getJson('/api/bookings/summary');

        $response->assertOk();
        $response->assertJsonPath('total', 1);
        $response->assertJsonPath('revenue', 5_000_000);
    }

    public function test_ringkasan_menolak_tanpa_sesi(): void
    {
        $this->getJson('/api/bookings/summary')->assertUnauthorized();
    }
}
