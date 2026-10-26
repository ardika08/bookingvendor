<?php

namespace App\Services;

use App\Models\Vendor;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Validasi status langganan vendor.
 *
 * Nilai `subscriptions.status` di database hanya `trial`, `active`, `expired`,
 * `cancelled`. Status yang dilihat pengguna lebih kaya: `active` yang sudah
 * lewat `ends_at` masih bisa berstatus `grace` selama masa tenggang, baru
 * kemudian menjadi `expired`.
 *
 * Hasil resolusi dipakai middleware invoice untuk memutuskan boleh/tidaknya
 * vendor membuat invoice, beserta kode error yang dibaca frontend:
 * - `subscription_expired` → tampilkan ajakan perpanjang;
 * - `trial_limit_reached`   → buka `UpgradeModal`.
 */
class SubscriptionStatus
{
    public const TRIAL = 'trial';
    public const ACTIVE = 'active';
    public const GRACE = 'grace';
    public const EXPIRED = 'expired';

    public const CODE_EXPIRED = 'subscription_expired';

    public function graceDays(): int
    {
        return max((int) config('subscription.grace_days', 7), 0);
    }

    /**
     * Resolusi status langganan vendor pada tanggal tertentu.
     *
     * @return array{status: string, endsAt: ?string, graceEndsAt: ?string, canCreateInvoice: bool, code: ?string}
     */
    public function resolve(Vendor $vendor, ?Carbon $today = null): array
    {
        $today = ($today ?? now())->copy()->startOfDay();
        $subscription = $this->subscription($vendor);

        // Tabel/langganan belum ada: perlakukan sebagai trial tanpa batas
        // (penegakan kuota trial tetap berjalan di TrialQuota bila tersedia).
        if ($subscription === null) {
            return $this->result(self::TRIAL, null, null, true, null);
        }

        $endsAt = $this->parseDate($subscription->ends_at ?? null);

        return match ($subscription->status) {
            'trial' => $this->result(self::TRIAL, $endsAt, null, true, null),

            'active' => $this->resolveActive($endsAt, $today),

            // `cancelled` dan `expired` sama-sama tidak boleh membuat invoice.
            default => $this->result(
                self::EXPIRED,
                $endsAt,
                null,
                false,
                self::CODE_EXPIRED,
            ),
        };
    }

    /** True bila vendor boleh membuat invoice (status langganan saja). */
    public function canCreateInvoice(Vendor $vendor, ?Carbon $today = null): bool
    {
        return $this->resolve($vendor, $today)['canCreateInvoice'];
    }

    /** True bila langganan sudah lewat masa tenggang. */
    public function isExpired(Vendor $vendor, ?Carbon $today = null): bool
    {
        return $this->resolve($vendor, $today)['status'] === self::EXPIRED;
    }

    /** True bila sedang dalam masa tenggang. */
    public function isInGrace(Vendor $vendor, ?Carbon $today = null): bool
    {
        return $this->resolve($vendor, $today)['status'] === self::GRACE;
    }

    /** Nama status untuk ditampilkan di UI. */
    public function label(string $status): string
    {
        return match ($status) {
            self::ACTIVE => 'Langganan aktif',
            self::GRACE => 'Masa tenggang',
            self::EXPIRED => 'Langganan berakhir',
            default => 'Masa trial',
        };
    }

    /**
     * @return array{status: string, endsAt: ?string, graceEndsAt: ?string, canCreateInvoice: bool, code: ?string}
     */
    private function resolveActive(?Carbon $endsAt, Carbon $today): array
    {
        if ($endsAt === null) {
            return $this->result(self::ACTIVE, null, null, true, null);
        }

        if ($today->lessThanOrEqualTo($endsAt)) {
            return $this->result(self::ACTIVE, $endsAt, null, true, null);
        }

        $graceEndsAt = $endsAt->copy()->addDays($this->graceDays());

        if ($today->lessThanOrEqualTo($graceEndsAt)) {
            return $this->result(self::GRACE, $endsAt, $graceEndsAt, true, null);
        }

        return $this->result(self::EXPIRED, $endsAt, $graceEndsAt, false, self::CODE_EXPIRED);
    }

    /**
     * @return array{status: string, endsAt: ?string, graceEndsAt: ?string, canCreateInvoice: bool, code: ?string}
     */
    private function result(
        string $status,
        ?Carbon $endsAt,
        ?Carbon $graceEndsAt,
        bool $canCreateInvoice,
        ?string $code,
    ): array {
        return [
            'status' => $status,
            'endsAt' => $endsAt?->toDateString(),
            'graceEndsAt' => $graceEndsAt?->toDateString(),
            'canCreateInvoice' => $canCreateInvoice,
            'code' => $code,
        ];
    }

    /** Langganan trial/aktif terbaru milik vendor. */
    private function subscription(Vendor $vendor): ?object
    {
        if (! Schema::hasTable('subscriptions')) {
            return null;
        }

        return DB::table('subscriptions')
            ->where('vendor_id', $vendor->id)
            ->whereIn('status', ['trial', 'active', 'expired', 'cancelled'])
            ->orderByDesc('id')
            ->first();
    }

    private function parseDate(?string $value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        return Carbon::parse($value)->startOfDay();
    }
}
