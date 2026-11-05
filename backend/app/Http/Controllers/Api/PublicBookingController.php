<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Addon;
use App\Models\Booking;
use App\Models\BookingAddon;
use App\Models\Package;
use App\Models\Vendor;
use App\Services\BookingScheduleSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

/**
 * Booking publik: calon klien memesan dari link jadwal vendor tanpa akun.
 *
 * Endpoint ini terbuka untuk publik, jadi:
 *   - di-rate-limit per IP+slug (anti spam/abuse);
 *   - harga TIDAK diterima dari klien — dihitung ulang di server dari paket
 *     dan addon yang tercatat pada pivot paket;
 *   - addon divalidasi milik paket dan tetap aktif;
 *   - status awal selalu `tentative`, vendor yang mengonfirmasi kemudian.
 */
class PublicBookingController extends Controller
{
    public function __construct(
        private readonly BookingScheduleSync $schedule,
    ) {
    }

    public function store(Request $request): JsonResponse
    {
        $slug = (string) $request->input('slug');

        $vendor = Vendor::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->first();

        if ($vendor === null) {
            return response()->json([
                'message' => 'Jadwal vendor tidak ditemukan atau tidak aktif.',
            ], 404);
        }

        // Rate limit: 5 percobaan per menit per IP+slug.
        $key = 'public-booking:'.sha1($request->ip().'|'.$vendor->id);
        if (! RateLimiter::attempt($key, 5, fn () => null, 60)) {
            return response()->json([
                'message' => 'Terlalu banyak percobaan. Coba lagi beberapa saat.',
            ], 429);
        }

        $validated = $this->validatePayload($request, $vendor);

        // Tanggal harus bebas sebelum kita coba simpan.
        if ($this->schedule->takenDates($vendor->id) !== []) {
            if (in_array($validated['event_date'], $this->schedule->takenDates($vendor->id), true)) {
                return response()->json([
                    'message' => 'Tanggal ini sudah ada booking lain. Pilih tanggal berbeda.',
                    'code' => 'date_taken',
                ], 422);
            }
        }

        [$booking, $client] = DB::transaction(function () use ($vendor, $validated) {
            $client = $this->resolveClient($vendor, $validated['client']);

            $booking = $vendor->bookings()->create([
                'client_id' => $client->id,
                'package_id' => $validated['package_id'],
                'event_date' => $validated['event_date'],
                'event_time' => $validated['event_time'] ?? null,
                'event_location' => $validated['event_location'] ?? null,
                'event_details' => $validated['notes'] ?? null,
                'status' => Booking::STATUS_TENTATIVE,
                'total_price' => $validated['total_price'],
            ]);

            $this->syncAddons($booking, $validated);

            $this->schedule->sync($booking);

            return [$booking, $client];
        });

        return response()->json([
            'message' => 'Booking berhasil dikirim. Vendor akan menghubungi Anda.',
            'booking' => [
                'id' => (string) $booking->id,
                'eventDate' => $booking->event_date->toDateString(),
                'status' => $booking->status,
                'totalPrice' => (float) $booking->total_price,
                'clientName' => $client->name,
            ],
        ], 201);
    }

    /**
     * Validasi payload booking publik.
     *
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, Vendor $vendor): array
    {
        /** @var Validator $validator */
        $validator = validator($request->all(), [
            'slug' => ['required', 'string'],
            'client' => ['required', 'array'],
            'client.name' => ['required', 'string', 'min:2', 'max:120'],
            'client.phone' => ['required', 'string', 'max:30'],
            'client.email' => ['nullable', 'email', 'max:120'],
            'event_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'event_time' => ['nullable', 'date_format:H:i'],
            'event_location' => ['nullable', 'string', 'max:255'],
            'package_id' => ['required', 'integer'],
            'addon_ids' => ['nullable', 'array'],
            'addon_ids.*' => ['integer'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], [
            'client.name.required' => 'Nama wajib diisi.',
            'client.name.min' => 'Nama terlalu pendek.',
            'client.phone.required' => 'Nomor WhatsApp wajib diisi.',
            'client.email.email' => 'Format email tidak valid.',
            'event_date.required' => 'Tanggal acara wajib diisi.',
            'event_date.after_or_equal' => 'Tanggal acara tidak boleh di masa lalu.',
            'package_id.required' => 'Paket wajib dipilih.',
            'event_time.date_format' => 'Format jam tidak valid (HH:MM).',
        ]);

        $validator->after(function (Validator $v) use ($request, $vendor): void {
            $this->validatePhone($v, $request);
            $this->validatePackageAndAddons($v, $request, $vendor);
        });

        $validator->validate();

        /** @var array<string, mixed> $data */
        $data = $validator->validated();

        // Harga final dihitung ulang di server dari paket + addon terpilih.
        $data['total_price'] = $this->calculateTotal($vendor, $data);

        return $data;
    }

