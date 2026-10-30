<?php

namespace App\Http\Middleware;

use App\Models\Booking;
use App\Services\SubscriptionStatus;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware penjaga pembuatan invoice.
 *
 * Menegakkan **batas waktu** langganan/masa uji: vendor yang masa aktifnya
 * sudah lewat ditolak dengan kode `subscription_expired` (frontend menampilkan
 * ajakan memperpanjang).
 *
 * Kuota jumlah invoice sudah dihapus — trial kini berbasis waktu, sehingga
 * selama masa uji vendor boleh menerbitkan invoice sebanyak yang dibutuhkan.
 * Nama kelas dipertahankan agar alias middleware `invoice.trial` dan tes lama
 * tidak perlu diubah.
 *
 * Vendor diturunkan dari booking pada route (`bookings/{booking}`). Validasi
 * payload tetap menjadi tanggung jawab FormRequest.
 */
class EnsureInvoiceTrialQuota
{
    public function __construct(
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

        if (! $status['canCreateInvoice']) {
            return response()->json([
                'message' => 'Masa aktif sudah berakhir. Perpanjang paket untuk membuat invoice baru.',
                'code' => $status['code'] ?? SubscriptionStatus::CODE_EXPIRED,
            ], 422);
        }

        return $next($request);
    }
}
