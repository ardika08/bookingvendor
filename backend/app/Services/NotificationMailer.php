<?php

namespace App\Services;

use App\Mail\SubscriptionPaidMail;
use App\Mail\VendorWelcomeMail;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\Vendor;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Pengiriman email notifikasi.
 *
 * Semua pemanggilan dibungkus try/catch: **kegagalan email tidak boleh
 * menggagalkan alur utama**. Vendor yang berhasil mendaftar atau membayar tidak
 * boleh melihat error hanya karena SMTP menolak koneksi, kredensial salah, atau
 * kuota pengiriman habis. Kegagalan dicatat di log supaya bisa ditindaklanjuti.
 *
 * Semua Mailable memakai `ShouldQueue`, jadi pemanggilan di sini hanya
 * memasukkan job ke antrean — pendaftaran dan aktivasi langganan tetap cepat.
 * Bila `QUEUE_CONNECTION=sync` (mis. saat tes), pengiriman berjalan langsung
 * tetapi tetap tidak melempar keluar.
 *
 * EMAIL DIMATIKAN (`MAIL_MAILER=log`)
 * Mailable yang memakai `ShouldQueue` tetap MEMASUKKAN job ke tabel `jobs`
 * meskipun mailer-nya `log` — job-nya hanya baru "mengirim" saat worker
 * mengambilnya. Tanpa worker, baris itu menumpuk selamanya dan tidak ada satu
 * pun email yang benar-benar terkirim. Karena itu pengiriman dilewati sepenuhnya
 * bila mailer belum dikonfigurasi untuk mengirim sungguhan.
 */
class NotificationMailer
{
    /**
     * Email selamat datang setelah vendor mendaftar.
     */
    public function sendVendorWelcome(Vendor $vendor, int $trialDays, ?string $trialEndsAt): void
    {
        if (! $this->enabled()) {
            return;
        }

        $email = $vendor->contact_email;

        if (blank($email)) {
            return;
        }

        try {
            Mail::to($email)->send(new VendorWelcomeMail($vendor, $trialDays, $trialEndsAt));
        } catch (Throwable $exception) {
            $this->logFailure('vendor_welcome', $email, $exception);
        }
    }

    /**
     * Tanda terima setelah langganan aktif.
     *
     * `$activeUntil` diambil dari baris langganan setelah aktivasi, bukan
     * dihitung ulang di sini — supaya isi email selalu sama dengan yang
     * tersimpan di database (termasuk saat perpanjangan menyambung masa aktif).
     */
    public function sendSubscriptionPaid(SubscriptionPayment $payment): void
    {
        if (! $this->enabled()) {
            return;
        }

        $vendor = $payment->vendor;

        if ($vendor === null) {
            return;
        }

        $email = $vendor->contact_email;

        if (blank($email)) {
            return;
        }

        $activeUntil = Subscription::query()
            ->where('vendor_id', $vendor->id)
            ->value('ends_at');

        try {
            Mail::to($email)->send(new SubscriptionPaidMail(
                $payment,
                $vendor->name,
                $activeUntil !== null ? (string) $activeUntil : null,
            ));
        } catch (Throwable $exception) {
            $this->logFailure('subscription_paid', $email, $exception);
        }
    }

    /**
     * True bila email benar-benar bisa dikirim.
     *
     * Mailer `log`, `array`, dan `null` tidak mengirim apa pun — hanya menulis
     * ke log atau membuang. Pada kondisi itu pengiriman dilewati supaya tabel
     * `jobs` tidak dipenuhi job yang tidak akan pernah berguna.
     *
     * Mailer `smtp`, `mail`, `ses`, `postmark`, `resend`, `mailketing`, dan
     * sejenisnya dianggap aktif.
     */
    private function enabled(): bool
    {
        $mailer = config('mail.default');

        return ! in_array($mailer, ['log', 'array', 'null'], true);
    }

    private function logFailure(string $kind, string $email, Throwable $exception): void
    {
        Log::warning('Email notifikasi gagal dikirim', [
            'kind' => $kind,
            'to' => $email,
            'message' => $exception->getMessage(),
        ]);
    }
}
