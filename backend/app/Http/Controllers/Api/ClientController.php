<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Http\Resources\ClientResource;
use App\Models\Booking;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Daftar klien milik vendor yang sedang login.
 *
 * Klien dibuat otomatis saat booking pertama disimpan, jadi tabel ini adalah
 * cermin dari riwayat booking. Endpoint di sini hanya untuk membaca dan
 * merapikan data kontak; penambahan klien tetap lewat form booking supaya
 * tidak pernah ada klien tanpa booking yang menggantung.
 *
 * Vendor selalu berasal dari sesi login, dan setiap query difilter dengan
 * `vendor_id` — bukan hanya lewat relasi — agar tidak ada jalan membaca klien
 * milik vendor lain.
 */
class ClientController extends Controller
{
    use ResolvesVendor;

    /**
     * GET /api/clients?q=&sort=&page=&per_page=
     *
     * Seperti daftar booking, tanpa `page` endpoint mengembalikan array polos.
     * Bentuk itu dipakai halaman yang perlu menghitung agregat sendiri tanpa
     * memikirkan paginasi.
     */
    public function index(Request $request): JsonResponse
    {
        $vendor = $this->resolveVendor();

        $query = $this->baseQuery($vendor->id);

        if ($keyword = trim((string) $request->query('q'))) {
            $query->where(function ($match) use ($keyword) {
                $match->where('name', 'like', '%' . $keyword . '%')
                    ->orWhere('phone', 'like', '%' . $keyword . '%')
                    ->orWhere('email', 'like', '%' . $keyword . '%');
            });
        }

        $this->applySort($query, (string) $request->query('sort', 'recent'));

        if (! $request->has('page')) {
            return response()->json(
                ClientResource::collection($query->get())->resolve(),
            );
        }

        $perPage = max(1, min((int) $request->query('per_page', 10), 100));
        $page = max(1, (int) $request->query('page', 1));

        $total = (clone $query)->count();
        $items = $query->forPage($page, $perPage)->get();

        return response()->json([
            'items' => ClientResource::collection($items)->resolve(),
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
        ]);
    }

    /**
     * GET /api/clients/{client}
     *
     * Detail satu klien beserta ringkasan booking-nya. Klien milik vendor lain
     * dijawab 404, bukan 403: keberadaannya tidak perlu dibocorkan.
     */
    public function show(Client $client): JsonResponse
    {
        $vendor = $this->resolveVendor();

        abort_unless($client->vendor_id === $vendor->id, 404);

        $client->loadCount('bookings');
        $client->loadSum('bookings', 'total_price');

        $latest = $client->bookings()
            ->orderByDesc('event_date')
            ->first(['event_date', 'status']);

        $client->last_event_date = optional($latest?->event_date)->toDateString();
        $client->last_status = $latest?->status;

        return response()->json(
            (new ClientResource($client))->resolve(),
        );
    }

    /**
     * Query dasar: klien vendor ini + agregat booking.
     *
     * `withCount`/`withSum` memakai subquery sehingga satu halaman tetap satu
     * query, berapa pun jumlah kliennya.
     */
    private function baseQuery(int $vendorId)
    {
        return Client::query()
            ->where('vendor_id', $vendorId)
            ->withCount('bookings')
            ->withSum('bookings', 'total_price')
            ->addSelect([
                // Booking terakhir dipakai untuk kolom "terakhir booking".
                'last_event_date' => Booking::query()
                    ->select('event_date')
                    ->whereColumn('client_id', 'clients.id')
                    ->orderByDesc('event_date')
                    ->limit(1),
                'last_status' => Booking::query()
                    ->select('status')
                    ->whereColumn('client_id', 'clients.id')
                    ->orderByDesc('event_date')
                    ->limit(1),
            ]);
    }

    /**
     * Urutan daftar. Default `recent` = aktivitas terbaru lebih dulu, karena
     * vendor biasanya mencari klien yang baru menghubungi.
     */
    private function applySort($query, string $sort): void
    {
        match ($sort) {
            'name' => $query->orderBy('name'),
            'value' => $query->orderByDesc('bookings_sum_total_price'),
            'bookings' => $query->orderByDesc('bookings_count'),
            default => $query->orderByDesc('last_event_date')->orderByDesc('id'),
        };
    }
}
