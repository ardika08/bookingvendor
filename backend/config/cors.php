<?php

/*
|--------------------------------------------------------------------------
| Cross-Origin Resource Sharing (CORS)
|--------------------------------------------------------------------------
|
| Frontend SPA memanggil API ini dari origin berbeda (Vite dev server) dengan
| `credentials: 'include'` supaya cookie sesi ikut terkirim. Dua hal yang wajib
| benar agar itu bekerja:
|
| 1. `allowed_origins` TIDAK boleh '*'. Spesifikasi CORS melarang wildcard pada
|    request ber-kredensial; browser akan menolak responsnya. Daftar origin
|    harus eksplisit.
| 2. `supports_credentials` harus true, kalau tidak browser membuang cookie.
|
| Origin diambil dari FRONTEND_URL (.env) ditambah origin pengembangan lokal,
| jadi deploy produksi cukup mengubah satu variabel.
|
*/

$frontend = rtrim((string) env('FRONTEND_URL', 'http://localhost:5173'), '/');

$origins = array_values(array_unique(array_filter([
    $frontend,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
])));

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'auth/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $origins,

    /*
     * Pola untuk subdomain pengembangan (mis. tunnel ngrok/cloudflared).
     * Kosongkan di produksi.
     */
    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
