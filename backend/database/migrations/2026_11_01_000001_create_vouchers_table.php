<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabel `vouchers` dan `voucher_redemptions`.
 *
 * Voucher adalah kode yang dibuat admin untuk diberikan ke vendor. Dua tipe:
 *
 * - `free_months`  → menambah masa aktif langsung, tanpa pembayaran.
 * - `discount`     → memotong harga saat checkout. Potongannya bisa nominal
 *                    (`amount`) atau persen (`percent`), tidak keduanya.
 *
 * Kenapa `voucher_redemptions` tabel terpisah, bukan kolom `used_count` saja:
 * aturan pemakaiannya "sekali per vendor", jadi kita harus tahu SIAPA yang
 * sudah memakai. Kolom penghitung tidak bisa menjawab itu. Tabel ini sekaligus
 * jadi riwayat: admin bisa melihat kode mana dipakai vendor mana dan kapan.
 *
 * Kolom `code` disimpan dalam huruf besar dan unik, supaya "hemat50" dan
 * "HEMAT50" tidak jadi dua kode berbeda — vendor sering mengetik ulang dari
 * gambar dan salah besar-kecil.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vouchers', function (Blueprint $table) {
            $table->id();

            // Kode yang diketik vendor. Disimpan uppercase; keunikan dijaga
            // di level database agar dua admin tidak bisa membuat kode sama.
            $table->string('code', 40)->unique();

            // Untuk daftar di panel admin. Boleh kosong.
            $table->string('description', 255)->nullable();

            // `free_months` | `discount`
            $table->string('type', 20)->index();

            // ── Tipe free_months ────────────────────────────────────────────
            // Jumlah bulan yang ditambahkan. Null untuk tipe discount.
            $table->unsignedSmallInteger('free_months')->nullable();

            // Paket yang diberikan. Null = paket termurah yang aktif.
            // Diisi agar admin bisa memberi "3 bulan paket tertentu".
            $table->foreignId('plan_id')->nullable()->constrained('plans')->nullOnDelete();

            // ── Tipe discount ───────────────────────────────────────────────
            // `amount` (rupiah) atau `percent`. Null untuk tipe free_months.
            $table->string('discount_kind', 10)->nullable();

            // Nominal rupiah. Null bila discount_kind = percent.
            $table->decimal('discount_amount', 12, 2)->nullable();

            // Persen 1–100. Null bila discount_kind = amount.
            $table->unsignedTinyInteger('discount_percent')->nullable();

            // ── Batas pemakaian ─────────────────────────────────────────────
            // Total berapa kali kode ini boleh dipakai seluruh vendor.
            // Null = tanpa batas total (tetap dibatasi "sekali per vendor").
            $table->unsignedInteger('max_uses')->nullable();

            // Dihitung ulang setiap klaim, bukan diisi manual, supaya tidak
            // bisa melenceng dari isi voucher_redemptions.
            $table->unsignedInteger('used_count')->default(0);

            // ── Masa berlaku ────────────────────────────────────────────────
            // Keduanya opsional. Null = tanpa batas di sisi itu.
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable();

            // Admin bisa menghentikan kode tanpa menghapus riwayatnya.
            $table->boolean('is_active')->default(true);

            // Siapa yang membuat. Null bila akun admin sudah dihapus.
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            // Pencarian di panel admin: filter aktif + urut terbaru.
            $table->index(['is_active', 'created_at']);
        });

        Schema::create('voucher_redemptions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained('vendors')->cascadeOnDelete();

            // Nilai yang benar-benar diberikan saat klaim. Disimpan agar
            // riwayat tetap akurat walau voucher diubah setelahnya.
            $table->unsignedSmallInteger('granted_months')->nullable();
            $table->decimal('discount_applied', 12, 2)->nullable();

            // Pembayaran yang memakai diskon ini, bila ada. Null untuk
            // voucher gratis (tidak ada transaksi).
            $table->foreignId('subscription_payment_id')->nullable()
                ->constrained('subscription_payments')->nullOnDelete();

            $table->timestamp('redeemed_at');

            $table->timestamps();

            // Aturan "sekali per vendor" ditegakkan di sini juga, bukan hanya
            // di kode: dua permintaan bersamaan tidak bisa lolos dua-duanya.
            $table->unique(['voucher_id', 'vendor_id']);

            // Riwayat pemakaian per vendor, untuk ditampilkan di panel admin.
            $table->index(['vendor_id', 'redeemed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_redemptions');
        Schema::dropIfExists('vouchers');
    }
};
