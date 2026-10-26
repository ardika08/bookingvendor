<?php

namespace App\Providers;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
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
    }
}
