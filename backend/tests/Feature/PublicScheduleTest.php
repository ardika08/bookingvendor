<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Package;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Jadwal publik vendor.
 *
 * Halaman ini dapat dibuka siapa pun yang tahu slug, jadi test paling penting
 * di sini bukan "apakah datanya tampil" melainkan "apakah data pribadi klien
 * ikut bocor". Karena itu ada test khusus yang memastikan respons TIDAK
 * memuat nama klien, telepon, atau harga booking.
 */
class PublicScheduleTest extends TestCase
{
    use RefreshDatabase;

    public function test_jadwal_publik_menampilkan_tanggal_terpakai(): void
    {
        $vendor = $this->vendor();

        VendorSchedule::query()->create([
            'vendor_id' => $vendor->id,
            'date' => '2027-03-10',
            'type' => VendorSchedule::TYPE_BOOKED,
        ]);
        VendorSchedule::query()->create([
            'vendor_id' => $vendor->id,
            'date' => '2027-03-20',
            'type' => VendorSchedule::TYPE_BLOCKED,
        ]);
        // Bulan lain tidak boleh ikut.
        VendorSchedule::query()->create([
            'vendor_id' => $vendor->id,
            'date' => '2027-04-01',
            'type' => VendorSchedule::TYPE_BOOKED,
        ]);

        $this->getJson('/api/public/schedules/'.$vendor->slug.'?month=2027-03')
            ->assertOk()
            ->assertJsonPath('month', '2027-03')
            ->assertJsonPath('vendor.businessName', 'Lumen Wedding Story')
            ->assertJsonCount(2, 'unavailableDates')
            ->assertJsonPath('unavailableDates.0', '2027-03-10')
            ->assertJsonPath('unavailableDates.1', '2027-03-20');
    }

    public function test_jadwal_publik_tidak_membocorkan_data_klien(): void
    {
        $vendor = $this->vendor();
        $package = $this->package($vendor);

        $client = Client::query()->create([
            'vendor_id' => $vendor->id,
            'name' => 'Rani Rahasia',
            'phone' => '081299998888',
        ]);

        Booking::query()->create([
            'vendor_id' => $vendor->id,
            'client_id' => $client->id,
            'package_id' => $package->id,
            'event_date' => '2027-05-15',
            // Nilai & lokasi sengaja BERBEDA dari data paket dan profil vendor,
            // supaya kemunculannya di respons benar-benar menandakan kebocoran
            // dan bukan sekadar data publik yang sah.
            'event_location' => 'Gedung Rahasia Klien',
            'status' => Booking::STATUS_CONFIRMED,
            'total_price' => 98765432,
        ]);

        VendorSchedule::query()->create([
            'vendor_id' => $vendor->id,
            'date' => '2027-05-15',
            'type' => VendorSchedule::TYPE_BOOKED,
        ]);

        $response = $this->getJson('/api/public/schedules/'.$vendor->slug.'?month=2027-05')
            ->assertOk();

        $body = $response->getContent();

        // Yang boleh: tanggalnya saja.
        $this->assertStringContainsString('2027-05-15', $body);

        // Yang TIDAK boleh: identitas, kontak, nilai transaksi, dan lokasi acara.
        $this->assertStringNotContainsString('Rani Rahasia', $body);
        $this->assertStringNotContainsString('081299998888', $body);
        $this->assertStringNotContainsString('98765432', $body);
        $this->assertStringNotContainsString('Gedung Rahasia Klien', $body);
    }

    public function test_hanya_paket_aktif_yang_ditampilkan(): void
    {
        $vendor = $this->vendor();

        Package::query()->create([
            'vendor_id' => $vendor->id, 'name' => 'Paket Aktif',
            'price' => 5000000, 'duration_hours' => 8, 'is_active' => true,
        ]);
        Package::query()->create([
            'vendor_id' => $vendor->id, 'name' => 'Paket Arsip',
            'price' => 3000000, 'duration_hours' => 4, 'is_active' => false,
        ]);

        $response = $this->getJson('/api/public/schedules/'.$vendor->slug.'?month=2027-06')
            ->assertOk()
            ->assertJsonCount(1, 'vendor.packages')
            ->assertJsonPath('vendor.packages.0.name', 'Paket Aktif');

        $this->assertStringNotContainsString('Paket Arsip', $response->getContent());
    }

    public function test_vendor_tidak_aktif_dan_slug_tidak_dikenal_dibalas_404(): void
    {
        $vendor = $this->vendor();
        $vendor->forceFill(['is_active' => false])->save();

        $this->getJson('/api/public/schedules/'.$vendor->slug)->assertNotFound();
        $this->getJson('/api/public/schedules/tidak-ada')->assertNotFound();
    }

    public function test_bulan_tidak_valid_diganti_bulan_berjalan(): void
    {
        $vendor = $this->vendor();

        // Halaman publik sebaiknya tetap tampil, bukan menampilkan galat teknis.
        $this->getJson('/api/public/schedules/'.$vendor->slug.'?month=ngawur')
            ->assertOk()
            ->assertJsonPath('month', now()->format('Y-m'));
    }

    public function test_tanggal_vendor_lain_tidak_ikut_terbaca(): void
    {
        $vendor = $this->vendor();

        $lain = User::query()->create([
            'name' => 'Vendor Lain', 'email' => 'lain2@example.com', 'role' => User::ROLE_VENDOR,
        ]);
        $vendorLain = Vendor::query()->create([
            'user_id' => $lain->id, 'name' => 'Vendor Lain', 'slug' => 'vendor-lain-2',
        ]);

        VendorSchedule::query()->create([
            'vendor_id' => $vendorLain->id,
            'date' => '2027-07-07',
            'type' => VendorSchedule::TYPE_BOOKED,
        ]);

        $this->getJson('/api/public/schedules/'.$vendor->slug.'?month=2027-07')
            ->assertOk()
            ->assertJsonCount(0, 'unavailableDates');
    }

    // -----------------------------------------------------------------------

    private function vendor(): Vendor
    {
        $user = User::query()->create([
            'name' => 'Vendor Uji', 'email' => 'vendor-jadwal@example.com', 'role' => User::ROLE_VENDOR,
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
            'name' => 'Paket Utama',
            'price' => 15000000,
            'duration_hours' => 10,
            'is_active' => true,
        ]);
    }
}
