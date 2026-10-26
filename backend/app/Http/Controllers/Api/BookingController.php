<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Http\Requests\UpdateBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\Client;
use App\Models\Vendor;
use App\Services\BookingScheduleSync;
use App\Services\SubscriptionStatus;
use App\Services\TrialQuota;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Endpoint booking dashboard vendor.
 *
 * `index` melayani dua bentuk permintaan sekaligus:
 * - dengan `page`/`per_page` → `{ items, total, page, perPage }` untuk tabel
 *   berhalaman;
 * - tanpa `page` → daftar polos `Booking[]`, dipakai dashboard untuk menghitung
 *   agregat (`fetchAllBookings` di frontend).
 *
 * Vendor selalu berasal dari sesi login; tidak ada id vendor yang dikirim klien.
 */
class BookingController extends Controller
{
    use ResolvesVendor;

    public function __construct(
        private readonly BookingScheduleSync $schedule,
        private readonly TrialQuota $quota,
        private readonly SubscriptionStatus $subscription,
    ) {
    }

    /**
     * GET /api/bookings?month=&status=&q=&page=&per_page=&sort=
     */
    public function index(Request $request): JsonResponse
    {
        $vendor = $this->resolveVendor();

        $query = $vendor->bookings()
            ->with('client', 'package')
            ->withCount('invoices');

        if ($month = $request->query('month')) {
            $query->inMonth((string) $month);
        }

        if (($status = $request->query('status')) && $status !== 'all') {
            $query->where('status', $status);
        }

        if ($keyword = trim((string) $request->query('q'))) {
            // Cari pada nama & nomor klien, sesuai kotak pencarian di UI.
            $query->whereHas('client', function ($inner) use ($keyword) {
                $inner->where(function ($match) use ($keyword) {
                    $match->where('name', 'like', '%' . $keyword . '%')
                        ->orWhere('phone', 'like', '%' . $keyword . '%');
                });
            });
        }

        $query->orderBy('event_date')->orderBy('event_time');

        // Tanpa `page` frontend meminta seluruh baris (dipakai untuk agregat).
        if (! $request->has('page')) {
            return response()->json(
                BookingResource::collection($query->get())->resolve(),
            );
        }

        $perPage = (int) $request->query('per_page', 10);
        $perPage = max(1, min($perPage, 100));

        $total = (clone $query)->count();
        $page = max(1, (int) $request->query('page', 1));

        $items = $query->forPage($page, $perPage)->get();

        return response()->json([
            'items' => BookingResource::collection($items)->resolve(),
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
        ]);
    }

    /**
     * GET /api/bookings/incoming?limit=&month=
     *
     * Pesanan yang menunggu tindakan vendor (status `tentative`).
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

    /**
     * GET /api/bookings/taken-dates?exclude=
     *
     * Tanggal yang sudah ditempati booking aktif atau diblokir vendor.
     */
    public function takenDates(Request $request): JsonResponse
    {
        $vendor = $this->resolveVendor();

        $exclude = $request->query('exclude');
        $excludeId = $exclude !== null && $exclude !== '' ? (int) $exclude : null;

        return response()->json(
            $this->schedule->takenDates($vendor->id, $excludeId),
        );
    }

    /**
     * GET /api/bookings/{booking}
     */
    public function show(Booking $booking): JsonResponse
    {
        $this->authorizeBooking($booking);

        $booking->load('client', 'package')->loadCount('invoices');

        return (new BookingResource($booking))->response();
    }

