<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Skema langganan vendor (PRD §6): `plans`, `subscriptions`,
 * `subscription_payments`.
 *
 * - `plans` — katalog harga (Bulanan pasti, 3 Bulan & Tahunan bisa null).
 * - `subscriptions` — periode trial/aktif per vendor + penghitung pemakaian
 *   trial (2 booking + 2 invoice, sekali pakai).
 * - `subscription_payments` — transaksi payment gateway; sumber riwayat yang
 *   dilihat admin. Kuota TIDAK disimpan di `plans` (batas hanya milik trial).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->enum('code', ['monthly', 'quarterly', 'yearly'])->unique();
            $table->string('name');
            $table->unsignedSmallInteger('duration_months');
            $table->decimal('price', 15, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('status', ['trial', 'active', 'expired', 'cancelled'])->default('trial');
            $table->date('starts_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->unsignedInteger('trial_bookings_used')->default(0);
            $table->unsignedInteger('trial_invoices_used')->default(0);
            $table->decimal('amount_paid', 15, 2)->default(0);
            $table->foreignId('activated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['vendor_id', 'status']);
        });

        Schema::create('subscription_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('vendor_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained()->restrictOnDelete();
            $table->string('order_id')->unique();
            $table->enum('gateway', ['midtrans', 'duitku']);
            $table->string('gateway_reference')->nullable();
            $table->decimal('amount', 15, 2);
            $table->enum('status', ['pending', 'paid', 'failed', 'expired', 'refunded'])
                ->default('pending');
            $table->string('payment_method')->nullable();
            $table->json('raw_payload')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['vendor_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_payments');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('plans');
    }
};
