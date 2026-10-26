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
 * Uji CRUD utama invoice: daftar + agregat, rincian, perubahan, dan pembatalan.
 */
class InvoiceCrudTest extends TestCase
{
    use RefreshDatabase;

    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Vendor Uji',
            'email' => 'vendor@example.test',
            'password' => 'password',
        ]);

        $vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
        ]);

        $client = Client::create([
            'vendor_id' => $vendor->id,
            'name' => 'Rani & Bagas',
            'phone' => '6281234567890',
        ]);

        $this->booking = Booking::create([
            'vendor_id' => $vendor->id,
            'client_id' => $client->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);
    }

    private function makeInvoice(array $overrides = []): Invoice
    {
        return Invoice::create(array_merge([
            'booking_id' => $this->booking->id,
            'invoice_number' => 'INV/2026/10/0001',
            'public_token' => 'token-1',
            'type' => 'dp',
            'amount' => 6000000,
            'paid_amount' => 0,
            'status' => Invoice::STATUS_UNPAID,
            'due_date' => '2026-10-30',
        ], $overrides));
    }

    public function test_daftar_invoice_mengembalikan_items_dan_summary(): void
    {
        $this->makeInvoice();
        $this->makeInvoice([
            'id' => 2,
            'invoice_number' => 'INV/2026/10/0002',
            'public_token' => 'token-2',
            'type' => 'pelunasan',
            'amount' => 9000000,
            'paid_amount' => 3000000,
            'status' => Invoice::STATUS_PARTIAL,
        ]);
        $this->makeInvoice([
            'id' => 3,
            'invoice_number' => 'INV/2026/10/0003',
            'public_token' => 'token-3',
            'amount' => 1000000,
            'status' => Invoice::STATUS_CANCELLED,
        ]);

        $response = $this->getJson('/api/invoices')->assertOk();

        $response->assertJsonCount(3, 'items')
            ->assertJsonPath('total', 3)
            ->assertJsonPath('summary.billed', 15000000)
            ->assertJsonPath('summary.paid', 3000000)
            ->assertJsonPath('summary.outstanding', 12000000);

        // Invoice yang dibatalkan tampil sebagai `void` untuk frontend.
        $statuses = array_column($response->json('items'), 'status');
        $this->assertContains('void', $statuses);
    }

    public function test_daftar_invoice_bisa_difilter_status_dan_kata_kunci(): void
    {
        $this->makeInvoice();
        $this->makeInvoice([
            'id' => 2,
            'invoice_number' => 'INV/2026/10/0002',
            'public_token' => 'token-2',
            'status' => Invoice::STATUS_PAID,
            'paid_amount' => 6000000,
        ]);

        $this->getJson('/api/invoices?status=paid')
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.number', 'INV/2026/10/0002');

        $this->getJson('/api/invoices?q=rani')
            ->assertOk()
            ->assertJsonPath('total', 2);

        $this->getJson('/api/invoices?q=tidak-ada')
            ->assertOk()
            ->assertJsonPath('total', 0);
    }

    public function test_daftar_invoice_per_booking(): void
    {
        $this->makeInvoice();

        $this->getJson("/api/bookings/{$this->booking->id}/invoices")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.number', 'INV/2026/10/0001');
    }

    public function test_rincian_invoice(): void
    {
        $invoice = $this->makeInvoice();

        $this->getJson("/api/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('number', 'INV/2026/10/0001')
            ->assertJsonPath('clientName', 'Rani & Bagas')
            ->assertJsonPath('bookingTotal', 15000000)
            ->assertJsonPath('amount', 6000000);
    }

    public function test_ubah_nominal_dan_jatuh_tempo(): void
    {
        $invoice = $this->makeInvoice();

        $this->putJson("/api/invoices/{$invoice->id}", [
            'amount' => 5000000,
            'due_at' => '2026-11-05',
            'note' => 'Revisi nominal',
        ])
            ->assertOk()
            ->assertJsonPath('amount', 5000000)
            ->assertJsonPath('dueAt', '2026-11-05');

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'amount' => 5000000,
            'note' => 'Revisi nominal',
        ]);
    }

    public function test_nominal_tidak_boleh_di_bawah_yang_sudah_dibayar(): void
    {
        $invoice = $this->makeInvoice([
            'paid_amount' => 3000000,
            'status' => Invoice::STATUS_PARTIAL,
        ]);

        $this->putJson("/api/invoices/{$invoice->id}", ['amount' => 2000000])
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');
    }

    public function test_membatalkan_invoice_tanpa_pembayaran(): void
    {
        $invoice = $this->makeInvoice();

        $this->deleteJson("/api/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('status', 'void');

        $this->assertDatabaseHas('invoices', [
            'id' => $invoice->id,
            'status' => Invoice::STATUS_CANCELLED,
            'link_active' => false,
        ]);
    }

    public function test_invoice_yang_sudah_dibayar_tidak_bisa_dibatalkan(): void
    {
        $invoice = $this->makeInvoice([
            'paid_amount' => 1000000,
            'status' => Invoice::STATUS_PARTIAL,
        ]);

        $this->deleteJson("/api/invoices/{$invoice->id}")->assertStatus(422);
    }
}
