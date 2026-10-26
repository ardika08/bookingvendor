<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminSubscriptionPaymentResource;
use App\Models\Vendor;
use Illuminate\Http\JsonResponse;

/**
 * Riwayat transaksi langganan per vendor untuk panel admin.
 *
 * Admin hanya **melihat** transaksi (pending/paid/failed/expired/refunded) —
 * sesuai PRD, tujuannya memantau pembayaran gateway yang bermasalah. Aksi
 * konfirmasi/aktivasi manual adalah endpoint terpisah.
 */
class AdminSubscriptionPaymentController extends Controller
{
    /**
     * GET /api/admin/vendors/{vendor}/payments
     */
    public function index(Vendor $vendor): JsonResponse
    {
        $payments = $vendor->subscriptionPayments()
            ->with('plan')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        return response()->json(
            AdminSubscriptionPaymentResource::collection($payments)->resolve(),
        );
    }
}
