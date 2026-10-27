<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Menambah kolom katalog paket: harga normal (coret) dan deskripsi singkat.
 *
 * `price` yang sudah ada tetap menjadi harga yang DIBAYAR vendor — kolom itu
 * dipakai logika pembayaran (`SubscriptionPayment`) dan tidak boleh berubah
 * arti. Kolom baru:
 *
 * - `normal_price` : harga sebelum diskon, ditampilkan dicoret. Referensi
 *   visual, bukan angka yang ditagih.
 * - `description`  : deskripsi singkat yang tampil di katalog.
 *
 * Catatan istilah: pemilik produk memakai istilah "harga coret" untuk harga
 * promo yang dibayar. Karena itu `price` = harga coret/promo (yang ditagih),
 * dan `normal_price` = harga normal sebelum diskon (yang dicoret).
 *
 * Catatan `code`: kolom itu ENUM('monthly','quarterly','yearly') di migrasi
 * awal. Mengubahnya butuh `doctrine/dbal`, jadi tidak dilakukan di sini.
 * Sebagai gantinya `code` diisi otomatis oleh controller dari nama paket dan
 * dibatasi ke tiga nilai itu — lihat AdminPlanController::codeForName().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->decimal('normal_price', 15, 2)->nullable()->after('price');
            $table->string('description', 200)->nullable()->after('normal_price');
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn(['normal_price', 'description']);
        });
    }
};
