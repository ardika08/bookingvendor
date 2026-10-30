<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;

/**
 * Katalog paket untuk halaman promosi (publik, tanpa login).
 *
 * Dipisah dari `PlanController` yang butuh sesi: halaman promosi harus
 * menampilkan harga yang benar kepada calon vendor yang belum punya akun.
 *
 * Sebelumnya halaman promosi memakai data mock dengan harga `null` untuk paket
 * 3 Bulan dan Tahunan. Karena admin sudah mengisi harga ketiga paket, mock itu
 * menampilkan "Segera" dan tombol mati — calon vendor melihat paket yang
 * sebenarnya bisa dibeli sebagai "belum tersedia". Endpoint ini menghapus
 * ketergantungan pada mock tersebut.
 *
 * Yang dibalas **hanya** paket yang bisa dibeli: aktif dan harganya sudah
 * ditetapkan. Paket tanpa harga tetap disembunyikan karena tidak ada gunanya
 * ditampilkan di halaman jualan.
 */
class PublicPlanController extends Controller
{
    /**
     * GET /api/public/plans
     */
    public function index(): JsonResponse
    {
        $plans = Plan::query()
            ->where('is_active', true)
            ->whereNotNull('price')
            ->orderBy('duration_months')
            ->get();

        return response()->json(
            $plans->map(fn (Plan $plan): array => [
                'id' => (string) $plan->id,
                'code' => $plan->code,
                'name' => $plan->name,
                'durationMonths' => (int) $plan->duration_months,
                'price' => (int) round((float) $plan->price),
                /*
                 * Harga normal (sebelum diskon) hanya dikirim bila memang lebih
                 * tinggi dari harga yang dibayar — kalau tidak, kartu akan
                 * mencoret angka yang sama atau lebih kecil, dan itu
                 * menyesatkan calon pembeli.
                 */
                'normalPrice' => $plan->normal_price !== null
                    && (float) $plan->normal_price > (float) $plan->price
                        ? (int) round((float) $plan->normal_price)
                        : null,
                'description' => $plan->description,
                // Kuota tidak dibatasi untuk semua paket berbayar.
                'maxBookings' => null,
                'maxInvoices' => null,
                // Paket tahunan disorot sebagai pilihan paling hemat.
                'highlight' => $plan->code === 'yearly',
                'benefits' => $this->benefits($plan, $plans->min('price')),
            ])->values()->all(),
        );
    }

    /**
     * Daftar manfaat per paket.
     *
     * Manfaat fitur sama untuk semua paket — yang membedakan hanya durasi dan
     * harga. Sebelumnya baris ini menyebut "Aktif N hari" (30/90/360), padahal
     * masa aktif dihitung dalam **bulan kalender** (`addMonthsNoOverflow`),
     * sehingga paket tahunan sebenarnya 365–366 hari. Angka 360 tidak cocok
     * dengan durasi nyata dan bertabrakan dengan label "Aktif 12 bulan" di
     * judul kartu — klaim yang tidak dipenuhi bisa jadi keluhan.
     *
     * @param  \Illuminate\Support\Collection<int, Plan>  $plans
     * @param  mixed  $cheapestPrice
     * @return array<int, string>
     */
    private function benefits(Plan $plan, $cheapestPrice): array
    {
        $benefits = [
            'Booking & invoice tanpa batas',
            'Link jadwal publik untuk klien',
            'Catat DP & pelunasan per termin',
        ];

        /*
         * Hemat dihitung terhadap harga per bulan paket termurah, bukan
         * terhadap harga bulanan apa pun. Tanpa pembanding, "hemat 20%" hanya
         * klaim tanpa dasar — dan pembeli yang menghitung sendiri akan
         * kehilangan kepercayaan saat angkanya tidak cocok.
         */
        $months = max((int) $plan->duration_months, 1);

        if ($cheapestPrice !== null && $months > 1) {
            $cheapestPrice = (float) $cheapestPrice;
            $monthlyOfCheapest = $cheapestPrice;

            if ($monthlyOfCheapest > 0) {
                $costPerMonth = (float) $plan->price / $months;
                $saving = (int) round((1 - ($costPerMonth / $monthlyOfCheapest)) * 100);

                if ($saving > 0) {
                    $benefits[] = 'Hemat '.$saving.'% dibanding paket bulanan';
                }
            }
        }

        return $benefits;
    }
}
