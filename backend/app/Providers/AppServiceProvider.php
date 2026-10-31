<?php

namespace App\Providers;

use App\Mail\Transport\MailketingTransport;
use App\Services\PlatformSettings;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Singleton: nilai aturan dibaca beberapa kali per permintaan
        // (middleware kuota, resolusi status langganan, endpoint pengaturan).
        $this->app->singleton(PlatformSettings::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        /*
         * Frontend memanggil API dan membaca objek secara langsung
         * (`apiRequest<Invoice>`), bukan `{ data: ... }`. Menonaktifkan
         * pembungkusan membuat bentuk respons konsisten di seluruh endpoint.
         */
        JsonResource::withoutWrapping();

        /*
         * Transport email lewat REST API Mailketing.
         *
         * SMTP Mailketing bermasalah di hosting ini: sertifikat TLS-nya hanya
         * berlaku untuk `smtp.mailketing.id`, dan port 587/465 bisa diblokir.
         * API memakai HTTPS 443 dan memberi kode error yang jelas.
         *
         * Dipakai dengan `MAIL_MAILER=mailketing` di `.env`.
         */
        Mail::extend('mailketing', function (): MailketingTransport {
            return new MailketingTransport(
                token: (string) config('mail.mailers.mailketing.token', ''),
                endpoint: (string) config('mail.mailers.mailketing.endpoint'),
                fromEmail: (string) config('mail.from.address'),
                fromName: (string) config('mail.from.name'),
                timeout: (int) config('mail.mailers.mailketing.timeout', 20),
            );
        });

        /*
         * Aturan platform yang disimpan admin ditulis ke config di sini.
         *
         * Kode yang sudah ada membaca `config('subscription.grace_days')` dan
         * `config('trial.*')`; menulis ke config saat boot membuat nilai dari
         * database langsung berlaku tanpa mengubah satu pun pemanggil itu.
         *
         * Aman bila tabel belum ada: service memeriksa ketersediaan tabel dan
         * membiarkan nilai `.env` apa adanya.
         */
        $this->app->make(PlatformSettings::class)->applyToConfig();
    }
}
