<?php

namespace Tests\Feature;

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
 * End-to-end CRUD booking.
 *
 * Menguji seluruh endpoint baru Fase 2: daftar, rincian, buat, ubah, ubah
 * status, dan taken-dates. Skenario lintas-tenant (vendor A tidak bisa membaca
 * booking vendor B) diuji di ApiAuthEnforcementTest — test ini fokus pada
 * perilaku operasional: sinkronisasi kalender, pencocokan klien, dan transisi
 * status.
 */
class BookingCrudTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;
    private Client $client;
    private Package $package;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Vendor Uji',
            'email' => 'vendor@example.test',
            'role' => User::ROLE_VENDOR,
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

        $this->package = Package::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Paket Intimate',
            'price' => 15000000,
            'duration_hours' => 8,
            'is_active' => true,
        ]);

        $this->loginAsVendorOf($this->vendor);
    }

    // ------------------------------------------------------------------
    // GET /api/bookings (daftar berhalaman)
    // ------------------------------------------------------------------

    public function test_daftar_booking_berhalaman(): void
    {
        Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'tentative',
            'total_price' => 15000000,
        ]);

        $this->getJson('/api/bookings?page=1&per_page=10')
            ->assertOk()
            ->assertJsonStructure([
                'items' => [['id', 'client', 'eventDate', 'status', 'totalPrice', 'invoiceCount']],
                'total',
                'page',
                'perPage',
            ])
            ->assertJsonPath('total', 1)
            ->assertJsonPath('page', 1)
            ->assertJsonPath('perPage', 10)
            ->assertJsonPath('items.0.client.name', 'Rani & Bagas');
    }

    public function test_daftar_booking_lengkap_tanpa_paginasi(): void
    {
        // Tanpa `page`, response adalah array polos (dipakai fetchAllBookings).
        $this->getJson('/api/bookings')
            ->assertOk()
            ->assertJson([]);

        Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);

        $this->getJson('/api/bookings')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.client.name', 'Rani & Bagas');
    }

    public function test_filter_status_dan_bulan(): void
    {
        Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 10000000,
        ]);

        Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-12-20',
            'status' => 'tentative',
            'total_price' => 5000000,
        ]);

        // Filter status
        $this->getJson('/api/bookings?status=confirmed')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.status', 'confirmed');

        // Filter bulan
        $this->getJson('/api/bookings?month=2026-12')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.eventDate', '2026-12-20');
    }

    public function test_pencarian_berdasarkan_nama_klien(): void
    {
        Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'tentative',
            'total_price' => 15000000,
        ]);

        $this->getJson('/api/bookings?q=Rani')
            ->assertOk()
            ->assertJsonCount(1);

        $this->getJson('/api/bookings?q=NonExistent')
            ->assertOk()
            ->assertJsonCount(0);
    }

    // ------------------------------------------------------------------
    // GET /api/bookings/taken-dates
    // ------------------------------------------------------------------

    public function test_taken_dates_mengembalikan_tanggal_terpakai(): void
    {
        // Booking dibuat lewat endpoint agar penanda jadwal tersinkron.
        $this->postJson('/api/bookings', [
            'client' => ['name' => 'Klien', 'phone' => '081299887766', 'email' => null],
            'event_date' => '2026-11-14',
            'event_time' => null,
            'event_location' => null,
            'package_id' => null,
            'total_price' => 15000000,
            'status' => 'confirmed',
            'notes' => null,
        ])->assertCreated();

        $this->getJson('/api/bookings/taken-dates')
            ->assertOk()
            ->assertJsonFragment(['2026-11-14']);
    }

    public function test_taken_dates_mengecualikan_booking_sendiri(): void
    {
        $booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);

        $this->getJson("/api/bookings/taken-dates?exclude={$booking->id}")
            ->assertOk()
            ->assertJsonMissing(['2026-11-14']);
    }

    public function test_taken_dates_termasuk_blokir_manual(): void
    {
        VendorSchedule::create([
            'vendor_id' => $this->vendor->id,
            'date' => '2026-12-25',
            'type' => VendorSchedule::TYPE_BLOCKED,
            'note' => 'Liburan',
        ]);

        $this->getJson('/api/bookings/taken-dates')
            ->assertOk()
            ->assertJsonFragment(['2026-12-25']);
    }

    // ------------------------------------------------------------------
    // GET /api/bookings/{booking}
    // ------------------------------------------------------------------

    public function test_rincian_booking(): void
    {
        $booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'package_id' => $this->package->id,
            'event_date' => '2026-11-14',
            'event_time' => '08:00',
            'event_location' => 'Ballroom Hotel X',
            'status' => 'confirmed',
            'total_price' => 15000000,
            'event_details' => 'Akad + resepsi',
        ]);

        $this->getJson("/api/bookings/{$booking->id}")
            ->assertOk()
            ->assertJsonPath('id', (string) $booking->id)
            ->assertJsonPath('client.name', 'Rani & Bagas')
            ->assertJsonPath('packageName', 'Paket Intimate')
            ->assertJsonPath('eventLocation', 'Ballroom Hotel X')
            ->assertJsonPath('notes', 'Akad + resepsi')
            ->assertJsonPath('status', 'confirmed');
    }

    public function test_rincian_booking_vendor_lain_ditolak_404(): void
    {
        $lainUser = User::create([
            'name' => 'Vendor Lain',
            'email' => 'lain@example.test',
            'role' => User::ROLE_VENDOR,
        ]);

        $lain = Vendor::create([
            'user_id' => $lainUser->id,
            'name' => 'Aurora Decoration',
            'slug' => 'aurora-decoration',
        ]);

        $klienLain = Client::create([
            'vendor_id' => $lain->id,
            'name' => 'Klien Aurora',
            'phone' => '628111111111',
        ]);

        $booking = Booking::create([
            'vendor_id' => $lain->id,
            'client_id' => $klienLain->id,
            'event_date' => '2026-11-14',
            'status' => 'tentative',
            'total_price' => 5000000,
        ]);

        $this->loginAsVendorOf($this->vendor)
            ->getJson("/api/bookings/{$booking->id}")
            ->assertNotFound();
    }

    // ------------------------------------------------------------------
    // POST /api/bookings
    // ------------------------------------------------------------------

    public function test_buat_booking_baru(): void
    {
        $response = $this->postJson('/api/bookings', [
            'client' => [
                'name' => 'Sari & Dimas',
                'phone' => '081299887766',
                'email' => 'sari@example.test',
            ],
            'event_date' => '2026-11-14',
            'event_time' => '09:00',
            'event_location' => 'Hotel Y',
            'package_id' => (string) $this->package->id,
            'total_price' => 15000000,
            'status' => 'tentative',
            'notes' => 'Akad pagi',
        ]);

        $response->assertCreated()
            ->assertJsonPath('client.name', 'Sari & Dimas')
            ->assertJsonPath('eventDate', '2026-11-14')
            ->assertJsonPath('eventTime', '09:00')
            ->assertJsonPath('status', 'tentative')
            ->assertJsonPath('totalPrice', 15000000)
            ->assertJsonPath('notes', 'Akad pagi');

        $this->assertDatabaseHas('bookings', [
            'vendor_id' => $this->vendor->id,
            'status' => 'tentative',
        ]);
        $this->assertNotNull(
            \App\Models\Booking::where('vendor_id', $this->vendor->id)
                ->whereDate('event_date', '2026-11-14')
                ->first(),
            'Booking pada tanggal 2026-11-14 tidak ditemukan.',
        );

        // Penanda kalender dibuat.
        $this->assertTrue(
            VendorSchedule::where('vendor_id', $this->vendor->id)
                ->whereDate('date', '2026-11-14')
                ->where('type', VendorSchedule::TYPE_BOOKED)
                ->exists(),
            'Penanda booked pada tanggal 2026-11-14 tidak ditemukan.',
        );
    }

    public function test_buat_booking_mencocokkan_klien_berdasarkan_telepon(): void
    {
        $this->postJson('/api/bookings', [
            'client' => [
                'name' => 'Rani Updated',
                'phone' => '6281234567890', // sama dgn client di setUp
                'email' => null,
            ],
            'event_date' => '2026-12-01',
            'event_time' => null,
            'event_location' => null,
            'package_id' => null,
            'total_price' => 5000000,
            'status' => 'tentative',
            'notes' => null,
        ])->assertCreated();

        // Tidak membuat client baru; memakai baris yang sudah ada.
        $this->assertDatabaseCount('clients', 1);
        $this->assertDatabaseHas('clients', ['name' => 'Rani Updated']);
    }

    public function test_buat_booking_menolak_tanggal_bentrok(): void
    {
        // Booking pertama lewat endpoint agar penanda jadwal tersinkron.
        $this->postJson('/api/bookings', [
            'client' => ['name' => 'Klien Pertama', 'phone' => '081299887766', 'email' => null],
            'event_date' => '2026-11-14',
            'event_time' => null,
            'event_location' => null,
            'package_id' => null,
            'total_price' => 10000000,
            'status' => 'confirmed',
            'notes' => null,
        ])->assertCreated();

        $this->postJson('/api/bookings', [
            'client' => ['name' => 'Klien Baru', 'phone' => '081299887766', 'email' => null],
            'event_date' => '2026-11-14',
            'event_time' => null,
            'event_location' => null,
            'package_id' => null,
            'total_price' => 5000000,
            'status' => 'tentative',
            'notes' => null,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['event_date']);
    }

    public function test_buat_booking_menolak_paket_vendor_lain(): void
    {
        $lainUser = User::create([
            'name' => 'Vendor Lain',
            'email' => 'lain@example.test',
            'role' => User::ROLE_VENDOR,
        ]);

        $lain = Vendor::create([
            'user_id' => $lainUser->id,
            'name' => 'Aurora Decoration',
            'slug' => 'aurora-decoration',
        ]);

        $packageLain = Package::create([
            'vendor_id' => $lain->id,
            'name' => 'Paket Aurora',
            'price' => 8000000,
            'duration_hours' => 6,
            'is_active' => true,
        ]);

        $this->postJson('/api/bookings', [
            'client' => ['name' => 'Klien', 'phone' => '081299887766', 'email' => null],
            'event_date' => '2026-11-14',
            'event_time' => null,
            'event_location' => null,
            'package_id' => (string) $packageLain->id,
            'total_price' => 5000000,
            'status' => 'tentative',
            'notes' => null,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['package_id']);
    }

    public function test_buat_booking_menolak_telepon_invalid(): void
    {
        $this->postJson('/api/bookings', [
            'client' => ['name' => 'Klien', 'phone' => '12345', 'email' => null],
            'event_date' => '2026-11-14',
            'event_time' => null,
            'event_location' => null,
            'package_id' => null,
            'total_price' => 5000000,
            'status' => 'tentative',
            'notes' => null,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['client.phone']);
    }

    // ------------------------------------------------------------------
    // PUT /api/bookings/{booking}
    // ------------------------------------------------------------------

    public function test_ubah_booking(): void
    {
        $booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'tentative',
            'total_price' => 15000000,
        ]);

        $this->putJson("/api/bookings/{$booking->id}", [
            'client' => ['name' => 'Rani & Bagas', 'phone' => '6281234567890', 'email' => null],
            'event_date' => '2026-11-14',
            'event_time' => '10:00',
            'event_location' => 'Hotel Z',
            'package_id' => null,
            'total_price' => 16000000,
            'status' => 'confirmed',
            'notes' => 'Reschedule jam',
        ])
            ->assertOk()
            ->assertJsonPath('eventTime', '10:00')
            ->assertJsonPath('totalPrice', 16000000)
            ->assertJsonPath('status', 'confirmed')
            ->assertJsonPath('notes', 'Reschedule jam');
    }

    public function test_ubah_booking_reschedule_menyegarkan_kalender(): void
    {
        $booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);

        $this->putJson("/api/bookings/{$booking->id}", [
            'client' => ['name' => 'Rani & Bagas', 'phone' => '6281234567890', 'email' => null],
            'event_date' => '2026-12-01',
            'event_time' => null,
            'event_location' => null,
            'package_id' => null,
            'total_price' => 15000000,
            'status' => 'confirmed',
            'notes' => null,
        ])->assertOk();

        // Tanggal lama dilepas, tanggal baru ditempati.
        $this->assertFalse(
            VendorSchedule::where('vendor_id', $this->vendor->id)
                ->whereDate('date', '2026-11-14')
                ->exists(),
            'Penanda tanggal lama seharusnya sudah dilepas.',
        );
        $this->assertTrue(
            VendorSchedule::where('vendor_id', $this->vendor->id)
                ->whereDate('date', '2026-12-01')
                ->where('booking_id', $booking->id)
                ->where('type', VendorSchedule::TYPE_BOOKED)
                ->exists(),
            'Penanda booked pada tanggal baru tidak ditemukan.',
        );
    }

    public function test_ubah_booking_menolak_transisi_status_tidak_sah(): void
    {
        $booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'completed',
            'total_price' => 15000000,
        ]);

        $this->putJson("/api/bookings/{$booking->id}", [
            'client' => ['name' => 'Rani & Bagas', 'phone' => '6281234567890', 'email' => null],
            'event_date' => '2026-11-14',
            'event_time' => null,
            'event_location' => null,
            'package_id' => null,
            'total_price' => 15000000,
            'status' => 'tentative', // tidak sah: completed → tentative
            'notes' => null,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    // ------------------------------------------------------------------
    // PATCH /api/bookings/{booking}/status
    // ------------------------------------------------------------------

    public function test_ubah_status_konfirmasi(): void
    {
        $booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'tentative',
            'total_price' => 15000000,
        ]);

        $this->patchJson("/api/bookings/{$booking->id}/status", [
            'status' => 'confirmed',
        ])
            ->assertOk()
            ->assertJsonPath('status', 'confirmed');
    }

    public function test_ubah_status_batal_melepas_tanggal(): void
    {
        $booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);

        $this->patchJson("/api/bookings/{$booking->id}/status", [
            'status' => 'cancelled',
        ])->assertOk();

        $this->assertFalse(
            VendorSchedule::where('vendor_id', $this->vendor->id)
                ->whereDate('date', '2026-11-14')
                ->where('booking_id', $booking->id)
                ->exists(),
            'Penanda booked seharusnya dilepas setelah batal.',
        );
    }

    public function test_ubah_status_menolak_lompatan_tidak_sah(): void
    {
        $booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'completed',
            'total_price' => 15000000,
        ]);

        $this->patchJson("/api/bookings/{$booking->id}/status", [
            'status' => 'tentative',
        ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'invalid_status_transition');
    }

    public function test_aktifkan_kembali_booking_batal_menolak_tanggal_terpakai(): void
    {
        $booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'cancelled',
            'total_price' => 15000000,
        ]);

        // Booking lain pada tanggal yang sama dibuat lewat endpoint agar
        // penanda jadwal tersinkron.
        $this->postJson('/api/bookings', [
            'client' => ['name' => 'Klien Lain', 'phone' => '081299887766', 'email' => null],
            'event_date' => '2026-11-14',
            'event_time' => null,
            'event_location' => null,
            'package_id' => null,
            'total_price' => 10000000,
            'status' => 'confirmed',
            'notes' => null,
        ])->assertCreated();

        $this->patchJson("/api/bookings/{$booking->id}/status", [
            'status' => 'tentative',
        ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'date_taken');
    }

    // ------------------------------------------------------------------
    // Trial limit
    // ------------------------------------------------------------------

    /**
     * Trial kini berbasis waktu: jumlah booking tidak lagi dibatasi selama
     * masa uji masih berjalan. Dulu booking ketiga ditolak `trial_limit_reached`.
     */
    public function test_buat_booking_tidak_dibatasi_selama_masa_uji(): void
    {
        // Empat booking berturut-turut — dulu diblokir pada booking ketiga.
        for ($i = 0; $i < 4; $i++) {
            $this->postJson('/api/bookings', [
                'client' => ['name' => 'Klien '.$i, 'phone' => '08129988776'.$i, 'email' => null],
                'event_date' => '2027-0'.($i + 1).'-10',
                'event_time' => null,
                'event_location' => null,
                'package_id' => null,
                'total_price' => 5000000,
                'status' => 'tentative',
                'notes' => null,
            ])->assertCreated();
        }

        $this->assertSame(4, $this->vendor->bookings()->count());
    }

    /**
     * Setelah masa uji berakhir, booking baru ditolak dengan kode langganan
     * (bukan kode kuota yang sudah tidak dipakai).
     */
    public function test_buat_booking_menolak_setelah_masa_uji_berakhir(): void
    {
        /*
         * Vendor di tes ini belum punya baris langganan; tanpa baris,
         * `SubscriptionStatus` memperlakukannya sebagai trial tanpa batas
         * (perilaku cadangan untuk data lama). Jadi baris trial kedaluwarsa
         * harus dibuat dulu supaya batas waktunya benar-benar diuji.
         */
        DB::table('subscriptions')->insert([
            'vendor_id' => $this->vendor->id,
            'status' => 'trial',
            'starts_at' => now()->subDays(30)->toDateString(),
            'ends_at' => now()->subDay()->toDateString(),
            'trial_bookings_used' => 0,
            'trial_invoices_used' => 0,
            'amount_paid' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/bookings', [
            'client' => ['name' => 'Klien Baru', 'phone' => '081299887766', 'email' => null],
            'event_date' => '2027-01-10',
            'event_time' => null,
            'event_location' => null,
            'package_id' => null,
            'total_price' => 5000000,
            'status' => 'tentative',
            'notes' => null,
        ])
            ->assertStatus(422)
            ->assertJsonPath('code', \App\Services\SubscriptionStatus::CODE_EXPIRED);
    }
}
