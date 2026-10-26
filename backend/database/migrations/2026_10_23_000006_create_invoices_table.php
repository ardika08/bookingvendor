<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tagihan yang dibuat dari data booking.
 *
 * Satu booking bisa punya beberapa invoice (DP lalu pelunasan). Nominal yang
 * sudah dibayar disimpan di `paid_amount` agar status dan sisa tagihan bisa
 * dihitung tanpa menjumlah tabel `payments` setiap request.
 *
 * Catatan enum: PRD memakai `cancelled` untuk invoice yang digugurkan. Frontend
 * saat ini memakai istilah `void`; pemetaan dilakukan di lapisan API/resource
 * sehingga skema database tetap mengikuti PRD.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->string('invoice_number')->unique();
            $table->string('public_token', 64)->unique();
            $table->enum('type', ['full', 'dp', 'pelunasan'])->default('full');
            $table->decimal('amount', 15, 2);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->enum('status', ['unpaid', 'partial', 'paid', 'cancelled'])
                ->default('unpaid');
            $table->date('due_date')->nullable();
            $table->text('note')->nullable();
            $table->boolean('link_active')->default(true);
            $table->timestamps();

            $table->index(['booking_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
