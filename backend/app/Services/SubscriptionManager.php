<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Support\Carbon;

/**
 * Aktivasi & perpanjangan langganan manual oleh admin.
 *
 * Dipakai saat webhook gateway gagal atau vendor membayar di luar gateway
 * (PRD: "Aktivasi Manual oleh Admin (Fallback)"). Aturan tanggal:
 * - perpanjangan **menambahkan** durasi paket ke tanggal berakhir yang ada;
 * - bila langganan sudah lewat (expired/cancelled) atau belum pernah aktif,
 *   hitungan dimulai dari hari ini;
 * - trial diganti menjadi aktif tanpa menyentuh penghitung trial (kuota tidak
 *   direset — pemakaian trial tetap tercatat).
 */
class SubscriptionManager
{
    /**
     * Perpanjang / aktifkan langganan vendor dengan paket tertentu.
     */
    public function renew(Vendor $vendor, Plan $plan, ?User $activatedBy = null): Subscription
    {
        $today = Carbon::today();
        $current = $this->latestSubscription($vendor);

        $baseDate = $this->renewalBaseDate($current, $today);

        $subscription = $current ?? new Subscription(['vendor_id' => $vendor->id]);

        $subscription->fill([
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'starts_at' => $subscription->starts_at ?? $today->toDateString(),
            'ends_at' => $baseDate->copy()->addMonths($plan->duration_months)->toDateString(),
            'activated_by' => $activatedBy?->id,
        ]);

        // Penghitung trial sengaja tidak disentuh.
        $subscription->save();

        return $subscription->refresh();
    }

    /**
     * Titik mulai perpanjangan: tanggal berakhir yang masih berlaku, atau hari
     * ini bila langganan sudah lewat/belum ada.
     */
    private function renewalBaseDate(?Subscription $current, Carbon $today): Carbon
    {
        if ($current === null || $current->ends_at === null) {
            return $today;
        }

        $endsAt = $current->ends_at->copy()->startOfDay();

        if ($current->status === Subscription::STATUS_ACTIVE && $endsAt->greaterThanOrEqualTo($today)) {
            return $endsAt;
        }

        return $today;
    }

    /** Baris langganan terbaru milik vendor (apa pun statusnya). */
    private function latestSubscription(Vendor $vendor): ?Subscription
    {
        return Subscription::query()
            ->where('vendor_id', $vendor->id)
            ->orderByDesc('id')
            ->first();
    }
}