    private function validatePhone(Validator $v, Request $request): void
    {
        $phone = preg_replace('/[\s\-().]/', '', (string) $request->input('client.phone'));

        if (! preg_match('/^(\+62|62|0)8[1-9][0-9]{6,11}$/', (string) $phone)) {
            $v->errors()->add('client.phone', 'Format nomor tidak valid. Contoh: 08123456789.');
        }
    }

    /**
     * Paket harus milik vendor + aktif; addon harus milik paket + aktif.
     */
    private function validatePackageAndAddons(Validator $v, Request $request, Vendor $vendor): void
    {
        $packageId = $request->integer('package_id');

        $package = Package::query()
            ->where('vendor_id', $vendor->id)
            ->where('is_active', true)
            ->find($packageId);

        if ($package === null) {
            $v->errors()->add('package_id', 'Paket tidak ditemukan.');

            return;
        }

        $addonIds = array_map('intval', (array) $request->input('addon_ids', []));

        if ($addonIds === []) {
            return;
        }

        $validAddons = $package->addons()
            ->where('is_active', true)
            ->pluck('addons.id')
            ->map(fn ($id) => (int) $id)
            ->all();

        foreach ($addonIds as $addonId) {
            if (! in_array($addonId, $validAddons, true)) {
                $v->errors()->add('addon_ids', 'Ada addon yang tidak tersedia di paket ini.');

                return;
            }
        }
    }

    /**
     * Hitung total = harga paket + harga khusus addon (pivot).
     *
     * @param  array<string, mixed>  $data
     */
    private function calculateTotal(Vendor $vendor, array $data): float
    {
        $package = Package::query()
            ->where('vendor_id', $vendor->id)
            ->findOrFail($data['package_id']);

        $total = (float) $package->price;

        $addonIds = array_map('intval', $data['addon_ids'] ?? []);

        if ($addonIds !== []) {
            $addons = $package->addons()
                ->whereIn('addons.id', $addonIds)
                ->get();

            foreach ($addons as $addon) {
                $total += (float) ($addon->pivot->price ?? $addon->price);
            }
        }

        return $total;
    }

    /**
     * Simpan snapshot addon pada booking (nama + harga pivot).
     *
     * @param  array<string, mixed>  $data
     */
    private function syncAddons(Booking $booking, array $data): void
    {
        $addonIds = array_map('intval', $data['addon_ids'] ?? []);

        if ($addonIds === []) {
            return;
        }

        /** @var Package $package */
        $package = Package::query()->findOrFail($data['package_id']);

        $addons = $package->addons()
            ->whereIn('addons.id', $addonIds)
            ->get();

        foreach ($addons as $addon) {
            /** @var Addon $addon */
            BookingAddon::query()->create([
                'booking_id' => $booking->id,
                'addon_id' => $addon->id,
                'name' => $addon->name,
                'price' => (float) ($addon->pivot->price ?? $addon->price),
            ]);
        }
    }

    /**
     * Klien dicocokkan lewat nomor telepon dalam lingkup vendor.
     *
     * @param  array{name: string, phone: string, email?: string|null}  $data
     */
    private function resolveClient(Vendor $vendor, array $data): \App\Models\Client
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
}
