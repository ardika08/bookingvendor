<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Urutan tampil kategori usaha.
 *
 * Kategori diurutkan berdasarkan id, dan id mengikuti kapan baris dibuat.
 * Kategori inti (Wedding Organizer, dst.) dibuat oleh `CategorySeeder` yang
 * berjalan SETELAH semua migrasi, sedangkan kategori tambahan (Wedding Attire,
 * MC, Entertainment, Souvenir, Wedding Cake) dibuat oleh migrasi. Akibatnya di
 * instalasi baru, kategori niche muncul lebih dulu dan "Wedding Organizer" —
 * kategori utama pasar sasaran — jatuh ke posisi keenam di dropdown
 * pendaftaran.
 *
 * Solusinya kolom `sort_order` yang eksplisit: angka kecil tampil lebih dulu.
 * Kategori yang dibuat pengguna lewat `CategoryResolver` memakai nilai default
 * sehingga selalu berada di bawah kategori acuan.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('categories', 'sort_order')) {
            Schema::table('categories', function (Blueprint $table): void {
                $table->unsignedSmallInteger('sort_order')->default(100)->after('slug');
            });
        }

        /*
         * Lima kategori yang dibuat migrasi `add_category_other_and_more_categories`
         * diberi urutan 20–24 supaya berada di bawah delapan kategori inti
         * (10–17, diatur `CategorySeeder`). Diperbarui di sini — bukan di
         * migrasi asalnya — agar instalasi yang migrasinya sudah berjalan
         * (database pengembangan) ikut mendapat urutan yang benar.
         */
        $order = [
            'wedding-attire' => 20,
            'mc' => 21,
            'entertainment' => 22,
            'souvenir' => 23,
            'wedding-cake' => 24,
        ];

        foreach ($order as $slug => $value) {
            DB::table('categories')->where('slug', $slug)->update(['sort_order' => $value]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('categories', 'sort_order')) {
            Schema::table('categories', function (Blueprint $table): void {
                $table->dropColumn('sort_order');
            });
        }
    }
};
