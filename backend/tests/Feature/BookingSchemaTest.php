<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Package;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Verifikasi skema & aturan permintaan booking vendor.
 *
 * Booking adalah inti operasional: menyimpan klien, paket, tanggal acara,
 * status, dan nilai kontrak. Aturan penting yang dikunci di sini adalah status
 * mana yang menempati tanggal dan transisi status yang sah.
 */
class BookingSchemaTest extends TestCase
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
            'status' => 'tentative',
            'total_price' => 15000000,
        ], $overrides));
    }

    public function test_kolom_tabel_booking_lengkap(): void
    {
        foreach ([
            'id',
            'vendor_id',
            'client_id',
            'package_id',
            'event_date',
            'event_time',
            'event_location',
            'event_details',
            'status',
            'total_price',
            'created_at',
            'updated_at',
        ] as $column) {
            $this->assertTrue(
                Schema::hasColumn('bookings', $column),
                "Kolom bookings.{$column} tidak ditemukan.",
            );
        }
    }

    public function test_nilai_awal_booking(): void
    {
        $booking = $this->makeBooking()->fresh();

        $this->assertSame('tentative', $booking->status);
        $this->assertSame('2026-11-14', $booking->event_date->toDateString());
        $this->assertSame('15000000.00', $booking->total_price);
        $this->assertTrue($booking->occupiesDate());
    }

    public function test_booking_bisa_tanpa_paket(): void
    {
        $booking = $this->makeBooking();

        $this->assertNull($booking->package_id);
        $this->assertNull($booking->package);
    }

    public function test_booking_terhubung_ke_paket(): void
    {
        $package = Package::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Paket Gold',
            'price' => 15000000,
        ]);

        $booking = $this->makeBooking(['package_id' => $package->id]);

        $this->assertTrue($booking->package->is($package));
    }

    public function test_hanya_status_aktif_yang_menempati_tanggal(): void
    {
        $this->assertTrue($this->makeBooking(['status' => 'tentative'])->occupiesDate());
        $this->assertTrue($this->makeBooking(['status' => 'confirmed'])->occupiesDate());
        $this->assertTrue($this->makeBooking(['status' => 'completed'])->occupiesDate());

        $cancelled = $this->makeBooking(['status' => 'cancelled', 'event_date' => '2026-12-01']);
        $this->assertFalse($cancelled->occupiesDate());
        $this->assertTrue($cancelled->isCancelled());
    }

    public function test_scope_occupying_date_mengabaikan_booking_batal(): void
    {
        $this->makeBooking(['event_date' => '2026-11-14', 'status' => 'confirmed']);
        $this->makeBooking(['event_date' => '2026-11-20', 'status' => 'cancelled']);

        $this->assertSame(1, Booking::query()->occupyingDate()->count());
    }

    public function test_scope_in_month_menyaring_per_bulan(): void
    {
        $this->makeBooking(['event_date' => '2026-11-14']);
        $this->makeBooking(['event_date' => '2026-11-30']);
        $this->makeBooking(['event_date' => '2026-12-01']);

        $this->assertSame(2, Booking::query()->inMonth('2026-11')->count());
        $this->assertSame(1, Booking::query()->inMonth('2026-12')->count());
    }

    public function test_transisi_status_yang_sah(): void
    {
        $booking = $this->makeBooking(['status' => 'tentative']);

        $this->assertTrue($booking->canTransitionTo('confirmed'));
        $this->assertTrue($booking->canTransitionTo('cancelled'));
        $this->assertFalse($booking->canTransitionTo('completed'));

        $booking->update(['status' => 'confirmed']);
        $this->assertTrue($booking->fresh()->canTransitionTo('completed'));

        $booking->update(['status' => 'completed']);
        $this->assertSame([], $booking->fresh()->availableTransitions());
        $this->assertFalse($booking->fresh()->canTransitionTo('cancelled'));
    }

    public function test_booking_batal_bisa_diaktifkan_lagi(): void
    {
        $booking = $this->makeBooking(['status' => 'cancelled']);

        $this->assertSame(['tentative'], $booking->availableTransitions());
    }

    public function test_menghapus_vendor_menghapus_booking(): void
    {
        $this->makeBooking();

        $this->vendor->delete();

        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_menghapus_paket_tidak_menghapus_booking(): void
    {
        $package = Package::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Paket Gold',
            'price' => 15000000,
        ]);

        $booking = $this->makeBooking(['package_id' => $package->id]);
        $package->delete();

        $this->assertNull($booking->fresh()->package_id);
        $this->assertDatabaseCount('bookings', 1);
    }
}
