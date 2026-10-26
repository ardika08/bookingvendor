<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kalender ketersediaan vendor.
 *
 * Satu baris = satu tanggal yang **tidak** tersedia untuk vendor. Ada dua
 * sumber penandaan:
 * - `booked`  — tanggal terpakai oleh booking aktif (diisi/dihapus otomatis
 *               mengikuti perubahan status booking);
 * - `blocked` — tanggal yang sengaja ditutup vendor (libur, acara pribadi).
 *
 * Unique (`vendor_id`, `date`) memastikan satu tanggal hanya punya satu penanda,
 * sehingga pengecekan bentrok cukup satu query. Booking yang dibatalkan melepas
 * tanggalnya dengan menghapus baris `booked`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vendor_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->foreignId('booking_id')->nullable()->constrained()->cascadeOnDelete();
            $table->enum('type', ['booked', 'blocked'])->default('blocked');
            $table->string('note')->nullable();
            $table->timestamps();

            $table->unique(['vendor_id', 'date']);
            $table->index(['vendor_id', 'type']);
            $table->index('date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_schedules');
    }
};
