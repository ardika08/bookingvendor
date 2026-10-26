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
 * Uji halaman invoice publik: status yang tampil ke klien, nominal, instruksi
 * transfer, dan perlindungan token.
 */
class PublicInvoiceTest extends TestCase
{
    use RefreshDatabase;

    private Invoice $invoice;
    private Vendor $vendor;

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
            'contact' => '6281290001122',
            'location' => 'Jakarta Selatan',
            'bank_name' => 'BCA',
            'bank_account_number' => '1234567890',
            'bank_account_name' => 'Lumen Wedding Story',
        ]);

        $client = Client::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Rani & Bagas',
            'phone' => '6281234567890',
        ]);

        $booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $client->id,
            'event_date' => '2026-11-14',
            'event_time' => '08:00',
            'event_location' => 'Balai Kartini, Jakarta',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);

        $this->invoice = Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV/2026/10/0001',
            'public_token' => 'rahasia-token-klien',
            'type' => 'dp',
            'amount' => 6000000,
            'paid_amount' => 2000000,
            'status' => Invoice::STATUS_PARTIAL,
            'due_date' => '2099-10-30',
            'note' => 'Mohon cantumkan nomor invoice pada berita transfer.',
            'link_active' => true,
        ]);
    
        $this->loginAsVendorOf($this->vendor);
    }

    private function publicUrl(string $token = 'rahasia-token-klien'): string
    {
        return "/api/public/invoices/{$token}";
    }

    public function test_klien_melihat_invoice_lewat_token(): void
    {
        $this->getJson($this->publicUrl())
            ->assertOk()
            ->assertJsonPath('number', 'INV/2026/10/0001')
            ->assertJsonPath('status', 'partial')
            ->assertJsonPath('statusLabel', 'Dibayar sebagian')
            ->assertJsonPath('amount', 6000000)
            ->assertJsonPath('paidAmount', 2000000)
            ->assertJsonPath('remaining', 4000000)
            ->assertJsonPath('paidPercent', 33)
            ->assertJsonPath('booking.clientName', 'Rani & Bagas')
            ->assertJsonPath('booking.eventDate', '2026-11-14')
            ->assertJsonPath('vendor.name', 'Lumen Wedding Story')
            ->assertJsonPath('vendor.bank.name', 'BCA')
            ->assertJsonPath('vendor.bank.accountNumber', '1234567890');
    }

    public function test_data_internal_tidak_ikut_terkirim(): void
    {
        $response = $this->getJson($this->publicUrl())->assertOk();

        $response->assertJsonMissingPath('id')
            ->assertJsonMissingPath('bookingId')
            ->assertJsonMissingPath('publicToken')
            ->assertJsonMissingPath('vendor.id');
    }

    public function test_status_lunas_ditampilkan_dengan_sisa_nol(): void
    {
        $this->invoice->update([
            'paid_amount' => 6000000,
            'status' => Invoice::STATUS_PAID,
        ]);

        $this->getJson($this->publicUrl())
            ->assertOk()
            ->assertJsonPath('status', 'paid')
            ->assertJsonPath('statusLabel', 'Lunas')
            ->assertJsonPath('remaining', 0)
            ->assertJsonPath('paidPercent', 100);
    }

    public function test_invoice_dibatalkan_tampil_sebagai_void(): void
    {
        $this->invoice->update(['status' => Invoice::STATUS_CANCELLED]);

        $this->getJson($this->publicUrl())
            ->assertOk()
            ->assertJsonPath('status', 'void')
            ->assertJsonPath('statusLabel', 'Dibatalkan')
            ->assertJsonPath('remaining', 0);
    }

    public function test_invoice_terlambat_ditandai(): void
    {
        $this->invoice->update(['due_date' => '2020-01-01']);

        $this->getJson($this->publicUrl())
            ->assertOk()
            ->assertJsonPath('isOverdue', true);
    }

    public function test_link_yang_dinonaktifkan_menghasilkan_404(): void
    {
        $this->invoice->update(['link_active' => false]);

        $this->getJson($this->publicUrl())->assertNotFound();
    }

    public function test_token_tidak_dikenal_menghasilkan_404(): void
    {
        $this->getJson($this->publicUrl('token-palsu'))->assertNotFound();
    }
}
