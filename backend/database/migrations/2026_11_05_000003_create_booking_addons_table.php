<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Snapshot addon pada booking.
 *
 * Harga addon di kunci pada saat booking dibuat (tidak mengikuti perubahan
 * harga katalog/addon setelahnya). Jadi kolom name/price di sini adalah salinan
 * tetap dari harga saat pemesanan, dan invoice dibangun dari baris ini.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_addons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            // Addon asal boleh dihapus; snapshot tetap tersimpan.
            $table->unsignedBigInteger('addon_id')->nullable();
            $table->string('name');
            $table->decimal('price', 15, 2);
            $table->timestamps();
            $table->index('booking_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_addons');
    }
};
