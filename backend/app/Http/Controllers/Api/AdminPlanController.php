<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAdminPlanRequest;
use App\Http\Requests\UpdateAdminPlanRequest;
use App\Http\Resources\AdminPlanResource;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Manajemen katalog paket langganan (`/admin/plans`).
 *
 * Admin bisa menambah, mengubah, dan menghapus paket. Kuota TIDAK diatur di
 * sini — batas hanya milik masa trial dan konstan aplikasi.
 *
 * Istilah harga mengikuti pemilik produk:
 * - `price`        = harga coret / harga promo, angka yang DIBAYAR vendor.
 * - `normal_price` = harga normal sebelum diskon, ditampilkan dicoret.
 */
class AdminPlanController extends Controller
{
    /**
     * GET /api/admin/plans
     */
    public function index(): JsonResponse
    {
        $plans = Plan::query()
            ->orderBy('duration_months')
            ->orderBy('id')
            ->get();

        return response()->json(AdminPlanResource::collection($plans)->resolve());
    }

    /**
     * POST /api/admin/plans
     */
    public function store(StoreAdminPlanRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $code = $this->uniqueCode($validated['name']);

        $plan = Plan::create([
            'code' => $code,
            'name' => $validated['name'],
            'duration_months' => $validated['duration_months'],
            'price' => $validated['price'] ?? null,
            'normal_price' => $validated['normal_price'] ?? null,
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return (new AdminPlanResource($plan))->response()->setStatusCode(201);
    }

    /**
     * PUT/PATCH /api/admin/plans/{plan}
     */
    public function update(UpdateAdminPlanRequest $request, Plan $plan): JsonResponse
    {
        $validated = $request->validated();

        foreach (['name', 'duration_months', 'price', 'normal_price', 'description'] as $field) {
            if (array_key_exists($field, $validated)) {
                $plan->{$field} = $validated[$field];
            }
        }

        if (array_key_exists('is_active', $validated)) {
            $plan->is_active = (bool) $validated['is_active'];
        }

        $plan->save();

        return (new AdminPlanResource($plan))->response();
    }

    /**
     * DELETE /api/admin/plans/{plan}
     *
     * Paket yang sudah pernah dipakai vendor TIDAK boleh dihapus: tabel
     * `subscriptions` dan `subscription_payments` merujuk ke sini, dan
     * menghapusnya akan memutus riwayat pembayaran. Paket seperti itu
     * dinonaktifkan saja (tidak tampil di katalog) supaya riwayat tetap utuh.
     */
    public function destroy(Plan $plan): JsonResponse
    {
        $usedBySubscriptions = $plan->subscriptions()->exists();
        $usedByPayments = $plan->payments()->exists();

        if ($usedBySubscriptions || $usedByPayments) {
            return response()->json([
                'message' => 'Paket ini sudah dipakai vendor sehingga tidak bisa dihapus. '
                    .'Nonaktifkan saja agar tidak tampil di katalog — riwayat pembayaran tetap utuh.',
                'code' => 'plan_in_use',
            ], 409);
        }

        $plan->delete();

        return response()->json(['deleted' => true]);
    }

    /**
     * Kode unik dari nama paket.
     *
     * Kolom `code` sekarang string biasa (dulu ENUM tiga nilai), jadi paket
     * apa pun bisa dibuat. Katalog memakai `code === 'yearly'` hanya untuk
     * menandai paket sorotan, jadi nama yang menyebut "tahun" dipetakan ke
     * `yearly` bila belum terpakai.
     */
    private function uniqueCode(string $name): string
    {
        $lower = Str::lower($name);

        if (Str::contains($lower, ['tahun', 'year'])) {
            $slug = 'yearly';
        } elseif (Str::contains($lower, ['3 bulan', 'tiga bulan', 'quarter'])) {
            $slug = 'quarterly';
        } else {
            $slug = Str::slug($name, '_');
            if ($slug === '') {
                $slug = 'paket';
            }
        }

        $base = $slug;
        $suffix = 2;

        while (Plan::where('code', $slug)->exists()) {
            $slug = $base.'_'.$suffix;
            $suffix++;
        }

        return $slug;
    }
}
