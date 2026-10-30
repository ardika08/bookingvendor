<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\Vendor;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Aktivasi langganan setelah pembayaran dikonfirmasi gateway.
 *
 * Dipisahkan dari controller karena dipakai dua jalur: webhook Duitku dan
 * aktivasi manual oleh admin. Keduanya harus berperilaku identik.
 *
 * Sifat penting:
 * - **Idempoten.** Webhook Duitku bisa terkirim lebih dari sekali untuk
 *   transaksi yang sama. Memanggil `activate()` dua kali tidak menambah masa
 *   aktif dua kali.
 * - **Memperpanjang, bukan menimpa.** Bila vendor masih aktif, masa aktif baru
 *   dihitung dari `ends_at` lama sehingga sisa harinya tidak hangus.
 */
class SubscriptionActivator
{
    /**
     * Tandai transaksi lunas dan aktifkan/perpanjang langganan vendor.
     *
     * @return bool True bila status berubah pada pemanggilan ini; false bila
     *              transaksi sudah pernah diproses (idempoten).
     */
    public function activate(SubscriptionPayment $payment, ?Carbon $paidAt = null): bool
    {
        if ($payment->status === 'paid') {
            return false;
        }

        $paidAt ??= now();

        $activated = DB::transaction(function () use ($payment, $paidAt): bool {
            $plan = $payment->plan;

            if ($plan === null) {
                return false;
            }

            $payment->forceFill([
                'status' => 'paid',
                'paid_at' => $paidAt,
            ])->save();

            $vendor = $payment->vendor;

            if ($vendor === null) {
                return true;
            }

            $subscription = $this->subscriptionFor($vendor);
            $start = $this->startDate($subscription, $paidAt);
            $endsAt = $start->copy()->addMonthsNoOverflow($plan->duration_months);

            $subscription->forceFill([
                'plan_id' => $plan->id,
                'status' => 'active',
                'starts_at' => $start->toDateString(),
                'ends_at' => $endsAt->toDateString(),
                'amount_paid' => $subscription->amount_paid + (float) $payment->amount,
            ])->save();

            $payment->forceFill(['subscription_id' => $subscription->id])->save();

            return true;
        });

        /*
         * Email dikirim SETELAH transaksi commit. Kalau dikirim di dalam
         * transaksi dan pengiriman gagal, email bisa terkirim padahal
         * perubahannya di-rollback — vendor menerima tanda terima untuk
         * langganan yang tidak aktif.
         *
         * `NotificationMailer` menelan kegagalan SMTP, jadi aktivasi yang
         * sudah berhasil tidak pernah dibatalkan hanya karena email.
         */
        if ($activated) {
            app(NotificationMailer::class)->sendSubscriptionPaid($payment->refresh());
        }

        return $activated;
    }

    /**
     * Tandai transaksi gagal/kedaluwarsa tanpa menyentuh langganan.
     */
    public function markFailed(SubscriptionPayment $payment, string $status = 'failed'): bool
    {
        if ($payment->status !== 'pending') {
            return false;
        }

        $payment->forceFill(['status' => $status])->save();

        return true;
    }

    /**
     * Langganan yang akan diperpanjang.
     *
     * Vendor hanya punya satu langganan berjalan; bila belum ada, dibuat baru
     * berstatus trial agar kolom trial tidak hilang.
     */
    private function subscriptionFor(Vendor $vendor): Subscription
    {
        return Subscription::query()->firstOrCreate(
            ['vendor_id' => $vendor->id],
            [
                'status' => 'trial',
                'trial_bookings_used' => 0,
                'trial_invoices_used' => 0,
                'amount_paid' => 0,
            ],
        );
    }

    /**
     * Tanggal mulai masa aktif baru.
     *
     * Bila langganan masih berjalan, perpanjangan disambung dari `ends_at`
     * supaya sisa hari tidak hangus. Bila sudah lewat, mulai hari ini.
     */
    private function startDate(?Subscription $subscription, Carbon $paidAt): Carbon
    {
        $today = $paidAt->copy()->startOfDay();

        if ($subscription === null || $subscription->ends_at === null) {
            return $today;
        }

        $endsAt = Carbon::parse($subscription->ends_at)->startOfDay();

        return $endsAt->greaterThan($today) ? $endsAt : $today;
    }
}
