<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Models\SubscriptionPayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Riwayat pembayaran langganan milik vendor.
 *
 * Bentuk `Payment` mengikuti tipe frontend: `pending|confirmed|rejected|expired`
 * — berbeda dari kolom database (`pending|paid|failed|expired|refunded`).
 */
class PaymentController extends Controller
{
    use ResolvesVendor;

    /**
     * GET /api/payments
     */
    public function index(Request $request): JsonResponse
    {
        $vendor = $this->resolveVendor();

        $query = SubscriptionPayment::query()
            ->with('plan')
            ->where('vendor_id', $vendor->id)
            ->orderByDesc('id');

        if ($request->filled('status') && $request->query('status') !== 'all') {
            $query->where('status', $request->query('status'));
        }

        $payments = $query->limit(100)->get();

        return response()->json(
            $payments->map(fn (SubscriptionPayment $payment): array => [
                'id' => (string) $payment->id,
                'reference' => $payment->order_id,
                'planId' => (string) $payment->plan_id,
                'planName' => $payment->plan?->name ?? 'Paket',
                'amount' => (int) round((float) $payment->amount),
                'status' => $this->mapStatus($payment),
                // Pembayaran kini lewat QRIS; field bank dipertahankan karena
                // tipe `Payment` di frontend mewajibkannya.
                'bank' => ['name' => '', 'accountNumber' => '', 'accountHolder' => ''],
                'createdAt' => $payment->created_at->toIso8601String(),
                'expiresAt' => $payment->expires_at?->toIso8601String(),
            ])->values(),
        );
    }

    private function mapStatus(SubscriptionPayment $payment): string
    {
        if ($payment->status === 'paid') {
            return 'confirmed';
        }

        if ($payment->status === 'pending'
            && $payment->expires_at !== null
            && $payment->expires_at->isPast()) {
            return 'expired';
        }

        return match ($payment->status) {
            'expired' => 'expired',
            'failed', 'refunded' => 'rejected',
            default => 'pending',
        };
    }
}
