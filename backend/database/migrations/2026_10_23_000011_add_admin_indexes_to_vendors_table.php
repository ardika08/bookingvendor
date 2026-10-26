<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indeks untuk panel admin "Kelola Vendor".
 *
 * Daftar vendor admin difilter berdasarkan status akun (`is_active`) dan
 * dicari berdasarkan nama usaha. Dua indeks ini menjaga query daftar
 * tetap ringan saat jumlah vendor bertambah — tanpa mengubah kolom apa pun.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->index('is_active');
            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropIndex(['is_active']);
            $table->dropIndex(['name']);
        });
    }
};
