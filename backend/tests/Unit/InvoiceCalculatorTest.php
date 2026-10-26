<?php

namespace Tests\Unit;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Models\Vendor;
use App\Services\InvoiceCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji perhitungan nominal invoice: DP, pelunasan, sisa kontrak, dan status.
 */
class InvoiceCalculatorTest extends TestCase
{
    use RefreshDatabase;

    private InvoiceCalculator $calculator;
    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();

        $this->calculator = new InvoiceCalculator();

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

    private function addInvoice(array $overrides = []): Invoice
    {
        static $sequence = 0;
        $sequence++;

        return Invoice::create(array_merge([
            'booking_id' => $this->booking->id,
            'invoice_number' => sprintf('INV/2026/10/%04d', $sequence),
            'public_token' => 'token-' . $sequence,
            'type' => 'dp',
            'amount' => 6000000,
            'paid_amount' => 0,
            'status' => Invoice::STATUS_UNPAID,
            'due_date' => '2026-10-30',
        ], $overrides));
    }

    public function test_dp_adalah_40_persen_kontrak(): void
    {
        $this->assertSame(6000000.0, $this->calculator->dpAmount(15000000));
        $this->assertSame(8500000.0, $this->calculator->dpAmount(21250000));
    }

    public function test_pelunasan_menutup_sisa_kontrak(): void
    {
        $this->assertSame(9000000.0, $this->calculator->settlementAmount(15000000));
        $this->assertSame(0.0, $this->calculator->settlementAmount(0));
    }

    public function test_dp_dan_pelunasan_menjumlah_persis_kontrak(): void
    {
        foreach ([8500000, 8500001, 24500000, 999999] as $total) {
            $sum = $this->calculator->dpAmount($total) + $this->calculator->settlementAmount($total);
            $this->assertSame((float) $total, $sum, "Kontrak {$total} tidak tertutup penuh.");
        }
    }

    public function test_sisa_kontrak_mengabaikan_invoice_dibatalkan(): void
    {
        $this->addInvoice(['amount' => 6000000]);
        $this->addInvoice([
            'id' => 2,
            'amount' => 4000000,
            'status' => Invoice::STATUS_CANCELLED,
        ]);

        $this->assertSame(9000000.0, $this->calculator->remainingBillable($this->booking));
    }

    public function test_billable_limit_mengecualikan_invoice_yang_diedit(): void
    {
        $first = $this->addInvoice(['amount' => 6000000]);
        $this->addInvoice(['id' => 2, 'amount' => 3000000]);

        // Tanpa pengecualian: 15jt - 9jt = 6jt.
        $this->assertSame(6000000.0, $this->calculator->billableLimit($this->booking));

        // Saat mengedit invoice pertama (6jt), batasnya 15jt - 3jt = 12jt.
        $this->assertSame(12000000.0, $this->calculator->billableLimit($this->booking, $first->id));
    }

    public function test_saran_nominal_pelunasan_memakai_sisa_kontrak(): void
    {
        $this->addInvoice(['amount' => 6000000]);

        $this->assertSame(9000000.0, $this->calculator->suggestedAmount($this->booking, 'pelunasan'));
        // DP selalu 40% dari kontrak, bukan sisa.
        $this->assertSame(6000000.0, $this->calculator->suggestedAmount($this->booking, 'dp'));
    }

    public function test_breakdown_menghitung_sisa_setelah_invoice_ini(): void
    {
        $this->addInvoice(['amount' => 6000000]);

        $breakdown = $this->calculator->breakdown($this->booking, 4000000);

        $this->assertSame(15000000.0, $breakdown['total']);
        $this->assertSame(6000000.0, $breakdown['billed']);
        $this->assertSame(9000000.0, $breakdown['remaining']);
        $this->assertSame(4000000.0, $breakdown['current']);
        $this->assertSame(5000000.0, $breakdown['afterThis']);
    }

    public function test_status_invoice_mengikuti_pembayaran(): void
    {
        $this->assertSame(
            Invoice::STATUS_UNPAID,
            $this->calculator->statusAfterPayment(6000000, 0, 0),
        );
        $this->assertSame(
            Invoice::STATUS_PARTIAL,
            $this->calculator->statusAfterPayment(6000000, 0, 2000000),
        );
        $this->assertSame(
            Invoice::STATUS_PAID,
            $this->calculator->statusAfterPayment(6000000, 4000000, 2000000),
        );
        $this->assertSame(
            Invoice::STATUS_PAID,
            $this->calculator->statusAfterPayment(6000000, 0, 7000000),
        );
        $this->assertSame(
            Invoice::STATUS_CANCELLED,
            $this->calculator->statusAfterPayment(
                6000000,
                0,
                6000000,
                Invoice::STATUS_CANCELLED,
            ),
        );
    }

    public function test_sisa_tagihan_invoice_tidak_negatif(): void
    {
        $invoice = $this->addInvoice(['amount' => 6000000, 'paid_amount' => 7000000]);

        $this->assertSame(0.0, $this->calculator->remainingOf($invoice));
    }
}
