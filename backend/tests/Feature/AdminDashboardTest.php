<?php

namespace Tests\Feature;

use App\Models\{Booking, Client, Invoice, Payment, User, Vendor};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Dashboard admin: ringkasan angka + grafik pendapatan agregat.
 *
 * Memastikan endpoint mengembalikan angka yang benar untuk seluruh vendor
 * (bukan hanya vendor yang login), dan bahwa grafik agregat menggabungkan
 * data semua vendor — berbeda dari endpoint revenue vendor yang terfilter.
 */
class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    private function buatAdmin(): User
    {
        return User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'is_active' => true,
        ]);
    }

    private function buatVendorDenganData(string $namaVendor): array
    {
        $user = User::factory()->create([
            'role' => User::ROLE_VENDOR,
            'is_active' => true,
        ]);
        $vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => $namaVendor,
            'slug' => str()->slug($namaVendor),
            'is_active' => true,
        ]);
        $client = Client::create([
            'vendor_id' => $vendor->id,
            'name' => 'Klien '.$namaVendor,
            'phone' => '0812',
        ]);

        return [$user, $vendor, $client];
    }

    private function buatBookingDenganPayment(Vendor $vendor, Client $client, string $tanggal, int $harga, int $dibayar): void
    {
        $booking = Booking::create([
            'vendor_id' => $vendor->id,
            'client_id' => $client->id,
            'event_date' => $tanggal,
            'status' => 'confirmed',
            'total_price' => $harga,
        ]);
        $invoice = Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-TEST-'.$booking->id,
            'public_token' => 'tok-'.$booking->id,
            'type' => 'dp',
            'amount' => $harga,
            'paid_amount' => $dibayar,
            'status' => $dibayar >= $harga ? 'paid' : 'partial',
            'due_date' => now()->addDays(7)->toDateString(),
            'link_active' => true,
        ]);
        if ($dibayar > 0) {
            Payment::create([
                'invoice_id' => $invoice->id,
                'amount' => $dibayar,
                'method' => 'transfer',
                'paid_at' => $tanggal.' 12:00:00',
                'created_by' => $vendor->user_id,
            ]);
        }
    }

    public function test_summary_mengembalikan_angka_semua_vendor(): void
    {
        $admin = $this->buatAdmin();

        [$user1, $vendor1, $client1] = $this->buatVendorDenganData('Vendor Alpha');
        [$user2, $vendor2, $client2] = $this->buatVendorDenganData('Vendor Beta');

        $this->buatBookingDenganPayment($vendor1, $client1, now()->startOfMonth()->toDateString(), 10_000_000, 4_000_000);
        $this->buatBookingDenganPayment($vendor2, $client2, now()->startOfMonth()->toDateString(), 5_000_000, 5_000_000);

        $response = $this->actingAs($admin)->getJson('/api/admin/dashboard/summary');

        $response->assertOk()
            ->assertJsonPath('vendors.total', 2)
            ->assertJsonPath('vendors.active', 2)
            ->assertJsonPath('bookings.total', 2)
            ->assertJsonPath('payments.total', 2)
            ->assertJsonPath('payments.paidIn', 9000000);
    }

    public function test_summary_menolak_vendor(): void
    {
        [$user] = $this->buatVendorDenganData('Vendor Biasa');

        $this->actingAs($user)->getJson('/api/admin/dashboard/summary')->assertForbidden();
    }

    public function test_revenue_series_agregat_semua_vendor(): void
    {
        $admin = $this->buatAdmin();

        [$user1, $vendor1, $client1] = $this->buatVendorDenganData('Vendor Alpha');
        [$user2, $vendor2, $client2] = $this->buatVendorDenganData('Vendor Beta');

        // Vendor 1: kontrak 10jt, dibayar 4jt bulan ini
        $this->buatBookingDenganPayment($vendor1, $client1, now()->startOfMonth()->toDateString(), 10_000_000, 4_000_000);
        // Vendor 2: kontrak 5jt, dibayar 5jt bulan ini
        $this->buatBookingDenganPayment($vendor2, $client2, now()->startOfMonth()->toDateString(), 5_000_000, 5_000_000);

        $response = $this->actingAs($admin)->getJson('/api/admin/dashboard/revenue-series?months=6');

        $response->assertOk()
            ->assertJsonStructure(['series', 'totals', 'months']);

        $totals = $response->json('totals');
        // Kontrak: 10jt + 5jt = 15jt; Masuk: 4jt + 5jt = 9jt
        $this->assertEquals(15_000_000.0, $totals['contractValue']);
        $this->assertEquals(9_000_000.0, $totals['paid']);
    }

    public function test_revenue_series_menolak_vendor(): void
    {
        [$user] = $this->buatVendorDenganData('Vendor Biasa');

        $this->actingAs($user)->getJson('/api/admin/dashboard/revenue-series')->assertForbidden();
    }

    public function test_revenue_series_tanpa_login_menolak(): void
    {
        $this->getJson('/api/admin/dashboard/revenue-series')->assertUnauthorized();
    }
}
