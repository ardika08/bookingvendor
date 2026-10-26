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
 * Verifikasi skema & model paket layanan vendor.
 *
 * Paket adalah katalog harga yang dipakai ulang saat membuat booking, jadi
 * relasinya ke vendor dan booking harus utuh: menghapus vendor ikut menghapus
 * paketnya, dan paket yang sudah dipakai booking tetap bisa dihitung
 * pemakaiannya.
 */
class PackageSchemaTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;

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
    
        $this->loginAsVendorOf($this->vendor);
    }

    public function test_kolom_tabel_paket_lengkap(): void
    {
        foreach ([
            'id',
            'vendor_id',
            'name',
            'description',
            'price',
            'duration_hours',
            'is_active',
            'created_at',
            'updated_at',
        ] as $column) {
            $this->assertTrue(
                Schema::hasColumn('packages', $column),
                "Kolom packages.{$column} tidak ditemukan.",
            );
        }
    }

    public function test_paket_menyimpan_nilai_dengan_cast_yang_benar(): void
    {
        $package = Package::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Paket Gold',
            'description' => 'Full day + album',
            'price' => 15000000,
            'duration_hours' => 10,
            'is_active' => true,
        ]);

        $fresh = $package->fresh();

        $this->assertSame('15000000.00', $fresh->price);
        $this->assertSame(10, $fresh->duration_hours);
        $this->assertTrue($fresh->is_active);
    }

    public function test_paket_nonaktif_default_tidak(): void
    {
        $package = Package::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Paket Silver',
            'price' => 8500000,
        ]);

        // Default kolom is_active = true.
        $this->assertTrue($package->fresh()->is_active);
        $this->assertNull($package->fresh()->duration_hours);
    }

    public function test_paket_terikat_vendor(): void
    {
        $package = Package::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Paket Platinum',
            'price' => 24500000,
        ]);

        $this->assertTrue($package->vendor->is($this->vendor));
        $this->assertCount(1, $this->vendor->packages);
    }

    public function test_menghapus_vendor_menghapus_paketnya(): void
    {
        Package::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Paket Gold',
            'price' => 15000000,
        ]);

        $this->vendor->delete();

        $this->assertDatabaseCount('packages', 0);
    }

    public function test_menghitung_pemakaian_paket_di_booking(): void
    {
        $package = Package::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Paket Gold',
            'price' => 15000000,
        ]);

        $client = Client::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Rani & Bagas',
            'phone' => '6281234567890',
        ]);

        foreach (['2026-11-14', '2026-12-01'] as $date) {
            Booking::create([
                'vendor_id' => $this->vendor->id,
                'client_id' => $client->id,
                'package_id' => $package->id,
                'event_date' => $date,
                'status' => 'confirmed',
                'total_price' => 15000000,
            ]);
        }

        $this->assertSame(2, $package->bookings()->count());
    }

    public function test_harga_wajib_numerik_dan_tidak_negatif_bila_diisi(): void
    {
        $package = Package::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Paket Hemat',
            'price' => 4500000,
        ]);

        $this->assertSame('4500000.00', $package->fresh()->price);
    }
}
