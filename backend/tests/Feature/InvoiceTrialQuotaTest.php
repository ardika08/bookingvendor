<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\User;
use App\Models\Vendor;
use App\Services\SubscriptionStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Uji penegakan masa uji (trial) berbasis **waktu**, bukan kuota transaksi.
 *
 * Sebelumnya trial dibatasi 2 booking + 2 invoice. Batas itu dihapus karena
 * vendor wedding baru hanya memegang sedikit acara per bulan sehingga kuota
 * habis sebelum mereka sempat mencoba alur lengkap. Sekarang trial berjalan
 * 30 hari dengan akses penuh, lalu berhenti.
 *
 * Yang diuji di sini: selama masa uji semua transaksi boleh tanpa batas
 * jumlah, dan setelah tanggal berakhir semuanya ditolak.
 */
class InvoiceTrialQuotaTest extends TestCase
{
    use RefreshDatabase;

    private Booking $booking;

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
            'bank_name' => 'BCA',
            'bank_account_number' => '1234567890',
            'bank_account_name' => 'Lumen Wedding Story',
        ]);

        $client = Client::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Rani & Bagas',
            'phone' => '6281234567890',
        ]);

        $this->booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $client->id,
            'event_date' => '2026-11-14',
            'status' => 'confirmed',
            'total_price' => 150000000,
        ]);

        $this->loginAsVendorOf($this->vendor);
    }

    /**
     * Buat baris langganan trial dengan tanggal berakhir tertentu.
     */
    private function trialEnding(?Carbon $endsAt): void
    {
        DB::table('subscriptions')->insert([
            'vendor_id' => $this->vendor->id,
            'status' => 'trial',
            'starts_at' => now()->subDays(30)->toDateString(),
            'ends_at' => $endsAt?->toDateString(),
            'trial_bookings_used' => 0,
            'trial_invoices_used' => 0,
            'amount_paid' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function invoicePayload(float $amount = 1000000): array
    {
        return [
            'type' => 'dp',
            'amount' => $amount,
            'issued_at' => '2026-10-23',
            'due_at' => '2026-10-30',
        ];
    }

    /** Selama masa uji, jumlah invoice tidak dibatasi. */
    public function test_trial_aktif_boleh_membuat_banyak_invoice(): void
    {
        $this->trialEnding(Carbon::today()->addDays(10));

        // Lima invoice berturut-turut — dulu diblokir pada invoice ketiga.
        for ($i = 0; $i < 5; $i++) {
            $this->postJson("/api/bookings/{$this->booking->id}/invoices", $this->invoicePayload(1000000))
                ->assertCreated();
        }

        $this->assertSame(
            5,
            $this->booking->invoices()->count(),
        );
    }

    /** Setelah tanggal berakhir, invoice baru ditolak. */
    public function test_trial_berakhir_menolak_invoice_baru(): void
    {
        $this->trialEnding(Carbon::today()->subDay());

        $this->postJson("/api/bookings/{$this->booking->id}/invoices", $this->invoicePayload())
            ->assertStatus(422)
            ->assertJsonPath('code', SubscriptionStatus::CODE_EXPIRED);
    }

    /** Setelah tanggal berakhir, booking baru juga ditolak. */
    public function test_trial_berakhir_menolak_booking_baru(): void
    {
        $this->trialEnding(Carbon::today()->subDay());

        $this->postJson('/api/bookings', [
            'client' => ['name' => 'Klien Baru', 'phone' => '6281200001111'],
            'event_date' => '2027-01-10',
            'event_time' => '10:00',
            'status' => 'tentative',
            'total_price' => 5000000,
        ])->assertStatus(422)->assertJsonPath('code', SubscriptionStatus::CODE_EXPIRED);
    }

    /**
     * Trial yang habis tidak mendapat masa tenggang — beda dengan langganan
     * berbayar. Kalau diberi, total masa gratis jadi 37 hari.
     */
    public function test_trial_berakhir_tidak_mendapat_masa_tenggang(): void
    {
        $statuses = app(SubscriptionStatus::class);

        $this->trialEnding(Carbon::today()->subDay());

        $resolved = $statuses->resolve($this->vendor);

        $this->assertSame(SubscriptionStatus::EXPIRED, $resolved['status']);
        $this->assertNull($resolved['graceEndsAt']);
        $this->assertFalse($resolved['canCreateBooking']);
    }

    /** Trial yang masih berjalan dilaporkan sebagai `trial` beserta tanggalnya. */
    public function test_trial_aktif_melaporkan_tanggal_berakhir(): void
    {
        $endsAt = Carbon::today()->addDays(12);

        $this->trialEnding($endsAt);

        $resolved = app(SubscriptionStatus::class)->resolve($this->vendor);

        $this->assertSame(SubscriptionStatus::TRIAL, $resolved['status']);
        $this->assertSame($endsAt->toDateString(), $resolved['endsAt']);
        $this->assertTrue($resolved['canCreateBooking']);
    }

    /**
     * Baris trial lama tanpa `ends_at` (dibuat sebelum aturan waktu berlaku)
     * tetap dianggap trial tanpa batas supaya data lama tidak langsung terkunci.
     */
    public function test_trial_lama_tanpa_tanggal_berakhir_tetap_diizinkan(): void
    {
        $this->trialEnding(null);

        $resolved = app(SubscriptionStatus::class)->resolve($this->vendor);

        $this->assertSame(SubscriptionStatus::TRIAL, $resolved['status']);
        $this->assertTrue($resolved['canCreateBooking']);
    }
}
