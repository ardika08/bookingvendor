<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Kolom untuk kategori "Lainnya" yang diisi sendiri vendor.
 *
 * Kategori vendor bersifat referensi (dropdown), tetapi vendor yang bidangnya
 * belum tercakup perlu bisa menuliskan sendiri. Menyimpannya sebagai kategori
 * baru akan membuat tabel referensi penuh typo ("Wedding Car", "wedding car",
 * "WeddingCar") sehingga pengelompokan di panel admin dan halaman publik jadi
 * kacau. Karena itu kategori tetap "Lainnya" dan teks bebasnya disimpan di
 * kolom terpisah.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->string('category_other')->nullable()->after('category_id');
        });

        /*
         * Kategori yang diminta untuk formulir pendaftaran. Memakai `insertOrIgnore`
         * dengan slug tetap supaya migrasi aman dijalankan ulang dan tidak
         * menduplikasi kategori yang sudah ada (mis. MUA, Catering).
         */
        $now = now();

        $categories = [
            ['name' => 'Wedding Attire', 'slug' => 'wedding-attire'],
            ['name' => 'MC', 'slug' => 'mc'],
            ['name' => 'Entertainment', 'slug' => 'entertainment'],
            ['name' => 'Souvenir', 'slug' => 'souvenir'],
            ['name' => 'Wedding Cake', 'slug' => 'wedding-cake'],
        ];

        foreach ($categories as $category) {
            $exists = DB::table('categories')->where('slug', $category['slug'])->exists();

            if (! $exists) {
                DB::table('categories')->insert([
                    'name' => $category['name'],
                    'slug' => $category['slug'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropColumn('category_other');
        });

        DB::table('categories')->whereIn('slug', [
            'wedding-attire',
            'mc',
            'entertainment',
            'souvenir',
            'wedding-cake',
        ])->delete();
    }
};
