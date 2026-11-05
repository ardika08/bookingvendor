<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tautan portofolio vendor.
 *
 * Vendor menyimpan URL eksternal (Instagram, website, Google Drive) yang
 * ditampilkan di halaman jadwal publik sebagai bukti hasil kerja. URL dibatasi
 * ke https agar tidak jadi jalur injeksi tautan berbahaya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->string('portfolio_url')->nullable()->after('logo_path');
            $table->string('portfolio_label')->nullable()->after('portfolio_url');
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropColumn(['portfolio_url', 'portfolio_label']);
        });
    }
};
