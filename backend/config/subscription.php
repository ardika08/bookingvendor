<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Masa Tenggang Langganan
    |--------------------------------------------------------------------------
    |
    | Jumlah hari setelah `ends_at` di mana vendor masih boleh memakai aplikasi
    | (status `grace`). Setelah masa tenggang lewat, status menjadi `expired`
    | dan pembuatan invoice ditolak sampai langganan diperpanjang.
    |
    */

    'grace_days' => env('SUBSCRIPTION_GRACE_DAYS', 7),
];
