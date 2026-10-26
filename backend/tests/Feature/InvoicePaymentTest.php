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
 * Uji pencatatan pembayaran invoice: akumulasi nominal, perubahan status,
 * penolakan pembayaran berlebih, dan penolakan pada invoice yang tidak aktif.
 */
class InvoicePaymentTest extends TestCase
{
    use RefreshDatabase;

    private Invoice $invoice;

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

        $booking = Booking::create([
            'vendor_id' => $vendor->id,
            'client_id' => $client->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);

        $this->invoice = Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV/2026/10/0001',
            'public_token' => 'token-1',
            'type' => 'dp',
            'amount' => 6000000,
            'paid_amount' => 0,
            'status' => Invoice::STATUS_UNPAID,
            'due_date' => '2026-10-30',
        ]);
    }

    private function today(): string
    {
        return now()->toDateString();
    }

    public function test_pembayaran_parsial_mengubah_status_menjadi_partial(): void
    {
        $this->postJson("/api/invoices/{$this->invoice->id}/payments", [
            'amount' => 2000000,
            'paid_at' => $this->today(),
            'method' => 'transfer',
            'note' => 'Transfer BCA a.n. Rani',
        ])
            ->assertCreated()
            ->assertJsonPath('status', 'partial')
            ->assertJsonPath('paidAmount', 2000000)
            ->assertJsonPath('amount', 6000000);

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $this->invoice->id,
            'amount' => 2000000,
            'method' => 'transfer',
        ]);
    }

    public function test_pelunasan_penuh_mengubah_status_menjadi_paid(): void
    {
        $this->postJson("/api/invoices/{$this->invoice->id}/payments", [
            'amount' => 6000000,
            'paid_at' => $this->today(),
            'method' => 'qris',
        ])
            ->assertCreated()
            ->assertJsonPath('status', 'paid')
            ->assertJsonPath('paidAmount', 6000000);
    }

    public function test_pembayaran_bertahap_diakumulasi(): void
    {
        $this->postJson("/api/invoices/{$this->invoice->id}/payments", [
            'amount' => 2500000,
            'paid_at' => $this->today(),
            'method' => 'transfer',
        ])->assertCreated();

        $this->postJson("/api/invoices/{$this->invoice->id}/payments", [
            'amount' => 3500000,
            'paid_at' => $this->today(),
            'method' => 'cash',
        ])
            ->assertCreated()
            ->assertJsonPath('status', 'paid')
            ->assertJsonPath('paidAmount', 6000000);

        $this->assertDatabaseCount('payments', 2);
    }

    public function test_pembayaran_melebihi_sisa_ditolak(): void
    {
        $this->postJson("/api/invoices/{$this->invoice->id}/payments", [
            'amount' => 7000000,
            'paid_at' => $this->today(),
            'method' => 'transfer',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_invoice_lunas_tidak_bisa_menerima_pembayaran_lagi(): void
    {
        $this->invoice->update([
            'paid_amount' => 6000000,
            'status' => Invoice::STATUS_PAID,
        ]);

        $this->postJson("/api/invoices/{$this->invoice->id}/payments", [
            'amount' => 100000,
            'paid_at' => $this->today(),
            'method' => 'transfer',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');
    }

    public function test_invoice_dibatalkan_tidak_bisa_menerima_pembayaran(): void
    {
        $this->invoice->update(['status' => Invoice::STATUS_CANCELLED]);

        $this->postJson("/api/invoices/{$this->invoice->id}/payments", [
            'amount' => 1000000,
            'paid_at' => $this->today(),
            'method' => 'transfer',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');
    }

    public function test_tanggal_bayar_di_masa_depan_ditolak(): void
    {
        $tomorrow = now()->addDay()->toDateString();

        $this->postJson("/api/invoices/{$this->invoice->id}/payments", [
            'amount' => 1000000,
            'paid_at' => $tomorrow,
            'method' => 'transfer',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('paid_at');
    }

    public function test_metode_pembayaran_harus_dikenal(): void
    {
        $this->postJson("/api/invoices/{$this->invoice->id}/payments", [
            'amount' => 1000000,
            'paid_at' => $this->today(),
            'method' => 'bitcoin',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('method');
    }

    public function test_pencatat_pembayaran_terisi_otomatis(): void
    {
        $this->postJson("/api/invoices/{$this->invoice->id}/payments", [
            'amount' => 1000000,
            'paid_at' => $this->today(),
            'method' => 'transfer',
        ])->assertCreated();

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $this->invoice->id,
            'created_by' => $this->invoice->booking->vendor->user_id,
        ]);
    }
}
