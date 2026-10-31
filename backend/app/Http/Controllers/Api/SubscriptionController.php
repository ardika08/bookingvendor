<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Services\SubscriptionStatus;
use App\Services\TrialQuota;
use Illuminate\Http\JsonResponse;

/**
 * Status langganan & sisa kuota trial vendor.
 *
 * Satu endpoint untuk seluruh informasi yang dibutuhkan UI vendor:
 * - status periode (trial / active / grace / expired) + tanggal;
 * - pemakaian kuota trial booking & invoice beserta sisanya;
 * - izin aksi (boleh membuat booking/invoice?) yang menggabungkan validitas
 *   langganan dengan sisa kuota trial.
 *
 * Kuota hanya berlaku selama trial dan tidak direset saat berlangganan.
 */
class SubscriptionController extends Controller
{
    use ResolvesVendor;

    public function __construct(
        private readonly SubscriptionStatus $statuses,
        private readonly TrialQuota $quota,
    ) {
    }

    /**
     * GET /api/subscription
     */
    public function show(): JsonResponse
    {
        $vendor = $this->resolveVendor();

        $status = $this->statuses->resolve($vendor);

        /*
         * Masa uji berbasis waktu: tidak ada kuota transaksi lagi. `daysLeft`
         * dipakai frontend untuk "sisa N hari".
         */
        return response()->json([
            'status' => $status['status'],
            'endsAt' => $status['endsAt'],
            'graceEndsAt' => $status['graceEndsAt'],
            'daysLeft' => $this->quota->daysLeft($vendor),
            'canCreateBooking' => $status['canCreateInvoice'],
            'canCreateInvoice' => $status['canCreateInvoice'],
        ]);
    }
}
