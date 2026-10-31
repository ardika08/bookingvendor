<?php

namespace Tests\Feature;

use App\Mail\SubscriptionPaidMail;
use App\Mail\VendorWelcomeMail;
use App\Models\Category;
use App\Models\Plan;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Mailable sungguhan lewat transport API Mailketing.
 *
 * Tes transport (`MailketingTransportTest`) memakai `Email` buatan; berkas ini
 * memastikan template Blade aplikasi — yang penuh tabel dan inline style —
 * benar-benar sampai ke API sebagai HTML jadi, bukan MIME mentah yang akan
 * tampil sebagai teks aneh di kotak masuk vendor.
 *
 * Berkas ini juga menangkap bug nyata: `vendor-welcome.blade.php` memakai
 * `@if (...)@endif` yang menempel pada teks, dan Blade hanya mengompilasi
 * `@endif` tanpa `@if` — hasilnya "syntax error, unexpected token endif" dan
 * email selamat datang GAGAL terkirim. Tes ini mengunci agar tidak terulang.
 */
class MailketingMailableTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'mail.default' => 'mailketing',
            'mail.mailers.mailketing.token' => 'token-uji',
            'mail.mailers.mailketing.endpoint' => 'https://api.mailketing.test/api/v2/send',
            'mail.from.address' => 'info@vendorkit.my.id',
            'mail.from.name' => 'VendorKit',
        ]);

        Http::fake([
            'api.mailketing.test/*' => Http::response([
                'success' => true,
                'data' => ['message_id' => '<api.uji@vendorkit.my.id>'],
                'message' => 'Email queued successfully',
            ], 200),
        ]);
    }

    private function vendor(): Vendor
    {
        $category = Category::create(['name' => 'MUA', 'slug' => 'mua']);
        $user = User::factory()->create([
            'email' => 'vendor@test.com',
            'role' => User::ROLE_VENDOR,
            'is_active' => true,
        ]);

        return Vendor::create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
            'contact' => '6281234567890',
            'contact_email' => 'vendor@test.com',
            'is_active' => true,
        ]);
    }

    /** Email selamat datang: template tabel harus utuh sebagai HTML. */
    public function test_email_selamat_datang_terkirim_sebagai_html(): void
    {
        $vendor = $this->vendor();

        Mail::to('vendor@test.com')->send(new VendorWelcomeMail($vendor, 30, '2026-11-29'));

        Http::assertSent(function ($request) {
            $content = (string) ($request->data()['content'] ?? '');

            return str_contains($content, '<table')
                && str_contains($content, 'Lumen Wedding Story')
                && str_contains($content, '30')
                // Header MIME tidak boleh ikut terkirim.
                && ! str_contains($content, 'MIME-Version:')
                && ! str_contains($content, 'Content-Transfer-Encoding:');
        });
    }

    /**
     * Tanggal berakhir masa uji ikut tampil bila ada.
     *
     * Ini bagian yang dulu rusak: `@if` menempel teks sehingga hanya `@endif`
     * yang dikompilasi, dan seluruh email gagal dirender.
     */
    public function test_tanggal_berakhir_muncul_bila_ada(): void
    {
        $vendor = $this->vendor();

        Mail::to('vendor@test.com')->send(new VendorWelcomeMail($vendor, 30, '2026-11-29'));

        Http::assertSent(function ($request) {
            $content = (string) ($request->data()['content'] ?? '');

            return str_contains($content, '29 November 2026');
        });
    }

    /** Tanpa tanggal berakhir, email tetap terkirim tanpa menyisakan koma liar. */
    public function test_tanpa_tanggal_berakhir_tetap_terkirim(): void
    {
        $vendor = $this->vendor();

        Mail::to('vendor@test.com')->send(new VendorWelcomeMail($vendor, 30, null));

        Http::assertSent(function ($request) {
            $content = (string) ($request->data()['content'] ?? '');

            return str_contains($content, '30')
                && ! str_contains($content, ', sampai')
                && str_contains($content, 'Tanpa kartu kredit');
        });
    }

    /** Tanda terima langganan: nominal & referensi harus muncul. */
    public function test_email_tanda_terima_langganan_terkirim_sebagai_html(): void
    {
        $vendor = $this->vendor();

        $plan = Plan::create([
            'code' => 'monthly',
            'name' => 'Bulanan',
            'duration_months' => 1,
            'price' => 50000,
            'is_active' => true,
        ]);

        $payment = SubscriptionPayment::create([
            'vendor_id' => $vendor->id,
            'plan_id' => $plan->id,
            'order_id' => 'SUB-UJI-1',
            'gateway' => 'duitku',
            'amount' => 50000,
            'status' => 'paid',
        ]);

        Mail::to('vendor@test.com')->send(new SubscriptionPaidMail($payment, $vendor->name, '2026-11-29'));

        Http::assertSent(function ($request) {
            $content = (string) ($request->data()['content'] ?? '');

            return str_contains($content, '<table')
                && str_contains($content, 'Bulanan')
                && str_contains($content, '50.000')
                && ! str_contains($content, 'MIME-Version:');
        });
    }

    /** Subjek dari Mailable benar-benar diteruskan ke API. */
    public function test_subjek_dari_mailable_diteruskan(): void
    {
        $vendor = $this->vendor();

        Mail::to('vendor@test.com')->send(new VendorWelcomeMail($vendor, 30, null));

        Http::assertSent(function ($request) {
            $subject = (string) ($request->data()['subject'] ?? '');

            /*
             * Subjek memuat nama vendor dan durasi uji, tanpa em dash dan tanpa
             * emoji — em dash terpotong di layar ponsel, emoji menaikkan
             * peluang masuk folder Promosi.
             */
            return str_contains($subject, 'Lumen Wedding Story')
                && str_contains($subject, '30 hari')
                && ! str_contains($subject, '—')
                && ! preg_match('/[\x{1F300}-\x{1FAFF}]/u', $subject);
        });
    }

    /** Pengirim memakai MAIL_FROM_ADDRESS, bukan alamat lain. */
    public function test_pengirim_memakai_alamat_dari_config(): void
    {
        $vendor = $this->vendor();

        Mail::to('vendor@test.com')->send(new VendorWelcomeMail($vendor, 30, null));

        Http::assertSent(function ($request) {
            $data = $request->data();

            return $data['from_email'] === 'info@vendorkit.my.id'
                && $data['from_name'] === 'VendorKit';
        });
    }
}
