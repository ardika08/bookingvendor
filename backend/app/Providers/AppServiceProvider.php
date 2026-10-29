<?php

namespace App\Providers;

use App\Services\PlatformSettings;
use Illuminate\Http\Resources\Json\JsonResource;
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
