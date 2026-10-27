<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;

/**
 * Katalog paket langganan untuk vendor.
 *
 * Hanya paket aktif yang harganya sudah ditetapkan yang ditampilkan; paket
 * tanpa harga tidak bisa dibeli sehingga tidak perlu muncul di UI.
 */
class PlanController extends Controller
{
    /**
     * GET /api/plans
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
                'durationMonths' => $plan->duration_months,
                'price' => (int) round((float) $plan->price),
                /*
                 * Harga normal (sebelum diskon) hanya dikirim bila memang
                 * lebih tinggi dari harga yang dibayar — kalau tidak, katalog
                 * akan mencoret angka yang sama atau lebih kecil, dan itu
                 * menyesatkan.
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
                'benefits' => $this->benefits($plan),
            ])->values(),
        );
    }

    /**
     * @return list<string>
     */
    private function benefits(Plan $plan): array
    {
        return [
            'Booking & invoice tanpa batas',
            'Link jadwal publik untuk klien',
            'Aktif '.$plan->duration_months.' bulan',
        ];
    }
}
