<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hubungan booking dengan rekanan lain (sinergi silang vendor).
 *
 * `source` tagihkan dari mana booking masuk:
 *   - `direct`      : klien daftar langsung lewat link jadwal publik / dashboard.
 *   - `referral`    : klien dikenalkan / disuruh booking oleh rekanan vendor lain.
 *
 * Bila `source = referral`, kolom rencana disimpan:
 *   - `referral_name`      : nama rekanan (mis. "Budi Studio" atau "Kak Tina").
 *   - `referral_discount`  : potongan dalam Rupiah yang diberikan rekanan, jadi
 *     harga klien ke vendor berbeda dari tagihan vendor ke rekanan.
 *
 * `total_price` tetap harga final yang ditagihkan klien — bukan harga ke
 * rekanan. Ada dua nilai sekaligus yang disimpan di `bookings`:
 *   1. `total_price`             → harga ke klien (untuk invoice).
 *   2. John (implied)            → harga sebelum diskon (kalau perlu laporan margin).
 *
 * Kolom pendukung garis besar hanya untuk sinkronisasi & pelaporan, bukan
 * untuk keperluan pay-out.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->enum('source', ['direct', 'referral'])->default('direct')->after('total_price');

            $table->string('referral_name')->nullable()->after('source');

            // Potongan diskon rekanan dalam Rupiah.
            $table->decimal('referral_discount', 15, 2)->default(0)->after('referral_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('source');
            $table->dropColumn('referral_name');
            $table->dropColumn('referral_discount');
        });
    }
};
