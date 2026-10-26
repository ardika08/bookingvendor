<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * `DemoVendorSeeder` membuat admin, vendor lengkap dengan profil, dan paket
     * contoh. Tanpa baris `vendors`, dev-login hanya menghasilkan 403
     * `vendor_not_linked` di seluruh endpoint vendor.
     */
    public function run(): void
    {
        $this->call([
            PlanSeeder::class,
            DemoVendorSeeder::class,
        ]);
    }
}
