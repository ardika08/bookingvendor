<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Riwayat pembayaran manual yang dicatat vendor.
 *
 * Vendor mencatat dana yang benar-benar masuk (transfer, QRIS, tunai). Baris di
 * sini bersifat catatan historis: tidak pernah diubah setelah dibuat, hanya bisa
 * ditambahkan. Karena itu tabel ini hanya punya `created_at`, tanpa `updated_at`.
 *
 * `method` sengaja berupa string bebas (default `transfer`) agar metode lain
 * seperti `qris`, `cash`, atau `other` bisa dipakai tanpa mengubah skema.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 15, 2);
            $table->string('method', 30)->default('transfer');
            $table->string('reference_number')->nullable();
            $table->string('note')->nullable();
            $table->date('paid_at');
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['invoice_id', 'paid_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
