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
 * Kontrak keamanan Fase 1: setiap endpoint dashboard wajib punya identitas.
 *
 * Sebelum fase ini, `routes/api.php` tidak memakai middleware auth sama sekali
 * dan `ResolvesVendor` melakukan fallback ke `Vendor::query()->first()`. Akibatnya
 * permintaan tanpa kredensial apa pun tetap dilayani dengan data vendor pertama
 * — kebocoran lintas-tenant yang tidak terlihat karena semua test lama memakai
 * jalur fallback itu.
 *
 * Test ini mengunci perilaku yang benar, sehingga regresi ke pola fallback akan
 * langsung gagal di sini.
 */
class ApiAuthEnforcementTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;
    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'Vendor Uji',
            'email' => 'vendor@example.test',
            'role' => User::ROLE_VENDOR,
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $this->owner->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
        ]);

        $client = Client::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Rani & Bagas',
            'phone' => '6281234567890',
        ]);

        Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $client->id,
            'event_date' => '2026-11-14',
            'event_time' => '08:00',
            // `incoming` hanya mengembalikan booking berstatus tentative.
            'status' => 'tentative',
            'total_price' => 15000000,
        ]);
    }

    /**
     * Daftar endpoint yang sebelumnya terbuka tanpa kredensial.
     *
     * @return array<int, array{0: string, 1: string}>
     */
    public static function endpointVendorProvider(): array
    {
        return [
            ['get', '/api/bookings/incoming'],
            ['get', '/api/invoices'],
            ['get', '/api/packages'],
            ['get', '/api/blocked-dates'],
            ['get', '/api/vendor/profile'],
            ['get', '/api/user/profile'],
            ['get', '/api/subscription'],
        ];
    }

    /**
     * @dataProvider endpointVendorProvider
     */
    public function test_endpoint_vendor_menolak_tanpa_sesi(string $method, string $uri): void
    {
        $this->loginAs(null);

        $this->json($method, $uri)
            ->assertUnauthorized()
            ->assertJsonPath('code', 'unauthenticated');
    }

    public function test_endpoint_admin_menolak_tanpa_sesi(): void
    {
        $this->loginAs(null);

        $this->getJson('/api/admin/vendors')
            ->assertUnauthorized()
            ->assertJsonPath('code', 'unauthenticated');
    }

    public function test_me_menolak_tanpa_sesi(): void
    {
        $this->loginAs(null);

        $this->getJson('/api/me')
            ->assertUnauthorized()
            ->assertJsonPath('code', 'unauthenticated');
    }

    /**
     * Inti perbaikan: pengguna yang login TIDAK boleh menerima data vendor lain.
     *
     * Dua vendor disiapkan, lalu pemilik vendor A memanggil endpoint. Yang
     * dikembalikan harus data A — bukan "vendor pertama" di database.
     */
    public function test_vendor_hanya_melihat_datanya_sendiri(): void
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

        Client::create([
            'vendor_id' => $lain->id,
            'name' => 'Klien Aurora',
            'phone' => '628111111111',
        ]);

        // Vendor A (dibuat lebih dulu, jadi dulu selalu jadi "vendor pertama").
        $this->loginAsVendorOf($this->vendor)
            ->getJson('/api/bookings/incoming')
            ->assertOk()
            ->assertJsonPath('items.0.client.name', 'Rani & Bagas');

        // Vendor B harus melihat datanya sendiri, bukan data vendor A.
        $this->loginAs($lainUser)
            ->getJson('/api/bookings/incoming')
            ->assertOk()
            ->assertJsonCount(0, 'items');
    }

    public function test_vendor_tidak_bisa_membuka_invoice_vendor_lain(): void
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

        // Invoice selalu terikat booking, jadi vendor B butuh booking sendiri.
        $klienLain = Client::create([
            'vendor_id' => $lain->id,
            'name' => 'Klien Aurora',
            'phone' => '628111111111',
        ]);

        $bookingLain = Booking::create([
            'vendor_id' => $lain->id,
            'client_id' => $klienLain->id,
            'event_date' => '2026-12-01',
            'event_time' => '09:00',
            'status' => 'confirmed',
            'total_price' => 5000000,
        ]);

        $invoice = Invoice::create([
            'booking_id' => $bookingLain->id,
            'invoice_number' => 'INV-2026-0001',
            'public_token' => 'token-aurora-0001',
            'type' => 'full',
            'amount' => 5000000,
            'status' => 'unpaid',
            'due_date' => '2026-10-08',
        ]);

        // Pemilik vendor A mencoba membuka invoice milik vendor B.
        $this->loginAsVendorOf($this->vendor)
            ->getJson("/api/invoices/{$invoice->id}")
            ->assertNotFound();
    }

    public function test_vendor_nonaktif_tetap_ditolak_403(): void
    {
        $this->vendor->update(['is_active' => false]);

        $this->loginAsVendorOf($this->vendor)
            ->getJson('/api/packages')
            ->assertForbidden()
            ->assertJsonPath('code', 'vendor_inactive');
    }

    public function test_akun_tanpa_profil_vendor_ditolak_403(): void
    {
        $tanpaVendor = User::create([
            'name' => 'Akun Tanpa Vendor',
            'email' => 'tanpavendor@example.test',
            'role' => User::ROLE_VENDOR,
        ]);

        $this->loginAs($tanpaVendor)
            ->getJson('/api/packages')
            ->assertForbidden()
            ->assertJsonPath('code', 'vendor_not_linked');
    }

    public function test_vendor_biasa_tidak_bisa_membuka_endpoint_admin(): void
    {
        $this->loginAsVendorOf($this->vendor)
            ->getJson('/api/admin/vendors')
            ->assertForbidden()
            ->assertJsonPath('code', 'admin_only');
    }

    public function test_me_mengembalikan_identitas_dan_langganan(): void
    {
        $this->loginAsVendorOf($this->vendor)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('name', 'Vendor Uji')
            ->assertJsonPath('email', 'vendor@example.test')
            ->assertJsonPath('role', 'vendor')
            ->assertJsonPath('vendor.businessName', 'Lumen Wedding Story')
            ->assertJsonPath('vendor.slug', 'lumen-wedding-story')
            ->assertJsonStructure([
                'id',
                'name',
                'email',
                'avatarUrl',
                'role',
                'vendor' => ['id', 'businessName', 'category', 'slug', 'avatarUrl'],
                'subscription' => [
                    'status',
                    'endsAt',
                    'graceEndsAt',
                    'trialBookingsUsed',
                    'trialBookingsLimit',
                    'trialInvoicesUsed',
                    'trialInvoicesLimit',
                    'remainingBookings',
                    'remainingInvoices',
                    'canCreateBooking',
                    'canCreateInvoice',
                ],
            ]);
    }

    public function test_me_untuk_admin_tanpa_profil_vendor(): void
    {
        $admin = User::create([
            'name' => 'Admin Platform',
            'email' => 'admin@bookingvendor.test',
            'role' => User::ROLE_ADMIN,
        ]);

        $this->loginAs($admin)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('role', 'admin')
            ->assertJsonPath('vendor', null);
    }

    public function test_rute_publik_tetap_terbuka_tanpa_sesi(): void
    {
        // Link invoice yang dibagikan klien tidak boleh ikut terkunci.
        $this->loginAs(null);

        $this->getJson('/api/public/invoices/token-tidak-ada')
            ->assertNotFound();
    }
}
