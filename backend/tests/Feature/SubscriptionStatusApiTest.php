<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji endpoint status langganan & sisa kuota trial (`GET /api/subscription`).
 *
 * Endpoint ini menyuplai kartu "sisa jatah trial": status periode, pemakaian
 * booking/invoice, sisa, dan izin aksi. Kuota hanya milik masa trial.
 */
class SubscriptionStatusApiTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;
    private Client $client;
    private Plan $monthly;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Dika Pratama',
            'email' => 'dika@example.test',
            'password' => 'password',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
        ]);

        $this->client = Client::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Rani & Bagas',
            'phone' => '6281234567890',
        ]);

        $this->monthly = Plan::create([
            'code' => 'monthly',
            'name' => 'Bulanan',
            'duration_months' => 1,
            'price' => 50000,
            'is_active' => true,
        ]);
    }

    private function subscribe(string $status, ?string $endsAt = null, int $bookingsUsed = 0, int $invoicesUsed = 0): void
    {
        Subscription::create([
            'vendor_id' => $this->vendor->id,
            'plan_id' => $status === Subscription::STATUS_TRIAL ? null : $this->monthly->id,
            'status' => $status,
            'starts_at' => now()->subMonth()->toDateString(),
            'ends_at' => $endsAt,
            'trial_bookings_used' => $bookingsUsed,
            'trial_invoices_used' => $invoicesUsed,
        ]);
    }

    public function test_trial_menampilkan_sisa_kuota(): void
    {
        $this->subscribe(Subscription::STATUS_TRIAL, null, 1, 0);

        $this->getJson('/api/subscription')
            ->assertOk()
            ->assertJsonPath('status', 'trial')
            ->assertJsonPath('endsAt', null)
            ->assertJsonPath('trialBookingsUsed', 1)
            ->assertJsonPath('trialBookingsLimit', 2)
            ->assertJsonPath('trialInvoicesUsed', 0)
            ->assertJsonPath('trialInvoicesLimit', 2)
            ->assertJsonPath('remainingBookings', 1)
            ->assertJsonPath('remainingInvoices', 2)
            ->assertJsonPath('canCreateBooking', true)
            ->assertJsonPath('canCreateInvoice', true);
    }

    public function test_trial_habis_memblokir_aksi(): void
    {
        $this->subscribe(Subscription::STATUS_TRIAL, null, 2, 2);

        $this->getJson('/api/subscription')
            ->assertOk()
            ->assertJsonPath('remainingBookings', 0)
            ->assertJsonPath('remainingInvoices', 0)
            ->assertJsonPath('canCreateBooking', false)
            ->assertJsonPath('canCreateInvoice', false);
    }

    public function test_langganan_aktif_tanpa_batas(): void
    {
        $this->subscribe(Subscription::STATUS_ACTIVE, now()->addDays(20)->toDateString(), 2, 2);

        $this->getJson('/api/subscription')
            ->assertOk()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('endsAt', now()->addDays(20)->toDateString())
            ->assertJsonPath('remainingBookings', null)
            ->assertJsonPath('remainingInvoices', null)
            ->assertJsonPath('canCreateBooking', true)
            ->assertJsonPath('canCreateInvoice', true);
    }

    public function test_masa_tenggang_masih_boleh_bekerja(): void
    {
        $this->subscribe(Subscription::STATUS_ACTIVE, now()->subDays(2)->toDateString());

        $this->getJson('/api/subscription')
            ->assertOk()
            ->assertJsonPath('status', 'grace')
            ->assertJsonPath('canCreateBooking', true);
    }

    public function test_langganan_berakhir_memblokir_aksi(): void
    {
        $this->subscribe(Subscription::STATUS_ACTIVE, now()->subDays(30)->toDateString());

        $this->getJson('/api/subscription')
            ->assertOk()
            ->assertJsonPath('status', 'expired')
            ->assertJsonPath('canCreateBooking', false)
            ->assertJsonPath('canCreateInvoice', false);
    }

    public function test_tanpa_baris_langganan_pemakaian_dihitung_dari_data_nyata(): void
    {
        Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $this->client->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 15000000,
        ]);

        $booking = $this->vendor->bookings()->firstOrFail();

        Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV/2026/10/0001',
            'public_token' => 'token-1',
            'type' => 'dp',
            'amount' => 6000000,
            'paid_amount' => 0,
            'status' => Invoice::STATUS_UNPAID,
            'due_date' => '2026-10-30',
        ]);

        $this->getJson('/api/subscription')
            ->assertOk()
            ->assertJsonPath('status', 'trial')
            ->assertJsonPath('trialBookingsUsed', 1)
            ->assertJsonPath('trialInvoicesUsed', 1)
            ->assertJsonPath('remainingBookings', 1)
            ->assertJsonPath('remainingInvoices', 1);
    }

    public function test_akun_nonaktif_tidak_bisa_melihat_status(): void
    {
        $this->vendor->update(['is_active' => false]);

        $this->getJson('/api/subscription')
            ->assertStatus(403)
            ->assertJsonPath('code', 'vendor_inactive');
    }
}
