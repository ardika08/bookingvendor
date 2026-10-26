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
 * Link publik invoice.
 *
 * Token pada URL adalah satu-satunya kunci akses, sehingga test di sini fokus
 * pada siklus hidupnya: pembuatan bersifat idempoten, reset mematikan token
 * lama, dan nonaktifkan membuat halaman publik menjawab 404.
 */
class InvoiceShareLinkTest extends TestCase
{
    use RefreshDatabase;

    public function test_membuat_link_menghasilkan_token_acak(): void
    {
        [$invoice] = $this->invoice();

        $token = $this->postJson('/api/invoices/'.$invoice->id.'/share-link')
            ->assertOk()
            ->assertJsonPath('active', true)
            ->json('token');

        $this->assertIsString($token);
        // Token acak, bukan ID berurutan — kalau bisa ditebak, invoice orang
        // lain bisa dibuka.
        $this->assertGreaterThanOrEqual(32, strlen($token));
        $this->assertNotSame((string) $invoice->id, $token);

        $this->assertSame($token, $invoice->refresh()->public_token);
    }

    public function test_membuat_link_dua_kali_tidak_mengganti_token(): void
    {
        [$invoice] = $this->invoice();

        $pertama = $this->postJson('/api/invoices/'.$invoice->id.'/share-link')->json('token');
        $kedua = $this->postJson('/api/invoices/'.$invoice->id.'/share-link')->json('token');

        // Tautan yang sudah dikirim ke klien tidak boleh mendadak mati.
        $this->assertSame($pertama, $kedua);
    }

    public function test_reset_mematikan_token_lama(): void
    {
        [$invoice] = $this->invoice();

        $lama = $this->postJson('/api/invoices/'.$invoice->id.'/share-link')->json('token');

        // Halaman publik hidup dengan token lama.
        $this->getJson('/api/public/invoices/'.$lama)->assertOk();

        $baru = $this->postJson('/api/invoices/'.$invoice->id.'/share-link/reset')
            ->assertOk()
            ->json('token');

        $this->assertNotSame($lama, $baru);

        // Token lama WAJIB mati — inilah alasan reset ada.
        $this->getJson('/api/public/invoices/'.$lama)->assertNotFound();
        $this->getJson('/api/public/invoices/'.$baru)->assertOk();
    }

    public function test_nonaktifkan_membuat_halaman_publik_404(): void
    {
        [$invoice] = $this->invoice();

        $token = $this->postJson('/api/invoices/'.$invoice->id.'/share-link')->json('token');

        $this->deleteJson('/api/invoices/'.$invoice->id.'/share-link')
            ->assertOk()
            ->assertJsonPath('active', false);

        $this->getJson('/api/public/invoices/'.$token)->assertNotFound();

        // Invoice tetap ada; hanya tautannya yang dimatikan.
        $this->assertNotNull($invoice->refresh());
    }

    public function test_reset_tanpa_link_aktif_dibalas_404(): void
    {
        [$invoice] = $this->invoice();

        // Invoice yang belum pernah punya token sama sekali.
        $invoice->forceFill(['public_token' => ''])->save();

        $this->postJson('/api/invoices/'.$invoice->id.'/share-link/reset')
            ->assertNotFound()
            ->assertJsonPath('code', 'share_link_missing');
    }

    public function test_status_link_tidak_membuat_token(): void
    {
        [$invoice] = $this->invoice();

        $this->getJson('/api/invoices/'.$invoice->id.'/share-link')
            ->assertOk()
            ->assertJsonPath('active', false)
            ->assertJsonPath('token', null);

        // Membuka halaman detail tidak boleh diam-diam mengaktifkan tautan.
        $this->assertSame(false, (bool) $invoice->refresh()->link_active);
    }

    public function test_invoice_vendor_lain_tidak_bisa_diakses(): void
    {
        [$invoice] = $this->invoice();

        $lain = User::query()->create([
            'name' => 'Vendor Lain', 'email' => 'lain3@example.com', 'role' => User::ROLE_VENDOR,
        ]);
        $vendorLain = Vendor::query()->create([
            'user_id' => $lain->id, 'name' => 'Vendor Lain', 'slug' => 'vendor-lain-3',
        ]);

        $this->loginAs($lain->fresh());

        // 404, bukan 403 — tidak membocorkan keberadaan invoice.
        $this->postJson('/api/invoices/'.$invoice->id.'/share-link')->assertNotFound();
        $this->getJson('/api/invoices/'.$invoice->id.'/share-link')->assertNotFound();
        $this->deleteJson('/api/invoices/'.$invoice->id.'/share-link')->assertNotFound();
    }

    public function test_tanpa_login_ditolak(): void
    {
        [$invoice] = $this->invoice();
        $this->loginAs(null);

        $this->postJson('/api/invoices/'.$invoice->id.'/share-link')->assertUnauthorized();
    }

    // -----------------------------------------------------------------------

    /**
     * @return array{0: Invoice}
     */
    private function invoice(): array
    {
        $user = User::query()->create([
            'name' => 'Vendor Uji', 'email' => 'vendor-share@example.com', 'role' => User::ROLE_VENDOR,
        ]);

        $vendor = Vendor::query()->create([
            'user_id' => $user->id, 'name' => 'Lumen Wedding Story', 'slug' => 'lumen-share',
        ]);

        $client = Client::query()->create([
            'vendor_id' => $vendor->id, 'name' => 'Rani', 'phone' => '081211112222',
        ]);

        $booking = Booking::query()->create([
            'vendor_id' => $vendor->id,
            'client_id' => $client->id,
            'event_date' => '2027-08-08',
            'event_location' => 'Bandung',
            'status' => Booking::STATUS_CONFIRMED,
            'total_price' => 10000000,
        ]);

        $invoice = Invoice::query()->create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-2027-0001',
            'type' => 'dp',
            'amount' => 5000000,
            'status' => 'unpaid',
            'issued_at' => now()->toDateString(),
            'due_date' => now()->addDays(7)->toDateString(),
            'public_token' => 'token-awal-'.$vendor->id,
            'link_active' => false,
        ]);

        $this->loginAs($user->fresh());

        return [$invoice];
    }
}
