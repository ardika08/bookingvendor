<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Models\Vendor;
use App\Services\InvoiceNumberGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Uji sistem penomoran invoice: format, urutan per tahun, tidak pernah dipakai
 * ulang, dan rollback saat pembuatan invoice gagal.
 */
class InvoiceNumberingTest extends TestCase
{
    use RefreshDatabase;

    private InvoiceNumberGenerator $generator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->generator = new InvoiceNumberGenerator();
    }

    private function makeBooking(): Booking
    {
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

        return Booking::create([
            'vendor_id' => $vendor->id,
            'client_id' => $client->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);
    }

    public function test_format_nomor_invoice(): void
    {
        $this->assertSame('INV/2026/10/0007', $this->generator->format(2026, '10', 7));
        $this->assertSame('INV/2026/01/0001', $this->generator->format(2026, '01', 1));
        // Urutan melewati 9999 tetap valid dan tidak terpotong.
        $this->assertSame('INV/2026/10/10000', $this->generator->format(2026, '10', 10000));
    }

    public function test_urutan_berjalan_per_tahun_dan_lintas_bulan(): void
    {
        $booking = $this->makeBooking();
        $numbers = [];

        foreach (['2026-10-01', '2026-10-02', '2026-11-05', '2026-12-31'] as $issuedAt) {
            $numbers[] = $this->generator->withNumber(
                $issuedAt,
                fn (string $number) => $number,
            );
        }

        $this->assertSame([
            'INV/2026/10/0001',
            'INV/2026/10/0002',
            'INV/2026/11/0003',
            'INV/2026/12/0004',
        ], $numbers);

        $this->assertDatabaseHas('invoice_sequences', ['year' => 2026, 'last_number' => 4]);
    }

    public function test_urutan_direset_per_tahun(): void
    {
        $this->generator->withNumber('2026-12-31', fn (string $number) => $number);
        $nextYear = $this->generator->withNumber('2027-01-01', fn (string $number) => $number);

        $this->assertSame('INV/2027/01/0001', $nextYear);
        $this->assertDatabaseHas('invoice_sequences', ['year' => 2026, 'last_number' => 1]);
        $this->assertDatabaseHas('invoice_sequences', ['year' => 2027, 'last_number' => 1]);
    }

    public function test_nomor_tidak_dipakai_ulang_setelah_invoice_dibatalkan(): void
    {
        $booking = $this->makeBooking();

        $first = $this->generator->withNumber('2026-10-23', function (string $number) use ($booking) {
            return Invoice::create([
                'booking_id' => $booking->id,
                'invoice_number' => $number,
                'public_token' => 'token-1',
                'type' => 'dp',
                'amount' => 1000000,
                'paid_amount' => 0,
                'status' => Invoice::STATUS_UNPAID,
                'due_date' => '2026-10-30',
            ]);
        });

        $first->update(['status' => Invoice::STATUS_CANCELLED]);

        $second = $this->generator->withNumber('2026-10-24', fn (string $number) => $number);

        $this->assertSame('INV/2026/10/0001', $first->invoice_number);
        $this->assertSame('INV/2026/10/0002', $second);
    }

    public function test_urutan_dirollback_bila_pembuatan_invoice_gagal(): void
    {
        try {
            $this->generator->withNumber('2026-10-23', function (): void {
                throw new \RuntimeException('Gagal menyimpan invoice.');
            });
        } catch (\RuntimeException) {
            // diabaikan — yang diuji adalah state penghitung.
        }

        $this->assertDatabaseMissing('invoice_sequences', ['year' => 2026]);

        $next = $this->generator->withNumber('2026-10-23', fn (string $number) => $number);
        $this->assertSame('INV/2026/10/0001', $next);
    }

    public function test_unique_index_menolak_nomor_ganda(): void
    {
        $booking = $this->makeBooking();

        $payload = [
            'booking_id' => $booking->id,
            'invoice_number' => 'INV/2026/10/0001',
            'public_token' => 'token-1',
            'type' => 'dp',
            'amount' => 1000000,
            'paid_amount' => 0,
            'status' => Invoice::STATUS_UNPAID,
            'due_date' => '2026-10-30',
        ];

        Invoice::create($payload);

        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);

        Invoice::create(array_merge($payload, ['public_token' => 'token-2']));
    }

    public function test_sync_from_existing_melanjutkan_nomor_terakhir(): void
    {
        $booking = $this->makeBooking();

        foreach ([7, 3] as $index => $sequence) {
            Invoice::create([
                'booking_id' => $booking->id,
                'invoice_number' => sprintf('INV/2026/10/%04d', $sequence),
                'public_token' => 'token-' . $index,
                'type' => 'dp',
                'amount' => 1000000,
                'paid_amount' => 0,
                'status' => Invoice::STATUS_UNPAID,
                'due_date' => '2026-10-30',
            ]);
        }

        $highest = $this->generator->syncFromExisting(2026);
        $next = $this->generator->withNumber('2026-11-01', fn (string $number) => $number);

        $this->assertSame(7, $highest);
        $this->assertSame('INV/2026/11/0008', $next);
        $this->assertSame(8, (int) DB::table('invoice_sequences')->where('year', 2026)->value('last_number'));
    }
}
