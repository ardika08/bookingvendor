<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Package;
use App\Models\Vendor;
use App\Models\VendorSchedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Jadwal publik vendor (tanpa akun).
 *
 * Dipakai calon klien untuk melihat tanggal yang masih kosong sebelum memesan.
 * Halaman ini dapat diakses siapa pun yang tahu slug vendor, jadi isinya
 * SENGAJA dibatasi:
 *
 *   - hanya tanggal yang tidak tersedia (bukan daftar booking),
 *   - tidak ada nama klien, nomor telepon, harga booking, atau catatan,
 *   - hanya satu bulan per permintaan.
 *
 * Membocorkan daftar booking di sini berarti membocorkan data pribadi klien
 * vendor ke publik, sehingga query-nya membaca penanda jadwal — bukan tabel
 * booking.
 */
class PublicScheduleController extends Controller
{
    /**
     * GET /api/public/schedules/{slug}?month=YYYY-MM
     */
    public function show(Request $request, string $slug): JsonResponse
    {
        $vendor = Vendor::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->first();

        if ($vendor === null) {
            return response()->json([
                'message' => 'Jadwal vendor tidak ditemukan atau tidak aktif.',
            ], 404);
        }

        $month = $this->resolveMonth($request->query('month'));

        $unavailable = VendorSchedule::query()
            ->where('vendor_id', $vendor->id)
            ->whereBetween('date', [
                $month->copy()->startOfMonth()->toDateString(),
                $month->copy()->endOfMonth()->toDateString(),
            ])
            ->orderBy('date')
            ->pluck('date')
            ->map(fn ($date) => $date instanceof \DateTimeInterface
                ? $date->format('Y-m-d')
                : substr((string) $date, 0, 10))
            ->unique()
            ->values()
            ->all();

        return response()->json([
            'vendor' => [
                'businessName' => $vendor->name,
                'category' => $vendor->category?->name,
                'location' => $vendor->location,
                'description' => $vendor->description,
                // Hanya paket aktif yang ditampilkan; paket nonaktif tidak
                // untuk dijual sehingga tidak relevan bagi calon klien.
                'packages' => $this->packages($vendor),
            ],
            'month' => $month->format('Y-m'),
            'unavailableDates' => $unavailable,
        ]);
    }

    /**
     * @return list<array{id: string, name: string, price: float, durationHours: int|null, description: string|null}>
     */
    private function packages(Vendor $vendor): array
    {
        return Package::query()
            ->where('vendor_id', $vendor->id)
            ->where('is_active', true)
            ->orderBy('price')
            ->get()
            ->map(fn (Package $package): array => [
                'id' => (string) $package->id,
                'name' => $package->name,
                'price' => (float) $package->price,
                'durationHours' => $package->duration_hours,
                'description' => $package->description,
            ])
            ->values()
            ->all();
    }

    /**
     * Bulan yang diminta, atau bulan berjalan bila tidak valid.
     *
     * Parameter yang tidak valid sengaja tidak menghasilkan galat: halaman
     * publik sebaiknya tetap tampil daripada menampilkan pesan teknis.
     */
    private function resolveMonth(mixed $value): Carbon
    {
        if (is_string($value) && preg_match('/^\d{4}-\d{2}$/', $value) === 1) {
            try {
                return Carbon::createFromFormat('Y-m', $value)->startOfMonth();
            } catch (\Throwable) {
                // jatuh ke bulan berjalan
            }
        }

        return now()->startOfMonth();
    }
}
