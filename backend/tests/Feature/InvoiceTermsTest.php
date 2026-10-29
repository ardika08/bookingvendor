<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Tests\TestCase;

/**
 * Uji kontrak yang dibagi menjadi beberapa tagihan (istilah vendor: "term").
 *
 * Aplikasi tidak menyimpan konsep term: satu tagihan = satu invoice, dan
 * nominalnya bebas selama totalnya tidak melewati nilai kontrak. Berkas ini
 * mengunci batas itu di **kedua** jalur — penerbitan (`store`) dan pengeditan
 * (`update`) — karena batas yang hanya dijaga di satu jalur membuat sisa
 * kontrak bisa dilampaui lewat jalur lainnya.
 */
class InvoiceTermsTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;

    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();

        // Tabel subscriptions dibuat bila belum ada (sama pola dengan
        // InvoiceTrialQuotaTest) supaya middleware `invoice.trial` bisa
        // memeriksa langganan vendor.
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
            'name' => 'Vendor Term',
            'email' => 'term@example.test',
            'password' => 'password',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-term',
            'bank_name' => 'BCA',
            'bank_account_number' => '1234567890',
            'bank_account_name' => 'Lumen Wedding Story',
        ]);

        $client = Client::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Klien Term',
            'phone' => '6281200001111',
        ]);

        // Langganan aktif — tidak dibatasi kuota trial.
        DB::table('subscriptions')->insert([
            'vendor_id' => $this->vendor->id,
            'status' => 'active',
            'trial_bookings_used' => 0,
            'trial_invoices_used' => 0,
            'amount_paid' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->loginAsVendorOf($this->vendor);

        $this->booking = Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $client->id,
            'event_date' => '2027-06-12',
            'status' => 'confirmed',
            'total_price' => 200000000,
        ]);
    }

    /** Terbitkan invoice; mengembalikan modelnya. */
    private function issue(string $type, float $amount): Invoice
    {
        $response = $this->postJson("/api/bookings/{$this->booking->id}/invoices", [
            'type' => $type,
            'amount' => $amount,
            'issued_at' => '2026-10-29',
            'due_at' => '2026-11-29',
        ]);

        $response->assertCreated();

        // Resource dikirim langsung (tanpa pembungkus `data`).
        return Invoice::findOrFail($response->json('id'));
    }

    public function test_kontrak_bisa_dibagi_tiga_tagihan_sampai_habis(): void
    {
        $this->issue('dp', 60000000);
        $this->issue('pelunasan', 70000000);
        $this->issue('pelunasan', 70000000);

        $billed = (float) Invoice::where('booking_id', $this->booking->id)
            ->where('status', '!=', Invoice::STATUS_CANCELLED)
            ->sum('amount');

        $this->assertSame(200000000.0, $billed);
    }

    public function test_tagihan_melebihi_sisa_kontrak_ditolak(): void
    {
        $this->issue('dp', 60000000);

        $this->postJson("/api/bookings/{$this->booking->id}/invoices", [
            'type' => 'pelunasan',
            'amount' => 200000000, // sisa hanya 140jt
            'issued_at' => '2026-10-29',
            'due_at' => '2026-11-29',
        ])->assertStatus(422)->assertJsonValidationErrors('amount');
    }

    public function test_kontrak_yang_sudah_habis_ditagih_tidak_bisa_ditagih_lagi(): void
    {
        $this->issue('full', 200000000);

        $this->postJson("/api/bookings/{$this->booking->id}/invoices", [
            'type' => 'pelunasan',
            'amount' => 1,
            'issued_at' => '2026-10-29',
            'due_at' => '2026-11-29',
        ])->assertStatus(422)->assertJsonValidationErrors('amount');
    }

    public function test_nominal_invoice_bisa_diubah_selama_masih_dalam_sisa_kontrak(): void
    {
        $term1 = $this->issue('dp', 60000000);
        $term2 = $this->issue('pelunasan', 70000000);

        // Term 2 naik dari 70jt ke 90jt, sisa kontrak masih 140jt dikurangi 90jt.
        $this->patchJson("/api/invoices/{$term2->id}", ['amount' => 90000000])
            ->assertOk();

        $this->assertSame(90000000.0, (float) $term2->fresh()->amount);
        $this->assertSame(60000000.0, (float) $term1->fresh()->amount);
    }

    public function test_mengubah_nominal_melebihi_sisa_kontrak_ditolak(): void
    {
        $this->issue('dp', 60000000);
        $term2 = $this->issue('pelunasan', 70000000);

        /*
         * Total yang sudah ditagih 130jt. Menaikkan term 2 ke 150jt membuat
         * totalnya 210jt — melewati kontrak 200jt, jadi harus ditolak.
         */
        $this->patchJson("/api/invoices/{$term2->id}", ['amount' => 150000000])
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');

        $this->assertSame(70000000.0, (float) $term2->fresh()->amount);
    }

    public function test_menurunkan_nominal_invoice_yang_sudah_dibayar_sebagian_ditolak(): void
    {
        $term1 = $this->issue('pelunasan', 70000000);

        $this->postJson("/api/invoices/{$term1->id}/payments", [
            'amount' => 30000000,
            'paid_at' => '2026-10-29',
            'method' => 'transfer',
        ])->assertCreated();

        $this->patchJson("/api/invoices/{$term1->id}", ['amount' => 20000000])
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');
    }

    public function test_menerbitkan_ulang_setelah_invoice_dibatalkan_mengembalikan_sisa_kontrak(): void
    {
        $term1 = $this->issue('dp', 60000000);

        $this->deleteJson("/api/invoices/{$term1->id}")->assertOk();

        // Sisa kontrak kembali penuh karena invoice batal tidak dihitung.
        $this->issue('full', 200000000);
    }

    public function test_label_term_menunjukkan_urutan_dan_total_tagihan(): void
    {
        $term1 = $this->issue('dp', 60000000);
        $term2 = $this->issue('pelunasan', 70000000);
        $term3 = $this->issue('pelunasan', 70000000);

        $this->getJson("/api/invoices/{$term1->id}")
            ->assertOk()
            ->assertJsonPath('term.term', 1)
            ->assertJsonPath('term.total', 3);

        $this->getJson("/api/invoices/{$term2->id}")
            ->assertOk()
            ->assertJsonPath('term.term', 2)
            ->assertJsonPath('term.total', 3);

        $this->getJson("/api/invoices/{$term3->id}")
            ->assertOk()
            ->assertJsonPath('term.term', 3)
            ->assertJsonPath('term.total', 3);
    }

    public function test_label_term_tidak_bergeser_saat_invoice_lain_dibatalkan(): void
    {
        $term1 = $this->issue('dp', 60000000);
        $term2 = $this->issue('pelunasan', 70000000);
        $term3 = $this->issue('pelunasan', 70000000);

        // Batalkan term 2 — term 3 harus tetap "term 3", bukan menjadi "term 2".
        $this->deleteJson("/api/invoices/{$term2->id}")->assertOk();

        $this->getJson("/api/invoices/{$term3->id}")
            ->assertOk()
            ->assertJsonPath('term.term', 3)
            ->assertJsonPath('term.total', 3);
    }

    public function test_label_term_tampil_di_halaman_publik_klien(): void
    {
        $this->issue('pelunasan', 70000000);
        $term2 = $this->issue('pelunasan', 70000000);

        $this->getJson("/api/public/invoices/{$term2->public_token}")
            ->assertOk()
            ->assertJsonPath('term.term', 2)
            ->assertJsonPath('term.total', 2);
    }
}
