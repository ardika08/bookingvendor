<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Models\Vendor;
use App\Services\SubscriptionStatus;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Uji validasi status langganan: trial, aktif, masa tenggang, dan kedaluwarsa,
 * termasuk dampaknya terhadap pembuatan invoice.
 */
class SubscriptionStatusTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;
    private Booking $booking;
    private SubscriptionStatus $statuses;

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

        $this->statuses = new SubscriptionStatus();

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

    private function subscribe(string $status, ?string $endsAt = null, int $invoicesUsed = 0): void
    {
        DB::table('subscriptions')->insert([
            'vendor_id' => $this->vendor->id,
            'status' => $status,
            'starts_at' => null,
            'ends_at' => $endsAt,
            'trial_bookings_used' => 0,
            'trial_invoices_used' => $invoicesUsed,
            'amount_paid' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_trial_boleh_membuat_invoice(): void
    {
        $this->subscribe('trial');

        $result = $this->statuses->resolve($this->vendor);

        $this->assertSame('trial', $result['status']);
        $this->assertTrue($result['canCreateInvoice']);
        $this->assertNull($result['code']);
    }

    public function test_langganan_aktif_dalam_masa_berlaku(): void
    {
        $this->subscribe('active', '2026-12-31');

        $result = $this->statuses->resolve($this->vendor, Carbon::parse('2026-10-23'));

        $this->assertSame('active', $result['status']);
        $this->assertSame('2026-12-31', $result['endsAt']);
        $this->assertTrue($result['canCreateInvoice']);
    }

    public function test_langganan_aktif_tanpa_tanggal_berakhir_dianggap_aktif(): void
    {
        $this->subscribe('active', null);

        $this->assertSame('active', $this->statuses->resolve($this->vendor)['status']);
    }

    public function test_masuk_masa_tenggang_setelah_tanggal_berakhir(): void
    {
        $this->subscribe('active', '2026-10-20');

        // ends_at 20 Okt + 7 hari tenggang → masih grace pada 25 Okt.
        $result = $this->statuses->resolve($this->vendor, Carbon::parse('2026-10-25'));

        $this->assertSame('grace', $result['status']);
        $this->assertSame('2026-10-27', $result['graceEndsAt']);
        $this->assertTrue($result['canCreateInvoice']);
        $this->assertTrue($this->statuses->isInGrace($this->vendor, Carbon::parse('2026-10-25')));
    }

    public function test_hari_terakhir_masa_tenggang_masih_boleh(): void
    {
        $this->subscribe('active', '2026-10-20');

        $result = $this->statuses->resolve($this->vendor, Carbon::parse('2026-10-27'));

        $this->assertSame('grace', $result['status']);
        $this->assertTrue($result['canCreateInvoice']);
    }

    public function test_lewat_masa_tenggang_menjadi_expired(): void
    {
        $this->subscribe('active', '2026-10-20');

        $result = $this->statuses->resolve($this->vendor, Carbon::parse('2026-10-28'));

        $this->assertSame('expired', $result['status']);
        $this->assertFalse($result['canCreateInvoice']);
        $this->assertSame(SubscriptionStatus::CODE_EXPIRED, $result['code']);
        $this->assertTrue($this->statuses->isExpired($this->vendor, Carbon::parse('2026-10-28')));
    }

    public function test_status_cancelled_dianggap_expired(): void
    {
        $this->subscribe('cancelled', '2026-12-31');

        $result = $this->statuses->resolve($this->vendor);

        $this->assertSame('expired', $result['status']);
        $this->assertFalse($result['canCreateInvoice']);
    }

    public function test_tanpa_baris_langganan_dianggap_trial(): void
    {
        $result = $this->statuses->resolve($this->vendor);

        $this->assertSame('trial', $result['status']);
        $this->assertTrue($result['canCreateInvoice']);
    }

    public function test_label_status_untuk_ui(): void
    {
        $this->assertSame('Langganan aktif', $this->statuses->label('active'));
        $this->assertSame('Masa tenggang', $this->statuses->label('grace'));
        $this->assertSame('Langganan berakhir', $this->statuses->label('expired'));
        $this->assertSame('Masa trial', $this->statuses->label('trial'));
    }

    public function test_middleware_menolak_invoice_saat_langganan_kedaluwarsa(): void
    {
        $this->subscribe('expired', '2026-01-01');

        $this->postJson("/api/bookings/{$this->booking->id}/invoices", [
            'type' => 'dp',
            'amount' => 1000000,
            'issued_at' => '2026-10-23',
            'due_at' => '2026-10-30',
        ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'subscription_expired');

        $this->assertDatabaseCount('invoices', 0);
    }

    public function test_middleware_mengizinkan_invoice_dalam_masa_tenggang(): void
    {
        $this->subscribe('active', now()->subDays(3)->toDateString());

        $this->postJson("/api/bookings/{$this->booking->id}/invoices", [
            'type' => 'dp',
            'amount' => 1000000,
            'issued_at' => now()->toDateString(),
            'due_at' => now()->addDays(7)->toDateString(),
        ])->assertCreated();

        $this->assertSame(Invoice::STATUS_UNPAID, Invoice::first()->status);
    }
}
