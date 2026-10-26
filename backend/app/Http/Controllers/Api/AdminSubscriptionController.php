<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RenewSubscriptionRequest;
use App\Http\Resources\SubscriptionResource;
use App\Models\Plan;
use App\Models\Vendor;
use App\Services\SubscriptionManager;
use Illuminate\Http\JsonResponse;

/**
 * Aktivasi & perpanjangan langganan manual oleh admin.
 *
 * Fallback saat webhook gateway gagal atau vendor membayar di luar gateway
 * (PRD). Admin memilih paket; masa aktif dihitung dari tanggal berakhir yang
 * masih berlaku, atau dari hari ini bila langganan sudah lewat.
 */
class AdminSubscriptionController extends Controller
{
    public function __construct(private readonly SubscriptionManager $subscriptions)
    {
    }

    /**
     * POST /api/admin/vendors/{vendor}/subscriptions/renew
     */
    public function renew(RenewSubscriptionRequest $request, Vendor $vendor): JsonResponse
    {
        $plan = Plan::query()->findOrFail($request->validated('plan_id'));

        $subscription = $this->subscriptions->renew(
            $vendor,
            $plan,
            $request->user(),
        );

        $subscription->load('plan');

        // Aksi aktivasi/perpanjangan selalu 200 — walau baris dibuat baru,
        // semantiknya bukan "resource baru", melainkan perubahan status akun.
        return (new SubscriptionResource($subscription))
            ->response()
            ->setStatusCode(200);
    }
}
