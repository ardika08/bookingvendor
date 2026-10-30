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
     * @var array<int, string>
     */
    public const CATEGORIES = [
        'Wedding Organizer',
        'Fotografer / Videografer',
        'Venue',
        'Dekorasi',
        'MUA',
        'Catering',
        'Seserahan',
        'Lainnya',
    ];

    public function run(): void
    {
        foreach (self::CATEGORIES as $name) {
            Category::updateOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name],
            );
        }
    }
}
