<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Daftar booking untuk dashboard vendor.
 *
 * `incoming` mengembalikan pesanan yang menunggu tindakan vendor (status
 * `tentative`) — kartu "Pesanan masuk" di dashboard. Urutan: tanggal acara
 * terdekat dulu, lalu jam.
 */
class BookingController extends Controller
{
    use ResolvesVendor;

    /**
     * GET /api/bookings/incoming?limit=&month=
     */
    public function incoming(Request $request): JsonResponse
    {
        $vendor = $this->resolveVendor();

        $query = $vendor->bookings()
            ->where('status', Booking::STATUS_TENTATIVE)
            ->with('client', 'package')
            ->withCount('invoices')
            ->orderBy('event_date')
            ->orderBy('event_time');

        if ($month = $request->query('month')) {
            $query->inMonth((string) $month);
        }

        $total = (clone $query)->count();

        $limit = (int) $request->query('limit', 0);
        $items = $limit > 0
            ? $query->limit($limit)->get()
            : $query->get();

        return response()->json([
            'items' => BookingResource::collection($items)->resolve(),
            'total' => $total,
        ]);
    }
}
