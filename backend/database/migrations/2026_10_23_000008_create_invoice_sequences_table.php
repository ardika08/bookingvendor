<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Penghitung urutan nomor invoice per tahun.
 *
 * Nomor invoice tidak boleh dipakai ulang (termasuk untuk invoice yang
 * dibatalkan). Menyimpan penghitung di tabel sendiri membuat alokasi nomor bisa
 * dikunci secara atomik (`lockForUpdate`) tanpa harus memindai tabel invoice,
 * sehingga aman ketika dua vendor membuat invoice pada saat bersamaan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_sequences', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('year')->unique();
            $table->unsignedInteger('last_number')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_sequences');
    }
};
