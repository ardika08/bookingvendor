<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Memastikan panel admin TIDAK membuka data operasional vendor.
 *
 * PRD: admin hanya mengelola akun vendor — tidak memantau booking/invoice.
 * Endpoint admin boleh mengirim angka pemakaian dan data langganan, tetapi
 * tidak boleh membocorkan identitas klien, jadwal acara, nomor invoice, atau
 * isi catatan booking.
 *
 * Test ini mengunci kontrak respons: daftar kunci dibatasi (whitelist) dan
 * string sensitif tidak boleh muncul di payload.
 */
class AdminOperationalAccessTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;
    private Booking $booking;
    private Invoice $invoice;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Dika Pratama',
            'email' => 'dika@lumenwedding.id',
            'password' => 'password',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
            'location' => 'Jakarta Selatan',
            'contact' => '0812-9000-1122',
        ]);

        $client = Client::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Rani & Bagas',
            'phone' => '6281234567890',
            'email' => 'rani.bagas@example.test',
        ]);

        $this->booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $client->id,
            'event_date' => '2026-11-14',
            'event_time' => '08:00',
            'event_location' => 'Balai Kartini, Jakarta',
            'event_details' => 'Crew datang 1 jam lebih awal.',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);

        $this->invoice = Invoice::create([
            'booking_id' => $this->booking->id,
            'invoice_number' => 'INV/2026/10/0007',
            'public_token' => 'token-rahasia',
            'type' => 'dp',
            'amount' => 6000000,
            'paid_amount' => 0,
            'status' => Invoice::STATUS_UNPAID,
            'due_date' => '2026-10-30',
            'note' => 'Catatan internal untuk klien.',
        ]);
    
        $this->loginAsAdmin();
    }

    /** Nilai yang tidak boleh bocor ke panel admin. */
    private function sensitiveStrings(): array
    {
        return [
            'Rani & Bagas',
            '6281234567890',
            'rani.bagas@example.test',
            'Balai Kartini',
            'Crew datang 1 jam lebih awal.',
            'INV/2026/10/0007',
            'Catatan internal untuk klien.',
            'token-rahasia',
            '08:00',
        ];
    }

    private function assertNoSensitiveData(string $json): void
    {
        foreach ($this->sensitiveStrings() as $sensitive) {
            $this->assertStringNotContainsString(
                $sensitive,
                $json,
                "Data operasional '{$sensitive}' bocor ke respons admin.",
            );
        }
    }

    public function test_daftar_vendor_hanya_memuat_kunci_terbatas(): void
    {
        $response = $this->getJson('/api/admin/vendors')->assertOk();
        $item = $response->json('0');

        $expected = [
            'id', 'name', 'ownerName', 'email', 'category', 'city',
            'description', 'contact', 'isActive', 'subscription',
            'bookingsCount', 'invoicesCount', 'createdAt',
        ];

        $keys = array_keys($item);
        sort($expected);
        sort($keys);

        $this->assertSame($expected, $keys);
        $this->assertSame(1, $item['bookingsCount']);
        $this->assertSame(1, $item['invoicesCount']);

        $this->assertNoSensitiveData($response->getContent());
    }

    public function test_detail_vendor_tidak_membocorkan_data_booking(): void
    {
        $response = $this->getJson("/api/admin/vendors/{$this->vendor->id}")->assertOk();

        $expected = [
            'id', 'name', 'ownerName', 'email', 'category', 'city',
            'description', 'contact', 'isActive', 'subscription',
            'bookingsCount', 'invoicesCount', 'createdAt',
        ];

        $keys = array_keys($response->json());
        sort($expected);
        sort($keys);

        $this->assertSame($expected, $keys);
        $this->assertNoSensitiveData($response->getContent());
    }

    public function test_riwayat_langganan_hanya_memuat_kunci_transaksi(): void
    {
        $plan = Plan::create([
            'code' => 'monthly',
            'name' => 'Bulanan',
            'duration_months' => 1,
            'price' => 50000,
            'is_active' => true,
        ]);

        SubscriptionPayment::create([
            'vendor_id' => $this->vendor->id,
            'plan_id' => $plan->id,
            'order_id' => 'PAY-2026-0001',
            'gateway' => 'midtrans',
            'amount' => 50000,
            'status' => 'paid',
            'payment_method' => 'midtrans-qris',
            'raw_payload' => ['signature_key' => 'rahasia-gateway'],
            'paid_at' => '2026-10-20 10:00:00',
        ]);

        $response = $this->getJson("/api/admin/vendors/{$this->vendor->id}/payments")->assertOk();

        $expected = [
            'id', 'reference', 'vendorId', 'planName', 'amount',
            'status', 'method', 'createdAt', 'paidAt',
        ];

        $keys = array_keys($response->json('0'));
        sort($expected);
        sort($keys);

        $this->assertSame($expected, $keys);

        // Payload mentah gateway tidak ikut keluar.
        $this->assertStringNotContainsString('rahasia-gateway', $response->getContent());
        $this->assertStringNotContainsString('raw_payload', $response->getContent());
    }

    public function test_data_operasional_tetap_tersedia_untuk_vendor_sendiri(): void
    {
        // Endpoint "pesanan masuk" hanya memuat booking tentatif.
        $this->booking->update(['status' => 'tentative']);

        // Pembatasan hanya di sisi admin; vendor tetap melihat datanya.
        $this->loginAsVendorOf($this->vendor)
            ->getJson('/api/bookings/incoming')
            ->assertOk()
            ->assertJsonPath('items.0.client.name', 'Rani & Bagas')
            ->assertJsonPath('items.0.eventLocation', 'Balai Kartini, Jakarta');
    }

    public function test_admin_tidak_punya_akses_daftar_booking_vendor(): void
    {
        // Tidak ada endpoint admin yang menyajikan daftar booking/invoice.
        $this->getJson('/api/admin/vendors/'.$this->vendor->id.'/bookings')->assertNotFound();
        $this->getJson('/api/admin/vendors/'.$this->vendor->id.'/invoices')->assertNotFound();
    }
}
