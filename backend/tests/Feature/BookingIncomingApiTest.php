<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Package;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji endpoint daftar pesanan masuk (`GET /api/bookings/incoming`).
 *
 * "Pesanan masuk" = booking berstatus `tentative` yang menunggu konfirmasi
 * vendor — kartu utama di dashboard.
 */
class BookingIncomingApiTest extends TestCase
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
            'email' => 'rani@example.test',
        ]);
    
        $this->loginAsVendorOf($this->vendor);
    }

    private function makeBooking(array $overrides = []): Booking
    {
        return Booking::create(array_merge([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'event_time' => '08:00',
            'event_location' => 'Balai Kartini, Jakarta',
            'event_details' => 'Crew datang 1 jam lebih awal.',
            'status' => 'tentative',
            'total_price' => 15000000,
        ], $overrides));
    }

    public function test_hanya_booking_tentative_yang_muncul(): void
    {
        $this->makeBooking(['status' => 'tentative']);
        $this->makeBooking(['status' => 'confirmed', 'event_date' => '2026-11-15']);
        $this->makeBooking(['status' => 'completed', 'event_date' => '2026-11-16']);
        $this->makeBooking(['status' => 'cancelled', 'event_date' => '2026-11-17']);

        $response = $this->getJson('/api/bookings/incoming')->assertOk();

        $this->assertSame(1, $response->json('total'));
        $this->assertCount(1, $response->json('items'));
        $response->assertJsonPath('items.0.status', 'tentative');
    }

    public function test_urut_tanggal_acara_terdekat_dulu(): void
    {
        $this->makeBooking(['event_date' => '2026-11-20']);
        $this->makeBooking(['event_date' => '2026-11-14']);
        $this->makeBooking(['event_date' => '2026-11-17', 'event_time' => '06:00']);
        $this->makeBooking(['event_date' => '2026-11-17', 'event_time' => '09:00']);

        $response = $this->getJson('/api/bookings/incoming')->assertOk();

        $dates = array_map(
            fn ($item) => $item['eventDate'] . ' ' . $item['eventTime'],
            $response->json('items'),
        );

        $this->assertSame([
            '2026-11-14 08:00',
            '2026-11-17 06:00',
            '2026-11-17 09:00',
            '2026-11-20 08:00',
        ], $dates);
    }

    public function test_bentuk_respons_sesuai_kontrak_frontend(): void
    {
        $package = Package::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Paket Gold',
            'price' => 15000000,
        ]);

        $booking = $this->makeBooking(['package_id' => $package->id]);

        // Satu invoice terlampir → invoiceCount terbawa.
        Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV/2026/10/0001',
            'public_token' => 'token-1',
            'type' => 'dp',
            'amount' => 6000000,
            'paid_amount' => 0,
            'status' => Invoice::STATUS_UNPAID,
            'due_date' => '2026-10-30',
        ]);

        $response = $this->getJson('/api/bookings/incoming')->assertOk();

        $response->assertJsonPath('items.0.id', (string) $booking->id)
            ->assertJsonPath('items.0.client.name', 'Rani & Bagas')
            ->assertJsonPath('items.0.client.phone', '6281234567890')
            ->assertJsonPath('items.0.client.email', 'rani@example.test')
            ->assertJsonPath('items.0.packageName', 'Paket Gold')
            ->assertJsonPath('items.0.eventDate', '2026-11-14')
            ->assertJsonPath('items.0.eventTime', '08:00')
            ->assertJsonPath('items.0.totalPrice', 15000000)
            ->assertJsonPath('items.0.notes', 'Crew datang 1 jam lebih awal.')
            ->assertJsonPath('items.0.invoiceCount', 1)
            ->assertJsonPath('items.0.status', 'tentative');
    }

    public function test_filter_bulan(): void
    {
        $this->makeBooking(['event_date' => '2026-11-14']);
        $this->makeBooking(['event_date' => '2026-11-28']);
        $this->makeBooking(['event_date' => '2026-12-05']);

        $response = $this->getJson('/api/bookings/incoming?month=2026-11')->assertOk();

        $this->assertSame(2, $response->json('total'));

        $dates = array_column($response->json('items'), 'eventDate');
        $this->assertSame(['2026-11-14', '2026-11-28'], $dates);
    }

    public function test_limit_untuk_kartu_dashboard(): void
    {
        $this->makeBooking(['event_date' => '2026-11-14']);
        $this->makeBooking(['event_date' => '2026-11-15']);
        $this->makeBooking(['event_date' => '2026-11-16']);

        $response = $this->getJson('/api/bookings/incoming?limit=2')->assertOk();

        // `total` tetap menghitung seluruh pesanan; `items` hanya 2 terdekat.
        $this->assertSame(3, $response->json('total'));
        $this->assertCount(2, $response->json('items'));
    }

    public function test_tanpa_pesanan_mengembalikan_daftar_kosong(): void
    {
        $this->getJson('/api/bookings/incoming')
            ->assertOk()
            ->assertJsonPath('total', 0)
            ->assertJsonPath('items', []);
    }

    public function test_pesanan_terpisah_antar_vendor(): void
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

        $client = Client::create([
            'vendor_id' => $other->id,
            'name' => 'Klien Lain',
            'phone' => '085711122233',
        ]);

        Booking::create([
            'vendor_id' => $other->id,
            'client_id' => $client->id,
            'event_date' => '2026-11-14',
            'status' => 'tentative',
            'total_price' => 1000000,
        ]);

        // Endpoint tanpa konteks auth memakai vendor pertama; pesanan vendor
        // lain tidak ikut tampil.
        $response = $this->getJson('/api/bookings/incoming')->assertOk();

        $this->assertSame(0, $response->json('total'));
    }
}
