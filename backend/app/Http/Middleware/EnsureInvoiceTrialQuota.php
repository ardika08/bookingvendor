<?php

namespace App\Http\Middleware;

use App\Models\Booking;
use App\Services\SubscriptionStatus;
use App\Services\TrialQuota;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware pembatas pembuatan invoice.
 *
 * Dua lapis pemeriksaan, berurutan:
 * 1. **Status langganan** — vendor yang langganannya sudah lewat masa tenggang
 *    ditolak dengan kode `subscription_expired` (perlu perpanjang paket).
 * 2. **Kuota trial** — selama trial, jumlah invoice dibatasi
 *    `config('trial.invoices_limit')`; bila habis, ditolak dengan kode
 *    `trial_limit_reached` (frontend membuka `UpgradeModal`).
 *
 * Vendor diturunkan dari booking pada route (`bookings/{booking}`). Validasi
 * payload tetap menjadi tanggung jawab FormRequest.
 */
class EnsureInvoiceTrialQuota
{
    public function __construct(
        private readonly TrialQuota $quota,
        private readonly SubscriptionStatus $subscription,
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $booking = $request->route('booking');

        if (! $booking instanceof Booking) {
            return $next($request);
        }

        $vendor = $booking->vendor;
        $status = $this->subscription->resolve($vendor);

        // Langganan sudah lewat masa tenggang: tidak boleh membuat invoice.
        if (! $status['canCreateInvoice']) {
            return response()->json([
                'message' => 'Langganan sudah berakhir. Perpanjang paket untuk membuat invoice baru.',
                'code' => $status['code'] ?? SubscriptionStatus::CODE_EXPIRED,
            ], 422);
        }

        // Selama trial, jatah invoice tetap dibatasi.
        if ($status['status'] === SubscriptionStatus::TRIAL
            && ! $this->quota->canCreateInvoice($vendor)) {
            return response()->json([
                'message' => $this->quota->rejectionMessage(),
                'code' => TrialQuota::CODE,
            ], 422);
        }

        return $next($request);
    }
}
