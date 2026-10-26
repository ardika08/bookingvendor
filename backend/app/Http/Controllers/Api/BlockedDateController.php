<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBlockedDateRequest;
use App\Http\Resources\BlockedDateResource;
use App\Models\VendorSchedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Blokir / lepas blokir tanggal ketersediaan vendor.
 *
 * Fitur kalender: vendor menutup tanggal yang sengaja tidak menerima booking
 * (libur, acara pribadi). Tanggal yang **sudah ditempati booking aktif** tidak
 * bisa diblokir — jalurnya lewat perubahan status booking, karena penanda
 * `booked` dikelola otomatis.
 */
class BlockedDateController extends Controller
{
    use ResolvesVendor;

    /**
     * Daftar tanggal terblokir vendor.
     *
     * GET /api/blocked-dates
     * Hanya penanda `blocked`; tanggal `booked` datang dari daftar booking.
     */
    public function index(Request $request): JsonResponse
    {
        $vendor = $this->resolveVendor();
        $query = $vendor->schedules()->blocked();

        // Filter opsional per bulan (`YYYY-MM`) untuk kalender yang hanya
        // memuat satu bulan.
        if ($month = $request->query('month')) {
            $query->whereYear('date', (int) substr((string) $month, 0, 4))
                ->whereMonth('date', (int) substr((string) $month, 5, 2));
        }

        $dates = $query->orderBy('date')->get();

        return response()->json(BlockedDateResource::collection($dates)->resolve());
    }

    /**
     * POST /api/blocked-dates
     */
    public function store(StoreBlockedDateRequest $request): JsonResponse
    {
        $vendor = $this->resolveVendor();
        $validated = $request->validated();
        $date = $validated['date'];

        $existing = $vendor->schedules()->whereDate('date', $date)->first();

        if ($existing !== null) {
            return $existing->isBlocked()
                ? $this->reject('date', 'Tanggal ini sudah diblokir.')
                : $this->reject('date', 'Tanggal ini sudah ditempati booking aktif dan tidak bisa diblokir.');
        }

        // Jaring pengaman bila penanda `booked` sempat tidak tersinkron.
        $occupied = $vendor->bookings()
            ->occupyingDate()
            ->whereDate('event_date', $date)
            ->exists();

        if ($occupied) {
            return $this->reject('date', 'Tanggal ini sudah ditempati booking aktif dan tidak bisa diblokir.');
        }

        $schedule = $vendor->schedules()->create([
            'date' => $date,
            'type' => VendorSchedule::TYPE_BLOCKED,
            'note' => $validated['reason'] ?? null,
        ]);

        return (new BlockedDateResource($schedule))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * DELETE /api/blocked-dates/{blockedDate}
     */
    public function destroy(VendorSchedule $blockedDate): JsonResponse
    {
        // Hanya penanda milik vendor yang sedang login.
        if ($blockedDate->vendor_id !== $this->resolveVendor()->id) {
            abort(404);
        }

        if ($blockedDate->type !== VendorSchedule::TYPE_BLOCKED) {
            return response()->json([
                'message' => 'Penanda otomatis dari booking dihapus lewat perubahan status booking.',
            ], 422);
        }

        $blockedDate->delete();

        return response()->json(null, 204);
    }

    private function reject(string $field, string $message): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'errors' => [$field => [$message]],
        ], 422);
    }
}
