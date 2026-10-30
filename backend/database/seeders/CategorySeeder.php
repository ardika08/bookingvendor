<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Kategori usaha inti — data acuan, bukan data demo.
 *
 * Sebelumnya delapan kategori ini dibuat oleh `DemoVendorSeeder`, sehingga
 * instalasi produksi yang hanya menjalankan `PlanSeeder` (tanpa data demo)
 * tidak punya kategori sama sekali. Akibatnya formulir pendaftaran vendor
 * hanya menampilkan lima kategori dari migrasi, dan kategori terpenting
 * seperti "Wedding Organizer" tidak bisa dipilih.
 *
 * Dipisah ke seeder tersendiri supaya produksi bisa menjalankan
 * `db:seed --class=CategorySeeder` tanpa ikut membuat vendor contoh.
 *
 * Idempoten (`updateOrCreate` pada slug), jadi aman dijalankan berulang dan
 * aman dipanggil dari `DemoVendorSeeder` maupun `DatabaseSeeder`.
 */
class CategorySeeder extends Seeder
{
    /**
     * Kategori usaha sesuai PRD, dalam urutan tampil di dropdown.
     *
     * Nilai = `sort_order`. Dimulai dari 10 supaya ada ruang menyisipkan
     * kategori baru di antaranya tanpa menomori ulang semuanya. Kategori
     * tambahan dari migrasi memakai 20+, dan kategori buatan pengguna 100
     * (nilai default kolom) sehingga selalu di bawah kategori acuan.
     *
     * @var array<string, int>
     */
    public const CATEGORIES = [
        'Wedding Organizer' => 10,
        'Fotografer / Videografer' => 11,
        'Venue' => 12,
        'Dekorasi' => 13,
        'MUA' => 14,
        'Catering' => 15,
        'Seserahan' => 16,
        'Lainnya' => 17,
    ];

    public function run(): void
    {
        foreach (self::CATEGORIES as $name => $sortOrder) {
            Category::updateOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name, 'sort_order' => $sortOrder],
            );
        }
    }
}
