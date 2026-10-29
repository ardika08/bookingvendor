<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tabel `platform_settings`: nilai aturan platform yang bisa diubah admin
 * dari panel, tanpa menyentuh `.env` atau menjalankan ulang server.
 *
 * Bentuk tabel key-value, bukan satu baris berkolom tetap. Alasannya: setiap
 * penambahan aturan baru nanti (mis. batas unggahan, masa trial) cukup
 * menambah baris, tanpa migrasi baru yang mengubah skema. Nilai disimpan
 * sebagai string dan di-cast di kode, jadi tipe aslinya dijaga oleh service,
 * bukan oleh kolom.
 *
 * Riwayat perubahan disimpan di tabel terpisah (`platform_setting_changes`)
 * karena admin perlu melihat siapa mengubah apa dan kapan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->string('value', 255);
            $table->timestamps();
        });

        Schema::create('platform_setting_changes', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->index();
            $table->string('old_value', 255)->nullable();
            $table->string('new_value', 255);
            // Null bila akun admin yang mengubah sudah dihapus.
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
        });

        // Nilai awal disalin dari config, sehingga perilaku aplikasi tidak
        // berubah sama sekali sampai admin benar-benar menyimpan sesuatu.
        $now = now();
        $defaults = [
            'subscription.grace_days' => (string) config('subscription.grace_days', 7),
            'trial.bookings_limit' => (string) config('trial.bookings_limit', 2),
            'trial.invoices_limit' => (string) config('trial.invoices_limit', 2),
        ];

        foreach ($defaults as $key => $value) {
            DB::table('platform_settings')->insert([
                'key' => $key,
                'value' => $value,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_setting_changes');
        Schema::dropIfExists('platform_settings');
    }
};
