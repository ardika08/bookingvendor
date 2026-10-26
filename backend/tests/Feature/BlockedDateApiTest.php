<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji endpoint blokir tanggal (`/api/blocked-dates`).
 *
 * Fokus: daftar hanya penanda `blocked`, pemblokiran tanggal (dengan duplikat
 * dan tanggal ter-booking ditolak), lepas blokir, serta pemisahan antar vendor.
 */
class BlockedDateApiTest extends TestCase
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
    }

    private function makeBooking(array $overrides = []): Booking
    {
        return Booking::create(array_merge([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ], $overrides));
    }

    public function test_daftar_hanya_memuat_penanda_blocked(): void
    {
        $booking = $this->makeBooking();
        $this->vendor->schedules()->create([
            'date' => '2026-12-25',
            'type' => VendorSchedule::TYPE_BLOCKED,
            'note' => 'Libur Natal',
        ]);
        $this->vendor->schedules()->create([
            'date' => '2026-11-14',
            'booking_id' => $booking->id,
            'type' => VendorSchedule::TYPE_BOOKED,
        ]);

        $response = $this->getJson('/api/blocked-dates')->assertOk();

        $this->assertCount(1, $response->json());
        $response->assertJsonPath('0.date', '2026-12-25')
            ->assertJsonPath('0.reason', 'Libur Natal')
            ->assertJsonPath('0.id', '1');
    }

    public function test_daftar_bisa_difilter_per_bulan(): void
    {
        $this->vendor->schedules()->create([
            'date' => '2026-12-25',
            'type' => VendorSchedule::TYPE_BLOCKED,
        ]);
        $this->vendor->schedules()->create([
            'date' => '2027-01-02',
            'type' => VendorSchedule::TYPE_BLOCKED,
        ]);

        $this->getJson('/api/blocked-dates?month=2026-12')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.date', '2026-12-25');
    }

    public function test_memblokir_tanggal_kosong(): void
    {
        $this->postJson('/api/blocked-dates', [
            'date' => '2026-11-20',
            'reason' => 'Acara keluarga',
        ])
            ->assertCreated()
            ->assertJsonPath('date', '2026-11-20')
            ->assertJsonPath('reason', 'Acara keluarga');

        // Kolom date tersimpan dengan komponen jam, jadi cek per bagian tanggal.
        $this->assertDatabaseHas('vendor_schedules', [
            'vendor_id' => $this->vendor->id,
            'type' => VendorSchedule::TYPE_BLOCKED,
            'note' => 'Acara keluarga',
        ]);
        $this->assertTrue(
            $this->vendor->schedules()->whereDate('date', '2026-11-20')->exists(),
        );
    }

    public function test_memblokir_tanpa_alasan_boleh(): void
    {
        $this->postJson('/api/blocked-dates', ['date' => '2026-11-20'])
            ->assertCreated()
            ->assertJsonPath('reason', null);
    }

    public function test_tanggal_yang_sudah_diblokir_ditolak(): void
    {
        $this->vendor->schedules()->create([
            'date' => '2026-11-20',
            'type' => VendorSchedule::TYPE_BLOCKED,
        ]);

        $this->postJson('/api/blocked-dates', ['date' => '2026-11-20'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('date');

        $response = $this->postJson('/api/blocked-dates', ['date' => '2026-11-20']);
        $this->assertSame(
            'Tanggal ini sudah diblokir.',
            $response->json('errors.date.0'),
        );
    }

    public function test_tanggal_terpakai_booking_aktif_tidak_bisa_diblokir(): void
    {
        $this->makeBooking([
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
        ]);

        $this->postJson('/api/blocked-dates', ['date' => '2026-11-14'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('date');
    }

    public function test_tanggal_booking_batal_tetap_bisa_diblokir(): void
    {
        $this->makeBooking([
            'event_date' => '2026-11-14',
            'status' => 'cancelled',
        ]);

        $this->postJson('/api/blocked-dates', ['date' => '2026-11-14'])
            ->assertCreated();
    }

    public function test_format_tanggal_tidak_valid_ditolak(): void
    {
        $this->postJson('/api/blocked-dates', ['date' => '20-11-2026'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('date');
    }

    public function test_alasan_maksimal_120_karakter(): void
    {
        $this->postJson('/api/blocked-dates', [
            'date' => '2026-11-20',
            'reason' => str_repeat('a', 121),
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');
    }

    public function test_lepas_blokir_tanggal(): void
    {
        $schedule = $this->vendor->schedules()->create([
            'date' => '2026-11-20',
            'type' => VendorSchedule::TYPE_BLOCKED,
        ]);

        $this->deleteJson("/api/blocked-dates/{$schedule->id}")->assertNoContent();

        $this->assertDatabaseMissing('vendor_schedules', ['id' => $schedule->id]);
    }

    public function test_penanda_booked_tidak_bisa_dihapus_manual(): void
    {
        $booking = $this->makeBooking();

        $schedule = $this->vendor->schedules()->create([
            'date' => '2026-11-14',
            'booking_id' => $booking->id,
            'type' => VendorSchedule::TYPE_BOOKED,
        ]);

        $this->deleteJson("/api/blocked-dates/{$schedule->id}")->assertStatus(422);

        $this->assertDatabaseHas('vendor_schedules', ['id' => $schedule->id]);
    }

    public function test_blokir_terpisah_antar_vendor(): void
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

        $schedule = $other->schedules()->create([
            'date' => '2026-11-20',
            'type' => VendorSchedule::TYPE_BLOCKED,
        ]);

        // Blokir vendor lain tidak bisa dihapus dari konteks vendor pertama.
        $this->deleteJson("/api/blocked-dates/{$schedule->id}")->assertNotFound();

        $this->assertDatabaseHas('vendor_schedules', ['id' => $schedule->id]);
    }
}
