<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Parameter `sort` pada `GET /api/bookings`.
 *
 * Sebelumnya `sort` hanya disebut di komentar dokumentasi endpoint tetapi tidak
 * pernah dibaca, sehingga kontrol "Urutkan" di UI akan menjadi tombol palsu:
 * dipilih apa pun, hasilnya tetap urut tanggal. Tes ini mengunci perilaku
 * nyatanya, termasuk penolakan nilai asing (allowlist, bukan nama kolom bebas).
 */
class BookingSortTest extends TestCase
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

    private function booking(string $date, int $price, string $name): Booking
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
            'status' => Booking::STATUS_CONFIRMED,
            'total_price' => $price,
            'notes' => null,
        ]);
    }

    /** @return list<string> */
    private function dates(array $items): array
    {
        return array_map(static fn (array $item) => $item['eventDate'], $items);
    }

    public function test_urutan_bawaan_adalah_tanggal_terdekat(): void
    {
        $this->booking('2026-11-20', 1_000_000, 'C');
        $this->booking('2026-11-05', 1_000_000, 'A');
        $this->booking('2026-11-12', 1_000_000, 'B');

        $response = $this->actingAs($this->user)->getJson('/api/bookings?page=1');

        $response->assertOk();
        $this->assertSame(
            ['2026-11-05', '2026-11-12', '2026-11-20'],
            $this->dates($response->json('items')),
        );
    }

    public function test_sort_tanggal_terjauh(): void
    {
        $this->booking('2026-11-20', 1_000_000, 'C');
        $this->booking('2026-11-05', 1_000_000, 'A');
        $this->booking('2026-11-12', 1_000_000, 'B');

        $response = $this->actingAs($this->user)->getJson('/api/bookings?page=1&sort=event_date_desc');

        $response->assertOk();
        $this->assertSame(
            ['2026-11-20', '2026-11-12', '2026-11-05'],
            $this->dates($response->json('items')),
        );
    }

    public function test_sort_nilai_tertinggi(): void
    {
        $this->booking('2026-11-05', 7_000_000, 'A');
        $this->booking('2026-11-20', 21_000_000, 'C');
        $this->booking('2026-11-12', 15_000_000, 'B');

        $response = $this->actingAs($this->user)->getJson('/api/bookings?page=1&sort=price_desc');

        $response->assertOk();
        $this->assertSame(
            ['2026-11-20', '2026-11-12', '2026-11-05'],
            $this->dates($response->json('items')),
        );
    }

    public function test_sort_terbaru_dibuat(): void
    {
        $first = $this->booking('2026-11-05', 1_000_000, 'A');
        $second = $this->booking('2026-11-12', 1_000_000, 'B');
        /* Pastikan urutan created_at tidak ambigu. */
        $first->forceFill(['created_at' => now()->subDays(2)])->save();
        $second->forceFill(['created_at' => now()->subDay()])->save();

        $response = $this->actingAs($this->user)->getJson('/api/bookings?page=1&sort=created_desc');

        $response->assertOk();
        $this->assertSame(
            [(string) $second->id, (string) $first->id],
            array_map(static fn (array $item) => $item['id'], $response->json('items')),
        );
    }

    public function test_nilai_sort_asing_diabaikan_dan_kembali_ke_bawaan(): void
    {
        $this->booking('2026-11-20', 1_000_000, 'C');
        $this->booking('2026-11-05', 1_000_000, 'A');

        /*
         * Tanpa allowlist, nilai seperti ini bisa diteruskan ke orderBy dan
         * memicu error SQL. Yang diharapkan: diam-diam jatuh ke urutan bawaan.
         */
        $response = $this->actingAs($this->user)->getJson('/api/bookings?page=1&sort=total_price;DROP');

        $response->assertOk();
        $this->assertSame(
            ['2026-11-05', '2026-11-20'],
            $this->dates($response->json('items')),
        );
    }

    public function test_sort_tetap_menghormati_filter_bulan(): void
    {
        $this->booking('2026-10-05', 9_000_000, 'A');
        $this->booking('2026-11-05', 1_000_000, 'B');
        $this->booking('2026-11-20', 5_000_000, 'C');

        $response = $this->actingAs($this->user)->getJson('/api/bookings?page=1&month=2026-11&sort=price_desc');

        $response->assertOk();
        $this->assertSame(
            ['2026-11-20', '2026-11-05'],
            $this->dates($response->json('items')),
        );
    }
}
