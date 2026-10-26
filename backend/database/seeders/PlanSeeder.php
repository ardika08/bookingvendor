<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

/**
 * Paket langganan bawaan sesuai PRD.
 *
 * Harga bertingkat untuk mendorong komitmen lebih panjang:
 *   Bulanan  Rp50.000  → Rp50.000/bln (acuan)
 *   3 Bulan  Rp135.000 → Rp45.000/bln (diskon 10%)
 *   Tahunan  Rp480.000 → Rp40.000/bln (diskon 20%)
 *
 * Diskon sengaja dijaga di bawah 25% agar nilai produk tidak terkesan murah
 * dan masih ada ruang promo di masa depan.
 *
 * Idempoten: aman dijalankan ulang tanpa menggandakan baris.
 */
class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'code' => 'monthly',
                'name' => 'Bulanan',
                'duration_months' => 1,
                'price' => 50000,
                'is_active' => true,
            ],
            [
                'code' => 'quarterly',
                'name' => '3 Bulan',
                'duration_months' => 3,
                'price' => 135000,
                'is_active' => true,
            ],
            [
                'code' => 'yearly',
                'name' => 'Tahunan',
                'duration_months' => 12,
                'price' => 480000,
                'is_active' => true,
            ],
        ];

        foreach ($plans as $plan) {
            Plan::query()->updateOrCreate(
                ['code' => $plan['code']],
                $plan,
            );
        }
    }
}
