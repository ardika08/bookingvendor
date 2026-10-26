<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Package;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Data awal untuk pengembangan lokal: kategori referensi, satu admin, dan satu
 * vendor lengkap dengan profil serta paket contoh.
 *
 * Sebelumnya `DatabaseSeeder` hanya membuat user tanpa baris `vendors`. Akibatnya
 * dev-login berhasil secara autentikasi tetapi setiap endpoint vendor menjawab
 * 403 `vendor_not_linked`, sehingga dashboard tampak rusak padahal tidak.
 *
 * Semua langkah idempoten (`updateOrCreate`), jadi seeder aman dijalankan
 * berulang tanpa menggandakan data atau menimpa perubahan manual secara
 * berlebihan.
 */
class DemoVendorSeeder extends Seeder
{
    /**
     * Kategori usaha sesuai PRD.
     *
     * @var array<int, string>
     */
    private const CATEGORIES = [
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
        $this->seedCategories();
        $this->seedAdmin();
        $this->seedVendor();
    }

    private function seedCategories(): void
    {
        foreach (self::CATEGORIES as $name) {
            Category::updateOrCreate(
                ['slug' => Str::slug($name)],
                ['name' => $name],
            );
        }
    }

    /**
     * Admin dipakai untuk menguji panel admin (`/admin`).
     */
    private function seedAdmin(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Admin Uji',
                'password' => Hash::make('password'),
                'role' => User::ROLE_ADMIN,
                'is_active' => true,
                'email_verified_at' => now(),
            ],
        );
    }

    /**
     * Vendor contoh. `DevLoginController` mencari user pertama ber-role vendor,
     * jadi user ini yang dipakai tombol "Masuk sebagai vendor uji".
     */
    private function seedVendor(): void
    {
        $user = User::updateOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'password' => Hash::make('password'),
                'role' => User::ROLE_VENDOR,
                'is_active' => true,
                'email_verified_at' => now(),
            ],
        );

        $category = Category::where('slug', 'wedding-organizer')->first();

        $vendor = Vendor::updateOrCreate(
            ['user_id' => $user->id],
            [
                'category_id' => $category?->id,
                'name' => 'Lumen Wedding Story',
                'slug' => 'lumen-wedding-story',
                'description' => 'Wedding organizer untuk akad dan resepsi skala intim di Bandung.',
                'location' => 'Bandung',
                'contact' => '081234567890',
                'bank_name' => 'BCA',
                'bank_account_number' => '1234567890',
                'bank_account_name' => 'Lumen Wedding Story',
                'schedule_link_active' => true,
                'is_active' => true,
            ],
        );

        /*
         * Paket contoh memakai `updateOrCreate` pada (vendor, nama) supaya
         * menjalankan ulang seeder tidak menumpuk paket kembar — masalah yang
         * membuat dropdown form booking penuh duplikat.
         */
        $packages = [
            ['name' => 'Paket Silver', 'price' => 7500000, 'duration_hours' => 6, 'is_active' => true],
            ['name' => 'Paket Gold', 'price' => 15000000, 'duration_hours' => 10, 'is_active' => true],
            ['name' => 'Paket Arsip', 'price' => 3000000, 'duration_hours' => 4, 'is_active' => false],
        ];

        foreach ($packages as $package) {
            Package::updateOrCreate(
                ['vendor_id' => $vendor->id, 'name' => $package['name']],
                $package,
            );
        }
    }
}
