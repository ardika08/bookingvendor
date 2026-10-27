<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Melonggarkan kolom `plans.code` dari ENUM menjadi string.
 *
 * Semula `code` adalah ENUM('monthly','quarterly','yearly'). Admin sekarang
 * bisa menambah paket sendiri, dan paket keempat akan ditolak database karena
 * tidak ada nilai ENUM yang tersisa. Kolomnya diubah menjadi string(30) unik
 * agar katalog bisa berisi paket apa pun.
 *
 * `code` tetap penanda internal: katalog memakai `code === 'yearly'` hanya
 * untuk menandai paket sorotan, dan nilainya dibuat otomatis dari nama paket
 * bila kosong.
 *
 * Catatan: indeks unik lama harus dilepas lebih dulu. SQLite tidak bisa
 * mengubah tipe kolom yang masih terikat indeks, dan `unique()` pada `change()`
 * akan mencoba membuat indeks dengan nama yang sama.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropUnique('plans_code_unique');
        });

        Schema::table('plans', function (Blueprint $table) {
            $table->string('code', 30)->change();
        });

        Schema::table('plans', function (Blueprint $table) {
            $table->unique('code');
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropUnique('plans_code_unique');
        });

        Schema::table('plans', function (Blueprint $table) {
            $table->enum('code', ['monthly', 'quarterly', 'yearly'])->change();
        });

        Schema::table('plans', function (Blueprint $table) {
            $table->unique('code');
        });
    }
};
