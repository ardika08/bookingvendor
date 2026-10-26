<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data klien milik vendor.
 *
 * Klien tidak punya akun login; baris dibuat otomatis dari form booking dan
 * dideduplikasi berdasarkan nomor telepon yang sudah dinormalisasi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('phone');
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['vendor_id', 'phone']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clients');
    }
};
