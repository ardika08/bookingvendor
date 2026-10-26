<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Pembagian Tagihan DP
    |--------------------------------------------------------------------------
    |
    | Bagian nilai kontrak yang ditagihkan sebagai DP. Sisanya menjadi tagihan
    | pelunasan. Nilai ini dipakai sebagai saran default di form invoice; vendor
    | tetap boleh menimpa nominalnya secara manual.
    |
    */

    'dp_percentage' => env('INVOICE_DP_PERCENTAGE', 0.4),
];
