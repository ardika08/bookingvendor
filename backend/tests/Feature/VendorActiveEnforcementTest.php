<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Package;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji penegakan status aktif/nonaktif vendor.
 *
 * Admin bisa menonaktifkan akun vendor; selama nonaktif seluruh endpoint vendor
 * mengembalikan 403 berkode `vendor_inactive`, tetapi panel admin dan halaman
 * publik tetap berjalan. Data vendor tidak dihapus.
 */
class VendorActiveEnforcementTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;
    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Dika Pratama',
            'email' => 'dika@example.test',
            'password' => 'password',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
            'is_active' => true,
            'bank_name' => 'BCA',
            'bank_account_number' => '1234567890',
            'bank_account_name' => 'Lumen Wedding Story',
        ]);

        $this->client = Client::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Rani & Bagas',
            'phone' => '6281234567890',
        ]);
    
        $this->loginAsVendorOf($this->vendor);
    }

    private function deactivate(): void
    {
        $this->vendor->update(['is_active' => false]);
    }

    public function test_vendor_aktif_dapat_memakai_endpoint(): void
    {
        Package::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Paket Gold',
            'price' => 15000000,
        ]);

        $this->getJson('/api/packages')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/invoices')->assertOk();
    }

    public function test_vendor_nonaktif_ditolak_di_endpoint_vendor(): void
    {
        $this->deactivate();

        $this->getJson('/api/packages')
            ->assertStatus(403)
            ->assertJsonPath('code', 'vendor_inactive')
            ->assertJsonPath('message', 'Akun vendor sedang dinonaktifkan. Hubungi admin platform.');

        $this->getJson('/api/invoices')->assertStatus(403);
        $this->getJson('/api/blocked-dates')->assertStatus(403);
        $this->getJson('/api/vendor/profile')->assertStatus(403);
    }

    public function test_vendor_nonaktif_tidak_bisa_membuat_invoice(): void
    {
        $this->deactivate();

        $booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);

        $this->postJson("/api/bookings/{$booking->id}/invoices", [
            'type' => 'dp',
            'amount' => 1000000,
            'issued_at' => '2026-10-23',
            'due_at' => '2026-10-30',
        ])->assertStatus(403);

        $this->assertDatabaseCount('invoices', 0);
    }

    public function test_admin_tetap_bisa_mengakses_panel_saat_vendor_nonaktif(): void
    {
        $this->deactivate();

        // Admin memakai akun sendiri; middleware `vendor.active` tidak berlaku
        // untuknya karena hanya grup route vendor yang memakainya.
        $this->loginAsAdmin()
            ->getJson('/api/admin/vendors')
            ->assertOk()
            ->assertJsonPath('0.isActive', false);
    }

    public function test_aktivasi_kembali_memulihkan_akses(): void
    {
        $this->deactivate();
        $this->getJson('/api/packages')->assertStatus(403);

        $this->vendor->update(['is_active' => true]);

        $this->loginAsVendorOf($this->vendor->fresh())
            ->getJson('/api/packages')
            ->assertOk();
    }

    public function test_tanpa_vendor_tidak_terblokir_middleware(): void
    {
        $this->vendor->delete();

        // Setelah auth aktif, akun tanpa profil vendor ditolak 403 oleh
        // ResolvesVendor — bukan lagi 404 dari fallback "vendor pertama".
        $this->loginAs($this->vendor->user)
            ->getJson('/api/packages')
            ->assertForbidden()
            ->assertJsonPath('code', 'vendor_not_linked');
    }
}
