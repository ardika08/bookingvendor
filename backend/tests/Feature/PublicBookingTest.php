<?php

namespace Tests\Feature;

use App\Models\Addon;
use App\Models\Booking;
use App\Models\Client;
use App\Models\Package;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Booking publik: calon klien memesan dari link jadwal tanpa akun.
 */
class PublicBookingTest extends TestCase
{
    use RefreshDatabase;

    public function test_klien_bisa_booking_tanpa_login(): void
    {
        $vendor = $this->vendor();
        $package = $this->package($vendor);
        $addon = $this->addon($vendor, 'Extra time 5 jam', 500000);
        $this->attach($package->id, $addon->id, 650000);

        $response = $this->postJson('/api/public/bookings', [
            'slug' => $vendor->slug,
            'client' => ['name' => 'Budi', 'phone' => '08123456789', 'email' => 'budi@example.com'],
            'event_date' => '2027-03-15',
            'event_time' => '09:00',
            'event_location' => 'Gedung JCC',
            'package_id' => (string) $package->id,
            'addon_ids' => [(string) $addon->id],
            'notes' => 'Tolong dokumentasi lengkap.',
        ]);

        $response->assertCreated();

        $booking = Booking::query()->firstOrFail();
        $this->assertSame(Booking::STATUS_TENTATIVE, $booking->status);
        $this->assertSame((float) 12650000, (float) $booking->total_price);
        $this->assertTrue($booking->event_date->isSameDay('2027-03-15'));

        // Snapshot addon tersimpan dengan harga pivot.
        $this->assertDatabaseHas('booking_addons', [
            'booking_id' => $booking->id,
            'name' => 'Extra time 5 jam',
            'price' => 650000,
        ]);

        // Tanggal tercatat sebagai terisi.
        $this->assertDatabaseHas('vendor_schedules', [
            'vendor_id' => $vendor->id,
            'date' => '2027-03-15 00:00:00',
        ]);
    }

    public function test_booking_gagal_saat_tanggal_sudah_terisi(): void
    {
        $vendor = $this->vendor();
        $package = $this->package($vendor);

        VendorSchedule::query()->create([
            'vendor_id' => $vendor->id,
            'date' => '2027-03-15',
            'type' => VendorSchedule::TYPE_BOOKED,
        ]);

        $this->postJson('/api/public/bookings', [
            'slug' => $vendor->slug,
            'client' => ['name' => 'Budi', 'phone' => '08123456789'],
            'event_date' => '2027-03-15',
            'package_id' => (string) $package->id,
        ])->assertStatus(422);
    }

    /**
     * Regresi: endpoint publik tidak boleh menuntut CSRF.
     *
     * Klien dari link jadwal tidak punya sesi, jadi tidak ada cookie
     * `XSRF-TOKEN`. Tanpa pengecualian di `bootstrap/app.php`, POST selalu
     * dijawab 419 dan form booking publik tidak pernah bisa dipakai.
     */
    public function test_booking_publik_tidak_menuntut_csrf(): void
    {
        $vendor = $this->vendor();
        $package = $this->package($vendor);

        // Request tanpa token CSRF sama sekali.
        $this->withMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);

        $response = $this->post('/api/public/bookings', [
            'slug' => $vendor->slug,
            'client' => ['name' => 'Budi', 'phone' => '08123456789'],
            'event_date' => '2027-04-20',
            'package_id' => (string) $package->id,
        ], ['Accept' => 'application/json']);

        $this->assertNotSame(419, $response->getStatusCode(), 'Booking publik tidak boleh ditolak karena CSRF.');
        $response->assertCreated();
    }

    private function vendor(): Vendor
    {
        $user = User::query()->create([
            'name' => 'Vendor Uji',
            'email' => 'vendor-pub-booking@example.com',
            'role' => User::ROLE_VENDOR,
        ]);

        return Vendor::query()->create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
            'location' => 'Bandung',
        ]);
    }

    private function package(Vendor $vendor): Package
    {
        return Package::query()->create([
            'vendor_id' => $vendor->id,
            'name' => 'Paket Basic',
            'price' => 12000000,
            'duration_hours' => 6,
            'is_active' => true,
        ]);
    }

    private function addon(Vendor $vendor, string $name, int $price): Addon
    {
        return Addon::query()->create([
            'vendor_id' => $vendor->id,
            'name' => $name,
            'price' => $price,
            'is_active' => true,
        ]);
    }

    private function attach(string $packageId, string $addonId, int $price): void
    {
        DB::table('package_addon')->insert([
            'package_id' => $packageId,
            'addon_id' => $addonId,
            'price' => $price,
        ]);
    }
}
