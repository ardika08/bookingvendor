<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorSchedule;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Verifikasi skema ketersediaan jadwal vendor.
 *
 * Satu tanggal hanya boleh punya satu penanda per vendor: baik `booked`
 * (terpakai booking) maupun `blocked` (ditutup manual). Unique index inilah
 * yang menjadi jaring pengaman anti double booking di level database.
 */
class VendorScheduleSchemaTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;
    private int $clientId;

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

        $client = Client::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Rani & Bagas',
            'phone' => '6281234567890',
        ]);
        $this->clientId = $client->id;
    
        $this->loginAsVendorOf($this->vendor);
    }

    private function makeBooking(string $date = '2026-11-14'): Booking
    {
        return Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->clientId,
            'event_date' => $date,
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);
    }

    public function test_kolom_tabel_jadwal_lengkap(): void
    {
        foreach ([
            'id',
            'vendor_id',
            'date',
            'booking_id',
            'type',
            'note',
            'created_at',
            'updated_at',
        ] as $column) {
            $this->assertTrue(
                Schema::hasColumn('vendor_schedules', $column),
                "Kolom vendor_schedules.{$column} tidak ditemukan.",
            );
        }
    }

    public function test_tanggal_terblokir_manual(): void
    {
        $schedule = VendorSchedule::create([
            'vendor_id' => $this->vendor->id,
            'date' => '2026-12-25',
            'type' => VendorSchedule::TYPE_BLOCKED,
            'note' => 'Libur Natal',
        ]);

        $this->assertTrue($schedule->isBlocked());
        $this->assertNull($schedule->booking_id);
        $this->assertSame('2026-12-25', $schedule->fresh()->date->toDateString());
    }

    public function test_tanggal_terpakai_booking_menyimpan_relasi(): void
    {
        $booking = $this->makeBooking();

        $schedule = VendorSchedule::create([
            'vendor_id' => $this->vendor->id,
            'date' => $booking->event_date,
            'booking_id' => $booking->id,
            'type' => VendorSchedule::TYPE_BOOKED,
        ]);

        $this->assertTrue($schedule->booking->is($booking));
        $this->assertFalse($schedule->isBlocked());
    }

    public function test_satu_tanggal_hanya_satu_penanda_per_vendor(): void
    {
        VendorSchedule::create([
            'vendor_id' => $this->vendor->id,
            'date' => '2026-11-14',
            'type' => VendorSchedule::TYPE_BLOCKED,
        ]);

        $this->expectException(UniqueConstraintViolationException::class);

        VendorSchedule::create([
            'vendor_id' => $this->vendor->id,
            'date' => '2026-11-14',
            'type' => VendorSchedule::TYPE_BLOCKED,
            'note' => 'Duplikat',
        ]);
    }

    public function test_vendor_berbeda_boleh_menandai_tanggal_yang_sama(): void
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

        VendorSchedule::create([
            'vendor_id' => $this->vendor->id,
            'date' => '2026-11-14',
            'type' => VendorSchedule::TYPE_BLOCKED,
        ]);
        VendorSchedule::create([
            'vendor_id' => $other->id,
            'date' => '2026-11-14',
            'type' => VendorSchedule::TYPE_BLOCKED,
        ]);

        $this->assertDatabaseCount('vendor_schedules', 2);
    }

    public function test_scope_menyaring_tipe_dan_vendor(): void
    {
        $booking = $this->makeBooking('2026-11-14');

        VendorSchedule::create([
            'vendor_id' => $this->vendor->id,
            'date' => '2026-11-14',
            'booking_id' => $booking->id,
            'type' => VendorSchedule::TYPE_BOOKED,
        ]);
        VendorSchedule::create([
            'vendor_id' => $this->vendor->id,
            'date' => '2026-12-25',
            'type' => VendorSchedule::TYPE_BLOCKED,
        ]);

        $this->assertSame(1, VendorSchedule::query()->booked()->count());
        $this->assertSame(1, VendorSchedule::query()->blocked()->count());
        $this->assertSame(
            2,
            VendorSchedule::query()->forVendor($this->vendor->id)->count(),
        );
        $this->assertCount(2, $this->vendor->schedules);
    }

    public function test_menghapus_vendor_menghapus_jadwalnya(): void
    {
        VendorSchedule::create([
            'vendor_id' => $this->vendor->id,
            'date' => '2026-12-25',
            'type' => VendorSchedule::TYPE_BLOCKED,
        ]);

        $this->vendor->delete();

        $this->assertDatabaseCount('vendor_schedules', 0);
    }

    public function test_menghapus_booking_melepas_penanda_terpakai(): void
    {
        $booking = $this->makeBooking();

        VendorSchedule::create([
            'vendor_id' => $this->vendor->id,
            'date' => $booking->event_date,
            'booking_id' => $booking->id,
            'type' => VendorSchedule::TYPE_BOOKED,
        ]);

        $booking->delete();

        $this->assertDatabaseCount('vendor_schedules', 0);
    }
}
