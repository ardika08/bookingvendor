<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateAdminPlanRequest;
use App\Http\Resources\AdminPlanResource;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;

/**
 * Manajemen harga paket langganan (`/admin/plans`).
 *
 * PRD: Bulanan punya harga pasti; 3 Bulan & Tahunan disimpan sebagai
 * konfigurasi (`null` = "Segera" dan tidak bisa dibeli). Kuota TIDAK diatur di
 * sini — batas hanya milik masa trial dan konstan aplikasi.
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
     * PUT/PATCH /api/admin/plans/{plan}
     */
    public function update(UpdateAdminPlanRequest $request, Plan $plan): JsonResponse
    {
        $validated = $request->validated();

        if (array_key_exists('price', $validated)) {
            $plan->price = $validated['price'];
        }

        if (array_key_exists('is_active', $validated)) {
            $plan->is_active = (bool) $validated['is_active'];
        }

        $plan->save();

        return (new AdminPlanResource($plan))->response();
    }
}
