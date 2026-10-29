<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Client;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Uji onboarding vendor: status kelengkapan, penyimpanan per langkah, dan
 * penegakan rekening saat menerbitkan invoice.
 *
 * Fokus utama bukan bentuk respons, melainkan tiga jaminan:
 * 1. rekening adalah satu-satunya langkah wajib;
 * 2. PATCH dari onboarding tidak menghapus data langkah lain (PUT tetap menimpa);
 * 3. invoice tidak bisa terbit tanpa rekening, tetapi booking tetap bisa dibuat.
 */
class OnboardingTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Dika Pratama',
            'email' => 'dika@example.test',
            'password' => 'password',
        ]);

        // Sengaja tanpa rekening: kondisi vendor baru yang belum onboarding.
        $this->vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
            'location' => 'Jakarta Selatan',
            'contact' => '081290001122',
        ]);

        $this->loginAsVendorOf($this->vendor);
    }

    /** Rekening lengkap untuk dipakai di beberapa test. */
    private function bankPayload(): array
    {
        return [
            'name' => 'BCA',
            'account_number' => '1234567890',
            'account_holder' => 'Lumen Wedding Story',
        ];
    }

    private function fillBank(): void
    {
        $this->vendor->forceFill([
            'bank_name' => 'BCA',
            'bank_account_number' => '1234567890',
            'bank_account_name' => 'Lumen Wedding Story',
        ])->save();
    }

    // -----------------------------------------------------------------
    // Status
    // -----------------------------------------------------------------

    public function test_status_menandai_rekening_sebagai_satu_satunya_langkah_wajib(): void
    {
        $response = $this->getJson('/api/vendor/onboarding')->assertOk();

        $response->assertJsonPath('complete', false)
            ->assertJsonPath('blockingStep', 'bank')
            /*
             * `nextStep` = langkah pertama yang belum lengkap menurut urutan
             * (usaha → kontak → rekening). Kontak sudah lengkap karena nomor WA
             * terisi; email sengaja tidak dihitung sebagai syarat.
             */
            ->assertJsonPath('nextStep', 'bank');

        $steps = collect($response->json('steps'))->keyBy('key');

        $this->assertTrue($steps['business']['complete'], 'Nama & kota sudah terisi.');
        $this->assertFalse($steps['business']['required']);
        $this->assertTrue($steps['contact']['complete'], 'Kontak sudah terisi.');
        $this->assertFalse($steps['contact']['required']);
        $this->assertFalse($steps['bank']['complete']);
        $this->assertTrue($steps['bank']['required']);
        $this->assertSame(
            ['bank_name', 'bank_account_number', 'bank_account_name'],
            $steps['bank']['missing'],
        );
    }

    public function test_status_selesai_setelah_rekening_lengkap(): void
    {
        $this->fillBank();

        $this->getJson('/api/vendor/onboarding')
            ->assertOk()
            ->assertJsonPath('complete', true)
            ->assertJsonPath('blockingStep', null)
            ->assertJsonPath('nextStep', null);
    }

    public function test_rekening_setengah_jadi_tetap_dianggap_belum_lengkap(): void
    {
        // Hanya nama bank terisi: kolom lain kosong.
        $this->vendor->forceFill(['bank_name' => 'BCA'])->save();

        $this->getJson('/api/vendor/onboarding')
            ->assertOk()
            ->assertJsonPath('complete', false)
            ->assertJsonPath('blockingStep', 'bank');
    }

    public function test_status_butuh_login(): void
    {
        $this->loginAs(null);

        $this->getJson('/api/vendor/onboarding')->assertUnauthorized();
    }

    // -----------------------------------------------------------------
    // Simpan per langkah
    // -----------------------------------------------------------------

    public function test_patch_rekening_tidak_menghapus_data_langkah_lain(): void
    {
        // Vendor sudah punya deskripsi & email dari langkah sebelumnya.
        $this->vendor->forceFill([
            'description' => 'Wedding organizer berbasis Jakarta.',
            'contact_email' => 'hello@lumenwedding.id',
        ])->save();

        // Langkah rekening hanya mengirim field rekening.
        $this->patchJson('/api/vendor/profile', ['bank' => $this->bankPayload()])
            ->assertOk()
            ->assertJsonPath('bank.name', 'BCA');

        $this->vendor->refresh();

        $this->assertSame('BCA', $this->vendor->bank_name);
        $this->assertSame(
            'Wedding organizer berbasis Jakarta.',
            $this->vendor->description,
            'PATCH tidak boleh menghapus deskripsi dari langkah sebelumnya.',
        );
        $this->assertSame('hello@lumenwedding.id', $this->vendor->contact_email);
        $this->assertSame('Lumen Wedding Story', $this->vendor->name);
        $this->assertSame('Jakarta Selatan', $this->vendor->location);
    }

    public function test_patch_hanya_mengubah_field_yang_dikirim(): void
    {
        $this->patchJson('/api/vendor/profile', ['city' => 'Bandung'])
            ->assertOk()
            ->assertJsonPath('city', 'Bandung');

        $this->vendor->refresh();

        $this->assertSame('Bandung', $this->vendor->location);
        $this->assertSame('Lumen Wedding Story', $this->vendor->name);
        $this->assertSame('081290001122', $this->vendor->contact);
    }

    public function test_put_tetap_menimpa_seluruh_profil(): void
    {
        $this->vendor->forceFill(['description' => 'Akan terhapus.'])->save();

        // PUT tanpa `description` berarti mengosongkannya — perilaku form lama.
        $this->putJson('/api/vendor/profile', [
            'business_name' => 'Lumen Wedding Story',
            'city' => 'Jakarta Selatan',
        ])->assertOk();

        $this->assertNull($this->vendor->refresh()->description);
    }

    public function test_patch_rekening_setengah_jadi_ditolak(): void
    {
        $this->patchJson('/api/vendor/profile', [
            'bank' => ['name' => 'BCA', 'account_number' => '', 'account_holder' => ''],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('bank.name');

        $this->assertNull($this->vendor->refresh()->bank_name);
    }

    public function test_patch_tanpa_business_name_tidak_kena_validasi_wajib(): void
    {
        // Kalau `business_name` tetap wajib di PATCH, langkah rekening tidak
        // akan pernah bisa disimpan.
        $this->patchJson('/api/vendor/profile', ['bank' => $this->bankPayload()])
            ->assertOk()
            ->assertJsonMissingValidationErrors('business_name');
    }

    // -----------------------------------------------------------------
    // Penegakan invoice
    // -----------------------------------------------------------------

    /** Booking milik vendor pada setUp, tanpa invoice. */
    private function makeBooking(): Booking
    {
        $client = Client::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'Nadia & Fajar',
            'phone' => '081298887766',
        ]);

        return Booking::create([
            'vendor_id' => $this->vendor->id,
            'client_id' => $client->id,
            'event_date' => now()->addMonth()->toDateString(),
            'status' => 'confirmed',
            'total_price' => 10000000,
        ]);
    }

    private function invoicePayload(): array
    {
        return [
            'type' => 'dp',
            'amount' => 4000000,
            'issued_at' => now()->toDateString(),
            'due_at' => now()->addWeek()->toDateString(),
        ];
    }

    public function test_invoice_ditolak_bila_rekening_belum_lengkap(): void
    {
        $booking = $this->makeBooking();

        $this->postJson("/api/bookings/{$booking->id}/invoices", $this->invoicePayload())
            ->assertStatus(422)
            ->assertJsonPath('code', 'onboarding_incomplete')
            ->assertJsonPath('step', 'bank');

        $this->assertSame(0, $booking->invoices()->count(), 'Invoice tidak boleh tersimpan.');
    }

    public function test_invoice_boleh_terbit_setelah_rekening_lengkap(): void
    {
        $this->fillBank();
        $booking = $this->makeBooking();

        $this->postJson("/api/bookings/{$booking->id}/invoices", $this->invoicePayload())
            ->assertCreated();

        $this->assertSame(1, $booking->invoices()->count());
    }

    public function test_booking_tetap_bisa_dibuat_tanpa_rekening(): void
    {
        // Rekening belum lengkap, tetapi vendor harus tetap bisa mencatat pesanan.
        $this->postJson('/api/bookings', [
            'client' => [
                'name' => 'Putri & Reza',
                'phone' => '081277665544',
            ],
            'event_date' => now()->addMonths(2)->toDateString(),
            'status' => 'tentative',
            'total_price' => 12000000,
        ])->assertCreated();

        $this->assertSame(1, Booking::query()->where('vendor_id', $this->vendor->id)->count());
    }

    public function test_menonaktifkan_rekening_kembali_memblokir_invoice(): void
    {
        $this->fillBank();
        $booking = $this->makeBooking();

        // Vendor mengosongkan rekening lewat form Pengaturan (PUT).
        $this->putJson('/api/vendor/profile', [
            'business_name' => 'Lumen Wedding Story',
            'bank' => ['name' => '', 'account_number' => '', 'account_holder' => ''],
        ])->assertOk();

        $this->postJson("/api/bookings/{$booking->id}/invoices", $this->invoicePayload())
            ->assertStatus(422)
            ->assertJsonPath('code', 'onboarding_incomplete');
    }

    public function test_invoice_vendor_lain_tetap_404(): void
    {
        $this->fillBank();

        $otherUser = User::create([
            'name' => 'Vendor Lain',
            'email' => 'lain@example.test',
            'password' => 'password',
        ]);

        $other = Vendor::create([
            'user_id' => $otherUser->id,
            'name' => 'Vendor Lain',
            'slug' => 'vendor-lain-'.Str::random(4),
        ]);

        $client = Client::create([
            'vendor_id' => $other->id,
            'name' => 'Klien Lain',
            'phone' => '081211112222',
        ]);

        $booking = Booking::create([
            'vendor_id' => $other->id,
            'client_id' => $client->id,
            'event_date' => now()->addMonth()->toDateString(),
            'status' => 'confirmed',
            'total_price' => 5000000,
        ]);

        // Middleware membaca vendor dari booking, bukan dari sesi, lalu
        // controller menolak karena booking bukan milik vendor yang login.
        $this->postJson("/api/bookings/{$booking->id}/invoices", $this->invoicePayload())
            ->assertNotFound();
    }
}
