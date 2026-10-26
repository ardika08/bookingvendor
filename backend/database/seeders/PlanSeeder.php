<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

/**
 * Paket langganan bawaan sesuai PRD.
 *
 * Bulanan sudah punya harga pasti (Rp50.000). 3 Bulan & Tahunan sengaja
 * `null` — harga belum ditetapkan dan admin mengisinya lewat panel.
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
                'price' => null,
                'is_active' => true,
            ],
            [
                'code' => 'yearly',
                'name' => 'Tahunan',
                'duration_months' => 12,
                'price' => null,
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
