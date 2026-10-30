<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Masa Uji (Trial)
    |--------------------------------------------------------------------------
    |
    | Trial berbasis **waktu**, bukan kuota transaksi. Vendor baru mendapat
    | akses penuh ke semua fitur selama `days` hari sejak mendaftar.
    |
    | Alasan perubahan: vendor wedding baru biasanya hanya memegang 1–3 acara
    | per bulan. Kuota "2 booking" habis dalam hitungan hari sehingga mereka
    | tidak pernah sempat mencoba alur lengkap (booking → invoice → DP →
    | pelunasan → acara selesai), padahal itulah nilai produk yang ingin
    | ditunjukkan. Satu siklus acara butuh berminggu-minggu, bukan dua
    | transaksi.
    |
    */

    'days' => (int) env('TRIAL_DAYS', 30),

    /*
    |--------------------------------------------------------------------------
    | Sisa Konfigurasi Kuota (tidak dipakai lagi)
    |--------------------------------------------------------------------------
    |
    | Dipertahankan agar `config('trial.bookings_limit')` yang mungkin masih
    | dibaca kode lama tidak melempar error. Penegakan kuota sudah dihapus dari
    | jalur booking & invoice — lihat `SubscriptionStatus`.
    |
    */

    'bookings_limit' => env('TRIAL_BOOKINGS_LIMIT', 2),

    'invoices_limit' => env('TRIAL_INVOICES_LIMIT', 2),
];
