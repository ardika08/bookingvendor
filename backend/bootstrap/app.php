<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        /*
         * Jembatan sesi SPA → API.
         *
         * Login Google memakai `Auth::login()` pada guard `web` (cookie sesi),
         * sedangkan frontend memanggil `/api/*` dengan `credentials: 'include'`.
         * Tanpa `statefulApi()`, guard Sanctum tidak pernah membaca cookie sesi
         * itu sehingga `auth:sanctum` akan menolak (401) setiap request meski
         * pengguna sudah login di browser.
         */
        $middleware->statefulApi();

        $middleware->alias([
            'invoice.trial' => \App\Http\Middleware\EnsureInvoiceTrialQuota::class,
            'vendor.active' => \App\Http\Middleware\EnsureVendorIsActive::class,
            'admin.only' => \App\Http\Middleware\EnsureUserIsAdmin::class,
            'onboarding.complete' => \App\Http\Middleware\EnsureOnboardingComplete::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        /*
         * Semua route API selalu menjawab JSON, termasuk saat belum login.
         * Tanpa ini, request tanpa header `Accept: application/json` akan
         * diarahkan (302) ke halaman login web yang tidak ada di SPA.
         */
        $exceptions->shouldRenderJsonWhen(
            fn ($request) => $request->is('api/*') || $request->expectsJson(),
        );

        /*
         * Samakan bentuk respons auth dengan endpoint lain: setiap penolakan
         * membawa `code` yang bisa dicabang frontend. Tanpa ini, 401 dari
         * Sanctum hanya berisi `message` dan SPA tidak bisa membedakan
         * "belum login" dari kegagalan lain.
         */
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => 'Silakan masuk terlebih dahulu.',
                    'code' => 'unauthenticated',
                ], 401);
            }
        });
    })->create();
