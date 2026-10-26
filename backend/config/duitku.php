<?php

/*
 * Konfigurasi payment gateway Duitku.
 *
 * CATATAN PENTING — signature Duitku BERBEDA per endpoint (diverifikasi
 * langsung ke sandbox, tidak sesuai asumsi dokumentasi):
 *
 *   POST /webapi/api/merchant/v2/inquiry
 *        MD5(merchantCode + merchantOrderId + paymentAmount + apiKey)
 *
 *   POST /webapi/api/merchant/paymentmethod/getpaymentmethod
 *        SHA256(merchantCode + paymentAmount + datetime + apiKey)
 *
 *   POST /webapi/api/merchant/transactionStatus
 *        MD5(merchantCode + merchantOrderId + apiKey)
 *
 * Salah algoritma berakibat 401 "Wrong signature" / "Invalid Signature".
 */

return [
    'merchant_code' => env('DUITKU_MERCHANT_CODE', ''),

    'api_key' => env('DUITKU_API_KEY', ''),

    /*
     * Sandbox memakai host berbeda. Jangan mengaktifkan sandbox di produksi:
     * transaksi sandbox tidak pernah menghasilkan uang sungguhan.
     */
    'sandbox' => (bool) env('DUITKU_SANDBOX', true),

    'base_url' => env('DUITKU_SANDBOX', true)
        ? 'https://sandbox.duitku.com/webapi/api/merchant'
        : 'https://passport.duitku.com/webapi/api/merchant',

    /*
     * URL yang dipanggil Duitku saat status transaksi berubah.
     * WAJIB dapat diakses publik lewat HTTPS, jika tidak status pembayaran
     * tidak akan pernah berubah dari `pending`.
     */
    'callback_url' => env('DUITKU_CALLBACK_URL', ''),

    /* Halaman yang dibuka vendor setelah selesai membayar. */
    'return_url' => env('DUITKU_RETURN_URL', ''),

    /*
     * Metode pembayaran yang ditampilkan ke vendor.
     *
     * Hanya QRIS sesuai keputusan produk. Kode Duitku yang tersedia untuk
     * QRIS: `SP` (ShopeePay QRIS) dan `NQ` (Nobu QRIS). Keduanya diuji
     * berhasil di sandbox dan sama-sama mengembalikan `qrString`.
     */
    'methods' => array_values(array_filter(array_map(
        'trim',
        explode(',', env('DUITKU_METHODS', 'SP,NQ')),
    ))),

    /*
     * Masa berlaku transaksi dalam menit.
     *
     * 1440 (24 jam) dipilih karena scheduler cPanel hanya berjalan tiap
     * 5–15 menit sehingga tidak ada cara akurat mengakhiri transaksi tepat
     * waktu. Dengan masa berlaku panjang, kecil kemungkinan vendor membayar
     * setelah kita menandainya kedaluwarsa (uang masuk tapi langganan tidak
     * aktif).
     */
    'expiry_minutes' => (int) env('DUITKU_EXPIRY_MINUTES', 1440),

    'timeout' => (int) env('DUITKU_TIMEOUT', 30),
];
