<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kolom profil yang belum tercakup migrasi awal:
 * - `vendors.contact_email` — email publik vendor terpisah dari email akun;
 * - `users.avatar_url` — foto profil dari Google (PRD) untuk avatar dashboard.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->string('contact_email')->nullable()->after('contact');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar_url')->nullable()->after('password');
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropColumn('contact_email');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('avatar_url');
        });
    }
};
