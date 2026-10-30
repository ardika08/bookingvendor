<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji API admin: daftar & tambah vendor.
 *
 * Fokus: bentuk respons camelCase sesuai panel admin, filter/pencarian,
 * penghitungan pemakaian, serta pembuatan akun + profil + trial yang utuh
 * dalam satu transaksi.
 */
class AdminVendorApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->loginAsAdmin();
    }

    private function makeVendor(array $overrides = []): Vendor
    {
        static $sequence = 0;
        $sequence++;

        $user = User::create([
            'name' => $overrides['owner_name'] ?? "Pemilik {$sequence}",
            'email' => $overrides['email'] ?? "vendor{$sequence}@example.test",
            'password' => 'password',
        ]);

        return Vendor::create([
            'user_id' => $user->id,
            'name' => $overrides['name'] ?? "Vendor {$sequence}",
            'slug' => $overrides['slug'] ?? "vendor-{$sequence}",
            'location' => $overrides['city'] ?? 'Jakarta',
            'is_active' => $overrides['is_active'] ?? true,
        ]);
    }

    public function test_daftar_vendor_mengembalikan_bentuk_camelcase(): void
    {
        $vendor = $this->makeVendor([
            'name' => 'Lumen Wedding Story',
            'owner_name' => 'Dika Pratama',
            'email' => 'dika@lumenwedding.id',
            'city' => 'Jakarta Selatan',
        ]);

        $this->getJson('/api/admin/vendors')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', (string) $vendor->id)
            ->assertJsonPath('0.name', 'Lumen Wedding Story')
            ->assertJsonPath('0.ownerName', 'Dika Pratama')
            ->assertJsonPath('0.email', 'dika@lumenwedding.id')
            ->assertJsonPath('0.city', 'Jakarta Selatan')
            ->assertJsonPath('0.isActive', true)
            ->assertJsonPath('0.subscription.status', 'trial')
            ->assertJsonPath('0.subscription.endsAt', null)
            ->assertJsonPath('0.bookingsCount', 0)
            ->assertJsonPath('0.invoicesCount', 0);
    }

    public function test_daftar_menghitung_pemakaian_booking_dan_invoice(): void
    {
        $vendor = $this->makeVendor();
        $client = Client::create([
            'vendor_id' => $vendor->id,
            'name' => 'Rani & Bagas',
            'phone' => '6281234567890',
        ]);

        $booking = Booking::create([
            'vendor_id' => $vendor->id,
            'client_id' => $client->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);

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

        $this->getJson('/api/admin/vendors')
            ->assertOk()
            ->assertJsonPath('0.bookingsCount', 1)
            ->assertJsonPath('0.invoicesCount', 1);
    }

    public function test_pencarian_nama_pemilik_dan_email(): void
    {
        $this->makeVendor(['name' => 'Aurora Frame', 'owner_name' => 'Nadia Kusuma', 'email' => 'nadia@aurora.id']);
        $this->makeVendor(['name' => 'Lumen Wedding Story', 'owner_name' => 'Dika Pratama', 'email' => 'dika@lumen.id']);

        $this->getJson('/api/admin/vendors?q=aurora')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/admin/vendors?q=nadia')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/admin/vendors?q=dika@lumen')->assertOk()->assertJsonPath('0.name', 'Lumen Wedding Story');
        $this->getJson('/api/admin/vendors?q=tidak-ada')->assertOk()->assertJsonCount(0);
    }

    public function test_filter_status_akun(): void
    {
        $this->makeVendor(['name' => 'Aktif', 'is_active' => true]);
        $this->makeVendor(['name' => 'Nonaktif', 'is_active' => false]);

        $this->getJson('/api/admin/vendors?account=active')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Aktif');

        $this->getJson('/api/admin/vendors?account=inactive')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Nonaktif');
    }

    public function test_urutan_aktif_dulu_lalu_terbaru(): void
    {
        $old = $this->makeVendor(['name' => 'Lama Aktif']);
        $old->forceFill(['created_at' => now()->subDays(10)])->save();

        $new = $this->makeVendor(['name' => 'Baru Aktif']);
        $this->makeVendor(['name' => 'Nonaktif', 'is_active' => false]);

        $names = array_column($this->getJson('/api/admin/vendors')->assertOk()->json(), 'name');

        $this->assertSame(['Baru Aktif', 'Lama Aktif', 'Nonaktif'], $names);
    }

    public function test_tambah_vendor_membuat_akun_profil_dan_trial(): void
    {
        $this->postJson('/api/admin/vendors', [
            'name' => 'Lumen Wedding Story',
            'owner_name' => 'Dika Pratama',
            'email' => 'dika@lumenwedding.id',
            'category' => 'Wedding Organizer',
            'city' => 'Jakarta Selatan',
        ])
            ->assertCreated()
            ->assertJsonPath('name', 'Lumen Wedding Story')
            ->assertJsonPath('ownerName', 'Dika Pratama')
            ->assertJsonPath('email', 'dika@lumenwedding.id')
            ->assertJsonPath('category', 'Wedding Organizer')
            ->assertJsonPath('isActive', true)
            ->assertJsonPath('subscription.status', 'trial')
            // Trial kini berbasis waktu: 30 hari sejak vendor dibuat.
            ->assertJsonPath(
                'subscription.endsAt',
                now()->addDays(30)->toDateString(),
            );

        $this->assertDatabaseHas('users', ['email' => 'dika@lumenwedding.id', 'name' => 'Dika Pratama']);
        $this->assertDatabaseHas('vendors', ['name' => 'Lumen Wedding Story', 'slug' => 'lumen-wedding-story']);
        $this->assertDatabaseHas('categories', ['name' => 'Wedding Organizer']);
    }

    public function test_slug_dibuat_unik_untuk_nama_sama(): void
    {
        $payload = [
            'name' => 'Lumen Wedding Story',
            'owner_name' => 'Dika Pratama',
            'email' => 'dika@lumenwedding.id',
            'category' => 'Wedding Organizer',
        ];

        $this->postJson('/api/admin/vendors', $payload)
            ->assertCreated()
            ->assertJsonPath('name', 'Lumen Wedding Story');

        $second = array_merge($payload, ['email' => 'lain@lumenwedding.id']);
        $this->postJson('/api/admin/vendors', $second)->assertCreated();

        $this->assertDatabaseHas('vendors', ['slug' => 'lumen-wedding-story']);
        $this->assertDatabaseHas('vendors', ['slug' => 'lumen-wedding-story-2']);
    }

    public function test_email_yang_sudah_terdaftar_ditolak(): void
    {
        User::create([
            'name' => 'Sudah Ada',
            'email' => 'dika@lumenwedding.id',
            'password' => 'password',
        ]);

        $this->postJson('/api/admin/vendors', [
            'name' => 'Lumen Wedding Story',
            'owner_name' => 'Dika Pratama',
            'email' => 'dika@lumenwedding.id',
            'category' => 'Wedding Organizer',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_validasi_field_wajib(): void
    {
        $this->postJson('/api/admin/vendors', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'owner_name', 'email', 'category']);
    }

    /**
     * Regresi: form tambah vendor dulu hanya menulis ke state contoh, sehingga
     * UI melaporkan "berhasil" tanpa satu pun baris baru di database. Tes ini
     * memastikan endpoint yang dipakai UI benar-benar membuat data.
     */
    public function test_tambah_vendor_lalu_muncul_di_daftar_dan_bisa_dibuka_detailnya(): void
    {
        $created = $this->postJson('/api/admin/vendors', [
            'name' => 'Vendor Baru Uji',
            'owner_name' => 'Pemilik Baru',
            'email' => 'baru@example.test',
            'category' => 'Wedding Organizer',
            'city' => 'Semarang',
        ])->assertCreated()->json();

        $this->assertNotEmpty($created['id']);

        // Muncul di daftar.
        $this->getJson('/api/admin/vendors')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Vendor Baru Uji']);

        // Detailnya bisa dibuka lewat ID numerik dari server — inilah yang
        // dulu gagal karena halaman detail memakai ID contoh `vd-1`.
        $this->getJson('/api/admin/vendors/'.$created['id'])
            ->assertOk()
            ->assertJsonPath('name', 'Vendor Baru Uji')
            ->assertJsonPath('email', 'baru@example.test');
    }

    /**
     * Regresi: ID yang tidak ada harus 404, bukan 500 — halaman detail
     * membedakan keduanya (pesan "tidak ditemukan" vs galat jaringan).
     */
    public function test_detail_vendor_tidak_dikenal_menghasilkan_404(): void
    {
        $this->getJson('/api/admin/vendors/999999')->assertNotFound();
    }
}
