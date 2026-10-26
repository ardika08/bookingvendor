<?php

namespace Tests\Unit;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Models\Vendor;
use App\Services\InvoiceStatusResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Uji logika status invoice otomatis: turunan status dari nominal & pembayaran,
 * rekonsiliasi dari riwayat, deteksi terlambat, dan persentase pembayaran.
 */
class InvoiceStatusResolverTest extends TestCase
{
    use RefreshDatabase;

    private InvoiceStatusResolver $resolver;
    private Invoice $invoice;
    private int $userId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resolver = new InvoiceStatusResolver();

        $user = User::create([
            'name' => 'Vendor Uji',
            'email' => 'vendor@example.test',
            'password' => 'password',
        ]);
        $this->userId = $user->id;

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

    private function addPayment(float $amount): void
    {
        Payment::create([
            'invoice_id' => $this->invoice->id,
            'amount' => $amount,
            'method' => 'transfer',
            'paid_at' => '2026-10-23',
            'created_by' => $this->userId,
        ]);
    }

    public function test_tanpa_pembayaran_berstatus_unpaid(): void
    {
        $this->assertSame(Invoice::STATUS_UNPAID, $this->resolver->derive(6000000, 0, Invoice::STATUS_UNPAID));
    }

    public function test_pembayaran_sebagian_berstatus_partial(): void
    {
        $this->assertSame(Invoice::STATUS_PARTIAL, $this->resolver->derive(6000000, 2500000, Invoice::STATUS_UNPAID));
    }

    public function test_pembayaran_penuh_atau_lebih_berstatus_paid(): void
    {
        $this->assertSame(Invoice::STATUS_PAID, $this->resolver->derive(6000000, 6000000, Invoice::STATUS_PARTIAL));
        $this->assertSame(Invoice::STATUS_PAID, $this->resolver->derive(6000000, 6500000, Invoice::STATUS_PARTIAL));
    }

    public function test_invoice_dibatalkan_tetap_cancelled(): void
    {
        $this->assertSame(
            Invoice::STATUS_CANCELLED,
            $this->resolver->derive(6000000, 6000000, Invoice::STATUS_CANCELLED),
        );
    }

    public function test_recalculate_menghitung_ulang_dari_riwayat_pembayaran(): void
    {
        $this->addPayment(2500000);
        $this->addPayment(1500000);

        // Nilai tersimpan sengaja salah untuk menguji rekonsiliasi.
        $this->invoice->update(['paid_amount' => 0, 'status' => Invoice::STATUS_UNPAID]);

        $result = $this->resolver->recalculate($this->invoice->fresh());

        $this->assertSame(4000000.0, (float) $result->paid_amount);
        $this->assertSame(Invoice::STATUS_PARTIAL, $result->status);
    }

    public function test_recalculate_melunasi_invoice(): void
    {
        $this->addPayment(6000000);

        $result = $this->resolver->recalculate($this->invoice->fresh());

        $this->assertSame(Invoice::STATUS_PAID, $result->status);
        $this->assertSame(0.0, $this->resolver->remaining($result));
    }

    public function test_recalculate_tidak_mengubah_invoice_dibatalkan(): void
    {
        $this->invoice->update(['status' => Invoice::STATUS_CANCELLED]);
        $this->addPayment(1000000);

        $result = $this->resolver->recalculate($this->invoice->fresh());

        $this->assertSame(Invoice::STATUS_CANCELLED, $result->status);
    }

    public function test_terlambat_hanya_bila_masih_menagih_dan_lewat_jatuh_tempo(): void
    {
        $today = Carbon::parse('2026-11-01');

        $this->assertTrue($this->resolver->isOverdue($this->invoice, $today));

        // Hari jatuh tempo belum dianggap terlambat.
        $this->assertFalse($this->resolver->isOverdue($this->invoice, Carbon::parse('2026-10-30')));

        // Invoice lunas tidak pernah terlambat.
        $this->invoice->update(['paid_amount' => 6000000, 'status' => Invoice::STATUS_PAID]);
        $this->assertFalse($this->resolver->isOverdue($this->invoice->fresh(), $today));
    }

    public function test_invoice_tanpa_jatuh_tempo_tidak_terlambat(): void
    {
        $this->invoice->update(['due_date' => null]);

        $this->assertFalse($this->resolver->isOverdue($this->invoice->fresh(), Carbon::parse('2027-01-01')));
    }

    public function test_persentase_pembayaran(): void
    {
        $this->invoice->update(['paid_amount' => 2000000]);
        $this->assertSame(33, $this->resolver->paidPercent($this->invoice->fresh()));

        $this->invoice->update(['paid_amount' => 6000000]);
        $this->assertSame(100, $this->resolver->paidPercent($this->invoice->fresh()));
    }

    public function test_status_frontend_memakai_void(): void
    {
        $this->invoice->update(['status' => Invoice::STATUS_CANCELLED]);
        $this->assertSame('void', $this->resolver->toFrontendStatus($this->invoice->fresh()));

        $this->invoice->update(['status' => Invoice::STATUS_UNPAID]);
        $this->assertSame('unpaid', $this->resolver->toFrontendStatus($this->invoice->fresh()));
    }
}
