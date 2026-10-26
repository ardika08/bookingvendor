<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kata sandi menjadi opsional.
 *
 * PRD: masuk hanya lewat akun Google — vendor/admin tidak pernah membuat kata
 * sandi. Kolom ini tetap ada untuk kebutuhan internal (mis. akun uji), tetapi
 * tidak lagi wajib saat membuat akun.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable(false)->change();
        });
    }
};