    /**
     * POST /api/bookings
     *
     * Klien dicocokkan lewat nomor telepon dalam lingkup vendor: pelanggan yang
     * memesan dua kali memakai baris klien yang sama, tetapi nomor yang sama
     * milik vendor lain tetap menjadi klien terpisah.
     */
    public function store(StoreBookingRequest $request): JsonResponse
    {
        $vendor = $this->resolveVendor();

        // Dua lapis penjagaan langganan, sama seperti pembuatan invoice.
        $status = $this->subscription->resolve($vendor);

        if (! $status['canCreateBooking']) {
            return response()->json([
                'message' => 'Langganan sudah berakhir. Perpanjang paket untuk membuat booking baru.',
                'code' => $status['code'] ?? SubscriptionStatus::CODE_EXPIRED,
            ], 422);
        }

        if ($status['status'] === SubscriptionStatus::TRIAL
            && ! $this->quota->canCreateBooking($vendor)) {
            return response()->json([
                'message' => 'Jatah trial booking sudah habis. Berlangganan untuk membuat booking tanpa batas.',
                'code' => TrialQuota::CODE,
            ], 422);
        }

        $validated = $request->validated();

        $booking = DB::transaction(function () use ($vendor, $validated) {
            $client = $this->resolveClient($vendor, $validated['client']);

            $booking = $vendor->bookings()->create([
                'client_id' => $client->id,
                'package_id' => $validated['package_id'] ?? null,
                'event_date' => $validated['event_date'],
                'event_time' => $validated['event_time'] ?? null,
                'event_location' => $validated['event_location'] ?? null,
                'event_details' => $validated['notes'] ?? null,
                'status' => $validated['status'],
                'total_price' => $validated['total_price'],
            ]);

            $this->schedule->sync($booking);

            return $booking;
        });

        $this->quota->recordBookingUsage($vendor);

        $booking->load('client', 'package')->loadCount('invoices');

        return (new BookingResource($booking))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * PUT/PATCH /api/bookings/{booking}
     */
    public function update(UpdateBookingRequest $request, Booking $booking): JsonResponse
    {
        $this->authorizeBooking($booking);

        $validated = $request->validated();

        DB::transaction(function () use ($booking, $validated) {
            $client = $this->resolveClient($booking->vendor, $validated['client']);

            $booking->fill([
                'client_id' => $client->id,
                'package_id' => $validated['package_id'] ?? null,
                'event_date' => $validated['event_date'],
                'event_time' => $validated['event_time'] ?? null,
                'event_location' => $validated['event_location'] ?? null,
                'event_details' => $validated['notes'] ?? null,
                'status' => $validated['status'],
                'total_price' => $validated['total_price'],
            ])->save();

            // Tanggal bisa berubah: lepas penanda lama, buat yang baru.
            $this->schedule->sync($booking);
        });

        $booking->load('client', 'package')->loadCount('invoices');

        return (new BookingResource($booking))->response();
    }

    /**
     * PATCH /api/bookings/{booking}/status
     *
     * Hanya transisi yang sah yang diterima; perubahan status ikut menyegarkan
     * penanda kalender (batal melepas tanggal, konfirmasi menempatinya).
     */
    public function updateStatus(Request $request, Booking $booking): JsonResponse
    {
        $this->authorizeBooking($booking);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:tentative,confirmed,completed,cancelled'],
        ], [
            'status.required' => 'Status wajib diisi.',
            'status.in' => 'Status tidak dikenal.',
        ]);

        $target = $validated['status'];

        if ($target !== $booking->status && ! $booking->canTransitionTo($target)) {
            return response()->json([
                'message' => 'Status tidak bisa diubah dari "' . $booking->status
                    . '" ke "' . $target . '".',
                'code' => 'invalid_status_transition',
            ], 422);
        }

        // Booking batal yang diaktifkan kembali harus mengecek tanggalnya bebas.
        if ($booking->isCancelled() && in_array($target, Booking::OCCUPYING_STATUSES, true)) {
            $taken = $this->schedule->takenDates($booking->vendor_id, $booking->id);

            if (in_array($booking->event_date->toDateString(), $taken, true)) {
                return response()->json([
                    'message' => 'Tanggal booking ini sudah dipakai booking lain.',
                    'code' => 'date_taken',
                ], 422);
            }
        }

        DB::transaction(function () use ($booking, $target) {
            $booking->status = $target;
            $booking->save();

            $this->schedule->sync($booking);
        });

        $booking->load('client', 'package')->loadCount('invoices');

        return (new BookingResource($booking))->response();
    }

    /**
     * Klien untuk payload booking.
     *
     * Dicocokkan berdasarkan nomor telepon yang sudah dinormalkan dalam lingkup
     * vendor. Data yang dikirim form dianggap sumber terbaru, jadi nama/email
     * ikut diperbarui bila berubah.
     *
     * @param  array{name: string, phone: string, email?: string|null}  $data
     */
    private function resolveClient(Vendor $vendor, array $data): Client
    {
        $phone = preg_replace('/[\s\-().]/', '', $data['phone']);

        $client = $vendor->clients()
            ->where('phone', $phone)
            ->first();

        $attributes = [
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
        ];

        if ($client === null) {
            return $vendor->clients()->create([
                'phone' => $phone,
                ...$attributes,
            ]);
        }

        $client->fill($attributes)->save();

        return $client;
    }

    /** Booking hanya boleh diakses pemilik vendor-nya. */
    private function authorizeBooking(Booking $booking): void
    {
        if ($booking->vendor_id !== $this->resolveVendor()->id) {
            abort(404);
        }
    }
}
