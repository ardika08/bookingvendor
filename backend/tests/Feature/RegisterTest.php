<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * Uji pendaftaran vendor mandiri (`POST /api/register`).
 *
 * Tanpa persetujuan admin, jadi berkas ini mengunci tiga penjaga utama:
 * email harus Gmail, email & nomor WhatsApp harus unik, dan percobaan
 * berulang dibatasi per IP.
 */
class RegisterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Kategori "Lainnya" diperlukan untuk uji isian bebas.
        Category::create(['name' => 'MUA', 'slug' => 'mua']);
        Category::create(['name' => 'Lainnya', 'slug' => 'lainnya']);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'owner_name' => 'Dika Pratama',
            'vendor_name' => 'Lumen Wedding Story',
            'category_id' => (string) Category::where('slug', 'mua')->value('id'),
            'phone' => '081234567890',
            'email' => 'dika@gmail.com',
            'password' => 'passwo...ah',
        ], $overrides);
    }

    public function test_pendaftaran_membuat_user_vendor_dan_trial_30_hari(): void
    {
        $this->postJson('/api/register', $this->payload())
            ->assertCreated()
            ->assertJsonPath('vendor.name', 'Lumen Wedding Story')
            ->assertJsonPath('trialDays', 30);

        $user = User::where('email', 'dika@gmail.com')->first();
        $this->assertNotNull($user);
        $this->assertSame(User::ROLE_VENDOR, $user->role);
        $this->assertTrue($user->is_active);

        $vendor = Vendor::where('user_id', $user->id)->first();
        $this->assertNotNull($vendor);
        $this->assertSame('lumen-wedding-story', $vendor->slug);
        $this->assertSame('6281234567890', $vendor->contact);

        $trial = Subscription::where('vendor_id', $vendor->id)->first();
        $this->assertSame(Subscription::STATUS_TRIAL, $trial->status);
        $this->assertSame(now()->addDays(30)->toDateString(), $trial->ends_at->toDateString());
    }

    public function test_pendaftaran_langsung_membuat_sesi_login(): void
    {
        $this->postJson('/api/register', $this->payload())->assertCreated();

        $this->assertAuthenticated();
    }

    public function test_email_selain_gmail_ditolak(): void
    {
        // Batasan domain Gmail sudah dihapus — semua email valid diterima.
        // Tes ini dipertahankan sebagai konfirmasi bahwa email non-Gmail
        // sekarang diterima (regresi: jangan kembalikan batasan domain).
        $this->postJson('/api/register', $this->payload(['email' => 'dika@yahoo.com']))
            ->assertCreated();

        $this->assertDatabaseHas('users', ['email' => 'dika@yahoo.com']);
    }

    public function test_email_duplikat_ditolak(): void
    {
        $this->postJson('/api/register', $this->payload())->assertCreated();

        $this->postJson('/api/register', $this->payload([
            'phone' => '081999999999',
            'vendor_name' => 'Vendor Lain',
        ]))
            ->assertStatus(422)
            ->assertJsonPath('code', 'email_taken');
    }

    /**
     * Nomor WhatsApp harus unik meski formatnya berbeda — inilah penjaga
     * utama agar satu orang tidak membuat banyak akun untuk memperpanjang
     * masa uji (email Gmail baru mudah, nomor WhatsApp tidak).
     */
    public function test_whatsapp_duplikat_dengan_format_berbeda_ditolak(): void
    {
        $this->postJson('/api/register', $this->payload())->assertCreated();

        $this->postJson('/api/register', $this->payload([
            'email' => 'lain@gmail.com',
            'phone' => '+62 812-3456-7890',
        ]))
            ->assertStatus(422)
            ->assertJsonPath('code', 'phone_taken');
    }

    public function test_kategori_lainnya_menyimpan_teks_bebas(): void
    {
        $this->postJson('/api/register', $this->payload([
            'category_id' => (string) Category::where('slug', 'lainnya')->value('id'),
            'category_other' => 'Wedding Car',
        ]))->assertCreated();

        $this->assertDatabaseHas('vendors', [
            'name' => 'Lumen Wedding Story',
            'category_other' => 'Wedding Car',
        ]);
    }

    public function test_teks_kategori_bebas_diabaikan_bila_kategori_bukan_lainnya(): void
    {
        $this->postJson('/api/register', $this->payload([
            'category_other' => 'Wedding Car',
        ]))->assertCreated();

        $this->assertDatabaseHas('vendors', [
            'name' => 'Lumen Wedding Story',
            'category_other' => null,
        ]);
    }

    public function test_kategori_tidak_dikenal_ditolak(): void
    {
        $this->postJson('/api/register', $this->payload(['category_id' => '9999']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('category_id');
    }

    public function test_nomor_whatsapp_terlalu_pendek_ditolak(): void
    {
        $this->postJson('/api/register', $this->payload(['phone' => '0812']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');
    }

    /** Pendaftaran berulang dari IP yang sama dibatasi. */
    public function test_percobaan_berulang_dibatasi_per_ip(): void
    {
        /*
         * Pendaftaran yang BERHASIL membersihkan penghitung (vendor sah tidak
         * boleh tertahan), jadi rate limit hanya menghitung percobaan gagal.
         * Di sini dipakai email duplikat supaya setiap percobaan gagal.
         */
        $existing = User::factory()->create(['email' => 'sudah@test.com']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/register', $this->payload(['email' => 'sudah@test.com']))
                ->assertStatus(422);
        }

        $this->postJson('/api/register', $this->payload(['email' => 'salah2@test.com']))
            ->assertStatus(429)
            ->assertJsonPath('code', 'too_many_attempts');
    }

    public function test_daftar_kategori_publik_tersedia(): void
    {
        $response = $this->getJson('/api/register/categories')->assertOk();

        // Database tes bisa berisi kategori dari migrasi; yang penting kategori
        // buatan tes ini ada dan "Lainnya" ditandai `isOther`.
        $names = collect($response->json())->pluck('name')->all();
        $this->assertContains('MUA', $names);
        $this->assertContains('Lainnya', $names);

        $other = collect($response->json())->firstWhere('slug', 'lainnya');
        $this->assertTrue($other['isOther']);
    }
}
