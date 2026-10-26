<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePackageRequest;
use App\Http\Requests\UpdatePackageRequest;
use App\Http\Resources\PackageResource;
use App\Models\Package;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD katalog paket layanan vendor (`/packages`).
 *
 * Paket dipakai ulang saat membuat booking, jadi perubahan di sini langsung
 * memengaruhi pilihan harga di form booking berikutnya.
 *
 * Aturan penghapusan yang ketat: paket yang **sudah dipakai booking** tidak
 * boleh dihapus — nominalnya sudah tercetak di invoice. Jalurnya dinonaktifkan
 * (`active = false`) supaya tidak muncul di form booking, sementara riwayat
 * tetap mengacu ke harga yang benar.
 */
class PackageController extends Controller
{
    use ResolvesVendor;

    /**
     * Daftar paket vendor.
     *
     * GET /api/packages?active=1|0&q=
     * Aktif ditampilkan lebih dulu, lalu harga termurah — sama seperti urutan
     * yang diharapkan form pemilihan cepat di halaman booking.
     */
    public function index(Request $request): JsonResponse
    {
        $vendor = $this->resolveVendor();
        $query = $vendor->packages()->withCount('bookings');

        $active = $request->query('active');
        if ($active !== null && $active !== '') {
            $query->where('is_active', $active === '1');
        }

        $keyword = trim((string) $request->query('q', ''));
        if ($keyword !== '') {
            $query->where('name', 'like', "%{$keyword}%");
        }

        $packages = $query
            ->orderByDesc('is_active')
            ->orderBy('price')
            ->orderBy('name')
            ->get();

        return response()->json(PackageResource::collection($packages)->resolve());
    }

    /**
     * POST /api/packages
     */
    public function store(StorePackageRequest $request): JsonResponse
    {
        $vendor = $this->resolveVendor();

        $package = $vendor->packages()->create([
            'name' => $request->validated('name'),
            'price' => $request->validated('price'),
            'description' => $request->validated('description'),
            'duration_hours' => $request->validated('duration_hours'),
            'is_active' => $request->boolean('active', true),
        ]);

        return (new PackageResource($package->loadCount('bookings')))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * PUT/PATCH /api/packages/{package}
     */
    public function update(UpdatePackageRequest $request, Package $package): JsonResponse
    {
        $this->authorizePackage($package);

        $validated = $request->validated();

        foreach (['name', 'price', 'duration_hours', 'description'] as $field) {
            if (array_key_exists($field, $validated)) {
                $package->{$field} = $validated[$field];
            }
        }

        if (array_key_exists('active', $validated)) {
            $package->is_active = (bool) $validated['active'];
        }

        $package->save();

        return (new PackageResource($package->loadCount('bookings')))->response();
    }

    /**
     * DELETE /api/packages/{package}
     */
    public function destroy(Package $package): JsonResponse
    {
        $this->authorizePackage($package);

        if ($package->bookings()->exists()) {
            return response()->json([
                'message' => 'Paket sudah dipakai booking. Nonaktifkan saja supaya riwayat tetap akurat.',
            ], 422);
        }

        $package->delete();

        return response()->json(null, 204);
    }

    /**
     * Pastikan paket milik vendor yang sedang login.
     *
     * Route-model binding hanya menjamin barisnya ada; tanpa cek ini vendor
     * bisa mengubah atau menghapus paket vendor lain lewat id.
     */
    private function authorizePackage(Package $package): void
    {
        if ($package->vendor_id !== $this->resolveVendor()->id) {
            abort(404);
        }
    }
}
