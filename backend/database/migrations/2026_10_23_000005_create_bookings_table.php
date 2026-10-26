<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data pemesanan yang dibuat vendor.
 *
 * Indeks (`vendor_id`, `event_date`) dipakai untuk query kalender dan cek
 * bentrok tanggal. Indeks ini sengaja tidak unik: booking berstatus `cancelled`
 * harus melepas tanggalnya supaya bisa dipesan ulang, sehingga penegakan
 * double booking dilakukan di lapisan aplikasi (hanya booking aktif yang
 * menempati tanggal).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('package_id')->nullable()->constrained()->nullOnDelete();
            $table->date('event_date');
            $table->time('event_time')->nullable();
            $table->string('event_location')->nullable();
            $table->text('event_details')->nullable();
            $table->enum('status', ['tentative', 'confirmed', 'completed', 'cancelled'])
                ->default('tentative');
            $table->decimal('total_price', 15, 2)->default(0);
            $table->timestamps();

            $table->index(['vendor_id', 'event_date']);
            $table->index(['vendor_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
