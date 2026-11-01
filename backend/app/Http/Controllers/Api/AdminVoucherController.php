<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAdminVoucherRequest;
use App\Http\Requests\UpdateAdminVoucherRequest;
use App\Http\Resources\AdminVoucherResource;
use App\Models\Voucher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Manajemen voucher (`/admin/vouchers`).
 *
 * Admin membuat kode, melihat pemakaiannya, dan menonaktifkannya. Voucher
 * TIDAK dihapus permanen lewat endpoint ini — riwayat pemakaian harus tetap
 * ada. Untuk menghentikan kode, admin menonaktifkannya (`is_active = false`).
 */
class AdminVoucherController extends Controller
{
    /**
     * GET /api/admin/vouchers
     *
     * Mendukung filter `status` (active|inactive|expired|exhausted|scheduled)
     * dan pencarian `q` pada kode/deskripsi.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Voucher::query()->with('plan');

        if ($request->filled('q')) {
            $term = '%'.strtoupper(trim((string) $request->input('q'))).'%';
            $query->where(fn ($q) => $q
                ->whereRaw('UPPER(code) LIKE ?', [$term])
                ->orWhereRaw('UPPER(COALESCE(description, \'\')) LIKE ?', [$term]));
        }

        $vouchers = $query->orderByDesc('created_at')->orderByDesc('id')->get();

        // Filter status dilakukan setelah pengambilan karena `status` adalah
        // nilai turunan (gabungan beberapa kolom), bukan kolom tabel.
        if ($request->filled('status')) {
            $status = (string) $request->input('status');
            $vouchers = $vouchers->filter(fn (Voucher $v) => $v->statusKey() === $status)->values();
        }

        return response()->json(AdminVoucherResource::collection($vouchers)->resolve());
    }

    /**
     * POST /api/admin/vouchers
     */
    public function store(StoreAdminVoucherRequest $request): JsonResponse
    {
        $data = $request->normalized();

        // `is_active` default true: voucher yang baru dibuat harus langsung
        // bisa dipakai. Tanpa ini, kolom tidak ikut terisi (tidak ada di
        // validated()), dan default database tidak terpakai karena Eloquent
        // mengirim NULL eksplisit — akibatnya voucher baru langsung nonaktif.
        $data['is_active'] ??= true;

        $voucher = Voucher::create([
            ...$data,
            'used_count' => 0,
            'created_by' => $request->user()?->id,
        ]);

        return response()->json(
            (new AdminVoucherResource($voucher->load('plan')))->resolve(),
            201,
        );
    }

    /**
     * PATCH /api/admin/vouchers/{voucher}
     */
    public function update(UpdateAdminVoucherRequest $request, Voucher $voucher): JsonResponse
    {
        $voucher->fill($request->normalized())->save();

        return response()->json(
            (new AdminVoucherResource($voucher->refresh()->load('plan')))->resolve(),
        );
    }

    /**
     * PATCH /api/admin/vouchers/{voucher}/status
     *
     * Menyalakan / mematikan kode tanpa menghapus riwayatnya.
     */
    public function updateStatus(Request $request, Voucher $voucher): JsonResponse
    {
        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $voucher->forceFill(['is_active' => $validated['is_active']])->save();

        return response()->json(
            (new AdminVoucherResource($voucher->refresh()->load('plan')))->resolve(),
        );
    }
}
