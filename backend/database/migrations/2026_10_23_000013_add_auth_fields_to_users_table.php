<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kolom pengguna untuk "Masuk dengan Google" (PRD §6 users).
 *
 * - `google_id` — identitas akun Google; unik dan nullable (akun uji/admin yang
 *   belum pernah login lewat Google belum memilikinya).
 * - `phone` — nomor HP akun, opsional.
 * - `role` — hanya dua peran (PRD): `vendor` dan `admin`.
 * - `is_active` — akun nonaktif tidak bisa masuk; data tetap utuh.
 *
 * `avatar_url` sudah ditambahkan pada migrasi profil sebelumnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('google_id')->nullable()->unique()->after('id');
            $table->string('phone', 20)->nullable()->after('email');
            $table->enum('role', ['vendor', 'admin'])->default('vendor')->after('phone');
            $table->boolean('is_active')->default(true)->after('role');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['google_id']);
            $table->dropColumn(['google_id', 'phone', 'role', 'is_active']);
        });
    }
};
