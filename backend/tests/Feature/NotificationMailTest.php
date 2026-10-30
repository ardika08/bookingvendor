<?php

namespace Tests\Feature;

use App\Mail\SubscriptionPaidMail;
use App\Mail\VendorWelcomeMail;
use App\Models\Category;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Models\Vendor;
use App\Services\NotificationMailer;
use App\Services\SubscriptionActivator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Uji email notifikasi: selamat datang dan tanda terima langganan.
 *
 * Yang dikunci di sini bukan hanya "email terkirim", tetapi juga dua sifat
 * yang mudah rusak tanpa disadari:
 *   1. Kegagalan SMTP TIDAK boleh menggagalkan pendaftaran/aktivasi;
 *   2. email tanda terima hanya dikirim sekali (aktivasi idempoten).
 */
class NotificationMailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        /*
         * NotificationMailer melewati pengiriman bila mailer tidak aktif
         * (`log`/`array`/`null`) — supaya tabel `jobs` tidak dipenuhi job yang
         * tidak akan pernah berguna. Tes ini menguji alur pengiriman, jadi
         * mailer harus dianggap aktif.
         */
        config(['mail.default' => 'smtp']);

        Category::create(['name' => 'MUA', 'slug' => 'mua']);
    }

    private function register(array $overrides = []): void
    {
        $this->postJson('/api/register', array_merge([
            'owner_name' => 'Dika Pratama',
            'vendor_name' => 'Lumen Wedding Story',
            'category_id' => (string) Category::where('slug', 'mua')->value('id'),
            'phone' => '081234567890',
            'email' => 'dika@gmail.com',
            'password' => 'passwo...ah',
        ], $overrides))->assertCreated();
    }

    public function test_pendaftaran_mengirim_email_selamat_datang(): void
    {
        Mail::fake();

        $this->register();

        Mail::assertQueued(
            VendorWelcomeMail::class,
            fn (VendorWelcomeMail $mail) => $mail->hasTo('dika@gmail.com')
                && $mail->trialDays === 30,
        );
    }

    /**
     * SMTP bermasalah tidak boleh membuat pendaftaran gagal — vendor sudah
     * mengisi form, akunnya sudah dibuat, dan mengembalikan error hanya akan
     * membuatnya mencoba lagi lalu ditolak karena email duplikat.
     */
    public function test_pendaftaran_tetap_berhasil_saat_email_gagal(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP down'));

        $this->register();

        $this->assertDatabaseHas('users', ['email' => 'dika@gmail.com']);
    }

    public function test_aktivasi_langganan_mengirim_tanda_terima(): void
    {
        Mail::fake();

        [$payment, $vendor] = $this->pendingPayment();

        app(SubscriptionActivator::class)->activate($payment);

        Mail::assertQueued(
            SubscriptionPaidMail::class,
            fn (SubscriptionPaidMail $mail) => $mail->hasTo('vendor@example.com')
                && $mail->vendorName === $vendor->name,
        );
    }

    /**
     * Aktivasi idempoten: memanggil dua kali tidak boleh mengirim dua email,
     * karena itu berarti vendor menerima dua tanda terima untuk satu
     * pembayaran.
     */
    public function test_aktivasi_ganda_tidak_mengirim_email_dua_kali(): void
    {
        Mail::fake();

        [$payment] = $this->pendingPayment();

        $activator = app(SubscriptionActivator::class);
        $activator->activate($payment);
        $activator->activate($payment->refresh());

        Mail::assertQueuedCount(1);
    }

    /**
     * Vendor tanpa email tidak boleh membuat aktivasi gagal.
     */
    public function test_vendor_tanpa_email_tidak_menghalangi_aktivasi(): void
    {
        Mail::fake();

        [$payment, $vendor] = $this->pendingPayment();
        $vendor->forceFill(['contact_email' => null])->save();

        $activated = app(SubscriptionActivator::class)->activate($payment);

        $this->assertTrue($activated);
        Mail::assertNothingQueued();
    }

    /**
     * Isi email memakai data yang tersimpan, bukan hitungan ulang: tanggal
     * aktif harus sama dengan `subscriptions.ends_at`.
     */
    public function test_tanda_terima_memakai_tanggal_aktif_dari_database(): void
    {
        Mail::fake();

        [$payment, $vendor] = $this->pendingPayment();

        app(SubscriptionActivator::class)->activate($payment);

        $endsAt = Subscription::where('vendor_id', $vendor->id)->value('ends_at');

        Mail::assertQueued(
            SubscriptionPaidMail::class,
            fn (SubscriptionPaidMail $mail) => $mail->activeUntil !== null
                && str_starts_with((string) $endsAt, substr($mail->activeUntil, 0, 10)),
        );
    }

    /** Helper: vendor + pembayaran pending. */
    private function pendingPayment(): array
    {
        $user = User::create([
            'name' => 'Vendor Uji',
            'email' => 'vendor@example.com',
            'role' => User::ROLE_VENDOR,
        ]);

        $vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-mail',
            'contact_email' => 'vendor@example.com',
        ]);

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
            'order_id' => 'SUB-MAIL-1',
            'gateway' => 'duitku',
            'amount' => 50000,
            'status' => 'pending',
        ]);

        return [$payment, $vendor];
    }

    /**
     * Saat email dimatikan (`MAIL_MAILER=log`), tidak boleh ada job yang masuk
     * antrean.
     *
     * Mailable memakai `ShouldQueue`, jadi tanpa penjagaan ini setiap
     * pendaftaran menambah satu baris di tabel `jobs` yang tidak akan pernah
     * diproses (tidak ada worker, dan mailer `log` memang tidak mengirim apa
     * pun). Baris itu menumpuk selamanya.
     */
    public function test_mailer_mati_tidak_menumpuk_job_di_antrean(): void
    {
        config(['mail.default' => 'log']);
        Mail::fake();

        $this->register();

        Mail::assertNothingSent();
        $this->assertSame(0, DB::table('jobs')->count());
    }
}
