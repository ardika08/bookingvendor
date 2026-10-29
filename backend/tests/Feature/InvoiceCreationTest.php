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
 * Uji endpoint pembuatan invoice dari booking.
 *
 * Fokus: invoice lahir dari data booking (bukan payload klien), nomor invoice
 * berurutan, dan validasi sisa kontrak/tanggal bekerja sesuai PRD.
 */
class InvoiceCreationTest extends TestCase
{
    use RefreshDatabase;

    private function makeBooking(float $totalPrice = 15000000): Booking
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
            'bank_name' => 'BCA',
            'bank_account_number' => '1234567890',
            'bank_account_name' => 'Lumen Wedding Story',
        ]);

        $client = Client::create([
            'vendor_id' => $vendor->id,
            'name' => 'Rani & Bagas',
            'phone' => '6281234567890',
        ]);

        // Endpoint invoice butuh sesi login pemilik vendor.
        $this->loginAsVendorOf($vendor);

        return Booking::create([
            'vendor_id' => $vendor->id,
            'client_id' => $client->id,
            'event_date' => '2026-11-14',
            'event_time' => '08:00',
            'status' => 'confirmed',
            'total_price' => $totalPrice,
        ]);
    }

    public function test_membuat_invoice_dari_booking(): void
    {
        $booking = $this->makeBooking();

        $response = $this->postJson("/api/bookings/{$booking->id}/invoices", [
            'type' => 'dp',
            'amount' => 6000000,
            'issued_at' => '2026-10-23',
            'due_at' => '2026-10-30',
        ]);

        $response->assertCreated()
            ->assertJsonPath('number', 'INV/2026/10/0001')
            ->assertJsonPath('clientName', 'Rani & Bagas')
            ->assertJsonPath('bookingId', (string) $booking->id)
            ->assertJsonPath('status', 'unpaid')
            ->assertJsonPath('type', 'dp')
            ->assertJsonPath('amount', 6000000)
            ->assertJsonPath('eventDate', '2026-11-14')
            ->assertJsonPath('dueAt', '2026-10-30');

        $this->assertDatabaseHas('invoices', [
            'booking_id' => $booking->id,
            'invoice_number' => 'INV/2026/10/0001',
            'status' => 'unpaid',
        ]);
    }

    public function test_nomor_invoice_berurutan_per_tahun(): void
    {
        $booking = $this->makeBooking();

        $payload = [
            'type' => 'dp',
            'amount' => 6000000,
            'issued_at' => '2026-10-23',
            'due_at' => '2026-10-30',
        ];

        $this->postJson("/api/bookings/{$booking->id}/invoices", $payload)->assertCreated();
        $this->postJson("/api/bookings/{$booking->id}/invoices", $payload)
            ->assertCreated()
            ->assertJsonPath('number', 'INV/2026/10/0002');
    }

    public function test_nominal_melebihi_sisa_kontrak_ditolak(): void
    {
        $booking = $this->makeBooking(1000000);

        $this->postJson("/api/bookings/{$booking->id}/invoices", [
            'type' => 'dp',
            'amount' => 2000000,
            'issued_at' => '2026-10-23',
            'due_at' => '2026-10-30',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('amount');
    }

    public function test_jatuh_tempo_sebelum_tanggal_terbit_ditolak(): void
    {
        $booking = $this->makeBooking();

        $this->postJson("/api/bookings/{$booking->id}/invoices", [
            'type' => 'dp',
            'amount' => 1000000,
            'issued_at' => '2026-10-23',
            'due_at' => '2026-10-20',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('due_at');
    }

    public function test_invoice_dibatalkan_tidak_menghitung_sisa_kontrak(): void
    {
        $booking = $this->makeBooking(1000000);

        Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV/2026/10/0099',
            'public_token' => 'token-lama',
            'type' => 'dp',
            'amount' => 1000000,
            'paid_amount' => 0,
            'status' => Invoice::STATUS_CANCELLED,
            'due_date' => '2026-10-30',
        ]);

        $this->postJson("/api/bookings/{$booking->id}/invoices", [
            'type' => 'dp',
            'amount' => 1000000,
            'issued_at' => '2026-10-23',
            'due_at' => '2026-10-30',
        ])->assertCreated();
    }
}
