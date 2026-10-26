<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Uji middleware pembatas invoice masa trial.
 *
 * Tabel `subscriptions` belum masuk skema resmi (fitur langganan menyusul),
 * jadi dibuat di sini hanya untuk menguji penegakan kuota. Begitu tabel asli
 * tersedia, middleware otomatis aktif tanpa perubahan kode.
 */
class InvoiceTrialQuotaTest extends TestCase
{
    use RefreshDatabase;

    private Booking $booking;
    private Vendor $vendor;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Schema::hasTable('subscriptions')) {
            Schema::create('subscriptions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
                $table->foreignId('plan_id')->nullable();
                $table->enum('status', ['trial', 'active', 'expired', 'cancelled'])->default('trial');
                $table->date('starts_at')->nullable();
                $table->date('ends_at')->nullable();
                $table->unsignedInteger('trial_bookings_used')->default(0);
                $table->unsignedInteger('trial_invoices_used')->default(0);
                $table->decimal('amount_paid', 15, 2)->default(0);
                $table->foreignId('activated_by')->nullable();
                $table->timestamps();
            });
        }

        $user = User::create([
            'name' => 'Vendor Uji',
            'email' => 'vendor@example.test',
            'password' => 'password',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
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
            'total_price' => 15000000,
        ]);
    
        $this->loginAsVendorOf($this->vendor);
    }

    private function subscribe(string $status, int $invoicesUsed): void
    {
        DB::table('subscriptions')->insert([
            'vendor_id' => $this->vendor->id,
            'status' => $status,
            'trial_bookings_used' => 0,
            'trial_invoices_used' => $invoicesUsed,
            'amount_paid' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function invoicePayload(): array
    {
        return [
            'type' => 'dp',
            'amount' => 1000000,
            'issued_at' => '2026-10-23',
            'due_at' => '2026-10-30',
        ];
    }

    public function test_trial_dengan_jatah_tersisa_boleh_membuat_invoice(): void
    {
        $this->subscribe('trial', 1);

        $this->postJson("/api/bookings/{$this->booking->id}/invoices", $this->invoicePayload())
            ->assertCreated();

        $this->assertSame(
            2,
            (int) DB::table('subscriptions')->where('vendor_id', $this->vendor->id)->value('trial_invoices_used'),
        );
    }

    public function test_trial_yang_jatahnya_habis_ditolak_dengan_kode(): void
    {
        $this->subscribe('trial', 2);

        $this->postJson("/api/bookings/{$this->booking->id}/invoices", $this->invoicePayload())
            ->assertStatus(422)
            ->assertJsonPath('code', 'trial_limit_reached')
            ->assertJsonPath('message', 'Jatah trial invoice sudah habis. Berlangganan untuk membuat invoice tanpa batas.');

        $this->assertDatabaseCount('invoices', 0);
    }

    public function test_middleware_hanya_memblokir_pembuatan_invoice(): void
    {
        $this->subscribe('trial', 2);

        // Daftar invoice tetap bisa dibaca meski jatah habis.
        $this->getJson("/api/bookings/{$this->booking->id}/invoices")
            ->assertOk()
            ->assertJsonCount(0);
    }

    public function test_langganan_aktif_tanpa_batas(): void
    {
        $this->subscribe('active', 99);

        $this->postJson("/api/bookings/{$this->booking->id}/invoices", $this->invoicePayload())
            ->assertCreated();

        // Penghitung trial tidak disentuh setelah berlangganan.
        $this->assertSame(
            99,
            (int) DB::table('subscriptions')->where('vendor_id', $this->vendor->id)->value('trial_invoices_used'),
        );
    }

    public function test_invoice_trial_yang_dibatalkan_tetap_menghabiskan_jatah(): void
    {
        $this->subscribe('trial', 1);

        $response = $this->postJson("/api/bookings/{$this->booking->id}/invoices", $this->invoicePayload())
            ->assertCreated();

        $invoiceId = $response->json('id');
        $this->deleteJson("/api/invoices/{$invoiceId}")->assertOk();

        $this->assertSame(
            2,
            (int) DB::table('subscriptions')->where('vendor_id', $this->vendor->id)->value('trial_invoices_used'),
        );
        $this->assertSame(Invoice::STATUS_CANCELLED, Invoice::find($invoiceId)->status);
    }
}
