<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Daftar klien: agregat, pencarian, urutan, dan isolasi antar-vendor.
 *
 * Yang paling penting diuji di sini adalah isolasi. Daftar klien memuat nama
 * dan nomor telepon orang, jadi kebocoran satu baris saja sudah masalah nyata.
 */
class ClientListTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        // `vendors.user_id` wajib, jadi user dibuat lebih dulu lalu vendor
        // ditautkan. Urutan sebaliknya melanggar NOT NULL.
        $this->user = User::create([
            'name' => 'Vendor Uji',
            'email' => 'vendor@example.com',
            'password' => bcrypt('password'),
            'role' => 'vendor',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $this->user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
            'contact_phone' => '081234567890',
            'is_active' => true,
        ]);
    }

    public function test_menolak_akses_tanpa_login(): void
    {
        $this->getJson('/api/clients')->assertStatus(401);
    }

    public function test_menghitung_booking_dan_nilai_per_klien(): void
    {
        $client = $this->makeClient('Ani Wijaya', '081111111111');

        $this->makeBooking($client, '2027-01-10', Booking::STATUS_CONFIRMED, 15000000);
        $this->makeBooking($client, '2027-03-20', Booking::STATUS_COMPLETED, 5000000);

        $response = $this->actingAs($this->user)->getJson('/api/clients');

        $response->assertOk();

        $row = $response->json('0');

        $this->assertSame('Ani Wijaya', $row['name']);
        $this->assertSame(2, $row['bookingCount']);
        $this->assertEquals(20000000, $row['totalValue']);
        // Booking terakhir = tanggal acara paling akhir.
        $this->assertSame('2027-03-20', $row['lastEventDate']);
        $this->assertSame(Booking::STATUS_COMPLETED, $row['lastStatus']);
    }

    public function test_klien_tanpa_booking_tetap_muncul_dengan_nol(): void
    {
        $this->makeClient('Klien Baru', '082222222222');

        $row = $this->actingAs($this->user)->getJson('/api/clients')->json('0');

        $this->assertSame(0, $row['bookingCount']);
        $this->assertEquals(0, $row['totalValue']);
        $this->assertNull($row['lastEventDate']);
        $this->assertNull($row['lastStatus']);
    }

    public function test_pencarian_menjangkau_nama_telepon_dan_email(): void
    {
        $this->makeClient('Budi Santoso', '081333333333', 'budi@example.com');
        $this->makeClient('Citra Dewi', '081444444444', 'citra@example.com');

        $byName = $this->actingAs($this->user)->getJson('/api/clients?q=Budi')->json();
        $this->assertCount(1, $byName);
        $this->assertSame('Budi Santoso', $byName[0]['name']);

        $byPhone = $this->actingAs($this->user)->getJson('/api/clients?q=081444')->json();
        $this->assertCount(1, $byPhone);
        $this->assertSame('Citra Dewi', $byPhone[0]['name']);

        $byEmail = $this->actingAs($this->user)->getJson('/api/clients?q=citra@')->json();
        $this->assertCount(1, $byEmail);
        $this->assertSame('Citra Dewi', $byEmail[0]['name']);
    }

    public function test_urutan_nama_dan_nilai(): void
    {
        $murah = $this->makeClient('Zulkifli', '081555555555');
        $mahal = $this->makeClient('Ahmad', '081666666666');

        $this->makeBooking($murah, '2027-02-01', Booking::STATUS_CONFIRMED, 3000000);
        $this->makeBooking($mahal, '2027-02-02', Booking::STATUS_CONFIRMED, 9000000);

        $byName = $this->actingAs($this->user)->getJson('/api/clients?sort=name')->json();
        $this->assertSame(['Ahmad', 'Zulkifli'], array_column($byName, 'name'));

        $byValue = $this->actingAs($this->user)->getJson('/api/clients?sort=value')->json();
        $this->assertSame(['Ahmad', 'Zulkifli'], array_column($byValue, 'name'));
    }

    public function test_paginasi_mengembalikan_bentuk_items_total(): void
    {
        foreach (range(1, 3) as $i) {
            $this->makeClient("Klien {$i}", '08170000000' . $i);
        }

        $response = $this->actingAs($this->user)->getJson('/api/clients?page=1&per_page=2');

        $response->assertOk();
        $this->assertSame(3, $response->json('total'));
        $this->assertSame(1, $response->json('page'));
        $this->assertSame(2, $response->json('perPage'));
        $this->assertCount(2, $response->json('items'));
    }

    public function test_tidak_membocorkan_klien_vendor_lain(): void
    {
        $lainUser = User::create([
            'name' => 'Vendor Lain',
            'email' => 'lain@example.com',
            'password' => bcrypt('password'),
            'role' => 'vendor',
        ]);

        $lain = Vendor::create([
            'user_id' => $lainUser->id,
            'name' => 'Vendor Lain',
            'slug' => 'vendor-lain',
            'contact_phone' => '089999999999',
            'is_active' => true,
        ]);

        $milikSendiri = $this->makeClient('Punya Sendiri', '081888888888');
        $milikOrang = Client::create([
            'vendor_id' => $lain->id,
            'name' => 'Rahasia Orang',
            'phone' => '081999999999',
        ]);

        $list = $this->actingAs($this->user)->getJson('/api/clients')->json();

        $this->assertCount(1, $list);
        $this->assertSame($milikSendiri->name, $list[0]['name']);

        // Detail klien vendor lain harus 404, bukan 403 — keberadaannya pun
        // tidak perlu diungkap.
        $this->actingAs($this->user)
            ->getJson('/api/clients/' . $milikOrang->id)
            ->assertStatus(404);
    }

    public function test_detail_klien_memuat_ringkasan(): void
    {
        $client = $this->makeClient('Dewi Lestari', '081011111111');
        $this->makeBooking($client, '2027-05-05', Booking::STATUS_CONFIRMED, 12000000);

        $response = $this->actingAs($this->user)
            ->getJson('/api/clients/' . $client->id);

        $response->assertOk();
        $this->assertSame(1, $response->json('bookingCount'));
        $this->assertEquals(12000000, $response->json('totalValue'));
        $this->assertSame('2027-05-05', $response->json('lastEventDate'));
    }

    /**
     * Regresi: hapus klien ikut membawa booking-nya.
     *
     * Foreign key `client_id` memakai `cascadeOnDelete`, jadi booking, invoice,
     * dan baris addon klien terhapus bersama klien di level DB. Yang diuji di
     * sini: controller benar-benar menghapus klien, dan melaporkan jumlah
     * booking ikut terhapus agar UI bisa menampilkan pesan yang jujur.
     */
    public function test_hapus_klien_membawa_booking(): void
    {
        $client = $this->makeClient('Rani & Bagas', '081299887766');
        $this->makeBooking($client, '2027-01-10', Booking::STATUS_CONFIRMED, 15000000);
        $this->makeBooking($client, '2027-03-20', Booking::STATUS_COMPLETED, 5000000);

        $response = $this->actingAs($this->user)->deleteJson("/api/clients/{$client->id}");

        $response->assertOk()
            ->assertJsonPath('deleted', true)
            ->assertJsonPath('deletedBookings', 2);

        $this->assertDatabaseMissing('clients', ['id' => $client->id]);
        $this->assertDatabaseMissing('bookings', ['client_id' => $client->id]);
    }

    /** Hanya kontak yang bisa diubah; agregat tetap dihitung server. */
    public function test_ubah_klien_hanya_field_kontak(): void
    {
        $client = $this->makeClient('Sinta Arya', '085711223344', 'sinta@example.test');
        $this->makeBooking($client, '2027-01-10', Booking::STATUS_CONFIRMED, 12000000);

        $response = $this->actingAs($this->user)->putJson("/api/clients/{$client->id}", [
            'name' => 'Sinta & Arya',
            'phone' => '085799887766',
            'email' => null,
            'address' => 'Bandung',
            'notes' => 'Minta konfirmasi venue',
        ]);

        $response->assertOk()
            ->assertJsonPath('name', 'Sinta & Arya')
            ->assertJsonPath('phone', '085799887766')
            ->assertJsonPath('address', 'Bandung')
            ->assertJsonPath('notes', 'Minta konfirmasi venue')
            // Agregat tetap ikut dikembalikan.
            ->assertJsonPath('bookingCount', 1)
            ->assertJsonPath('totalValue', 12000000);
    }

    /** Nomor telepon tidak valid ditolak saat ubah data. */
    public function test_ubah_klien_nomor_invalid_ditolak(): void
    {
        $client = $this->makeClient('Tono Wati', '081555443322');

        $response = $this->actingAs($this->user)->putJson("/api/clients/{$client->id}", [
            'name' => 'Tono Wati',
            'phone' => '12345',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('phone');
    }

    /** Isolasi antar-vendor: klien vendor lain tidak bisa diubah/dihapus. */
    public function test_vendor_lain_tidak_bisa_ubah_atau_hapus_klien(): void
    {
        $client = $this->makeClient('Klien Vendor A', '081234567890');

        $otherUser = User::create([
            'name' => 'Vendor Lain',
            'email' => 'other@example.com',
            'password' => bcrypt('password'),
            'role' => 'vendor',
        ]);
        $otherVendor = Vendor::create([
            'user_id' => $otherUser->id,
            'name' => 'Vendor B',
            'slug' => 'vendor-b',
            'contact_phone' => '081234567891',
            'is_active' => true,
        ]);

        $this->actingAs($otherUser)
            ->putJson("/api/clients/{$client->id}", ['name' => 'Direbut', 'phone' => '081234567890'])
            ->assertStatus(404);

        $this->actingAs($otherUser)
            ->deleteJson("/api/clients/{$client->id}")
            ->assertStatus(404);

        $this->assertSame($this->vendor->id, $client->fresh()->vendor_id);
        $this->assertSame('Klien Vendor A', $client->fresh()->name);
    }

    private function makeClient(string $name, string $phone, ?string $email = null): Client
    {
        return Client::create([
            'vendor_id' => $this->vendor->id,
            'name' => $name,
            'phone' => $phone,
            'email' => $email,
        ]);
    }

    private function makeBooking(Client $client, string $date, string $status, float $price): Booking
    {
        return Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $client->id,
            'event_date' => $date,
            'event_time' => '10:00',
            'event_location' => 'Bandung',
            'status' => $status,
            'total_price' => $price,
        ]);
    }
}
