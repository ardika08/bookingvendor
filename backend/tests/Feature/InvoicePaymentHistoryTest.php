<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Riwayat pembayaran invoice.
 *
 * Endpoint `GET /api/invoices/{invoice}/payments` sebelumnya tidak ada,
 * sehingga halaman detail invoice gagal dimuat (405) padahal invoice-nya
 * sendiri berhasil diambil. Test ini menjaga agar endpoint itu tetap ada.
 */
class InvoicePaymentHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_riwayat_pembayaran_dikembalikan(): void
    {
        [$invoice] = $this->invoice();

        Payment::query()->create([
            'invoice_id' => $invoice->id,
            'amount' => 2000000,
            'method' => 'transfer',
            'paid_at' => '2027-01-10',
            'note' => 'Transfer BCA',
            'created_by' => $this->user->id,
        ]);

        $this->getJson('/api/invoices/'.$invoice->id.'/payments')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.amount', 2000000)
            ->assertJsonPath('0.method', 'transfer')
            ->assertJsonPath('0.paidAt', '2027-01-10')
            ->assertJsonPath('0.invoiceId', (string) $invoice->id);
    }

    public function test_invoice_tanpa_pembayaran_mengembalikan_array_kosong(): void
    {
        [$invoice] = $this->invoice();

        // Halaman detail harus tetap bisa dimuat meski belum ada pembayaran.
        $this->getJson('/api/invoices/'.$invoice->id.'/payments')
            ->assertOk()
            ->assertExactJson([]);
    }

    public function test_pembayaran_terbaru_muncul_lebih_dulu(): void
    {
        [$invoice] = $this->invoice();

        foreach ([['2027-01-05', 1000000], ['2027-02-20', 500000]] as [$date, $amount]) {
            Payment::query()->create([
                'invoice_id' => $invoice->id,
                'amount' => $amount,
                'method' => 'transfer',
                'paid_at' => $date,
                'created_by' => $this->user->id,
            ]);
        }

        $this->getJson('/api/invoices/'.$invoice->id.'/payments')
            ->assertOk()
            ->assertJsonPath('0.paidAt', '2027-02-20')
            ->assertJsonPath('1.paidAt', '2027-01-05');
    }

    public function test_invoice_vendor_lain_dibalas_404(): void
    {
        [$invoice] = $this->invoice();

        $lain = User::query()->create([
            'name' => 'Vendor Lain', 'email' => 'lain-pay@example.com', 'role' => User::ROLE_VENDOR,
        ]);
        Vendor::query()->create([
            'user_id' => $lain->id, 'name' => 'Vendor Lain', 'slug' => 'vendor-lain-pay',
        ]);

        $this->loginAs($lain->fresh());

        $this->getJson('/api/invoices/'.$invoice->id.'/payments')->assertNotFound();
    }

    public function test_tanpa_login_ditolak(): void
    {
        [$invoice] = $this->invoice();
        $this->loginAs(null);

        $this->getJson('/api/invoices/'.$invoice->id.'/payments')->assertUnauthorized();
    }

    // -----------------------------------------------------------------------

    private User $user;

    /**
     * @return array{0: Invoice}
     */
    private function invoice(): array
    {
        $this->user = User::query()->create([
            'name' => 'Vendor Uji', 'email' => 'vendor-pay@example.com', 'role' => User::ROLE_VENDOR,
        ]);

        $vendor = Vendor::query()->create([
            'user_id' => $this->user->id, 'name' => 'Lumen Wedding Story', 'slug' => 'lumen-pay',
        ]);

        $client = Client::query()->create([
            'vendor_id' => $vendor->id, 'name' => 'Rani', 'phone' => '081233334444',
        ]);

        $booking = Booking::query()->create([
            'vendor_id' => $vendor->id,
            'client_id' => $client->id,
            'event_date' => '2027-09-09',
            'event_location' => 'Bandung',
            'status' => Booking::STATUS_CONFIRMED,
            'total_price' => 10000000,
        ]);

        $invoice = Invoice::query()->create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-2027-9001',
            'type' => 'dp',
            'amount' => 5000000,
            'paid_amount' => 0,
            'status' => 'unpaid',
            'issued_at' => now()->toDateString(),
            'due_date' => now()->addDays(7)->toDateString(),
            'public_token' => str_repeat('a', 40),
            'link_active' => false,
        ]);

        $this->loginAs($this->user->fresh());

        return [$invoice];
    }
}
