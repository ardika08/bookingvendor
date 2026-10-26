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
        $booking = $this->quota->bookingUsage($vendor);
        $invoice = $this->quota->invoiceUsage($vendor);

        $subscriptionValid = $status['canCreateInvoice'];

        return response()->json([
            'status' => $status['status'],
            'endsAt' => $status['endsAt'],
            'graceEndsAt' => $status['graceEndsAt'],

            'trialBookingsUsed' => $booking['used'],
            'trialBookingsLimit' => $booking['limit'],
            'trialInvoicesUsed' => $invoice['used'],
            'trialInvoicesLimit' => $invoice['limit'],

            // null = tanpa batas (langganan aktif).
            'remainingBookings' => $booking['limited']
                ? max($booking['limit'] - $booking['used'], 0)
                : null,
            'remainingInvoices' => $invoice['limited']
                ? max($invoice['limit'] - $invoice['used'], 0)
                : null,

            'canCreateBooking' => $subscriptionValid && $this->quota->canCreateBooking($vendor),
            'canCreateInvoice' => $subscriptionValid && $this->quota->canCreateInvoice($vendor),
        ]);
    }
}
