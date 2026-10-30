<?php

namespace App\Services;

use App\Models\Subscription;
use App\Models\Vendor;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pembuatan masa uji (trial) untuk vendor baru.
 *
 * Trial berbasis waktu: `ends_at` diisi `trial.days` hari sejak tanggal mulai,
 * sehingga statusnya ditegakkan oleh `SubscriptionStatus` seperti langganan
 * berbayar (tanpa masa tenggang — lihat `SubscriptionStatus::resolveTrial`).
 *
 * Dipakai dua jalur: admin menambah vendor manual, dan vendor mendaftar sendiri
 * lewat `/api/register`. Keduanya harus menghasilkan trial yang identik, jadi
 * logikanya tidak boleh disalin di dua tempat.
 */
class TrialStarter
{
    /** Jumlah hari masa uji. */
    public function days(): int
    {
        return max((int) config('trial.days', 30), 1);
    }

    /**
     * Mulai masa uji untuk vendor. Mengembalikan baris langganan yang dibuat,
     * atau null bila tabel `subscriptions` belum ada (instalasi baru).
     */
    public function start(Vendor $vendor, ?Carbon $start = null): ?Subscription
    {
        if (! Schema::hasTable('subscriptions')) {
            return null;
        }

        $start ??= Carbon::today();

        // Jangan menimpa langganan yang sudah ada: vendor lama yang dibuat
        // ulang atau dipanggil dua kali tidak boleh kehilangan sisa masa aktif.
        $existing = Subscription::query()->where('vendor_id', $vendor->id)->first();

        if ($existing !== null) {
            return $existing;
        }

        DB::table('subscriptions')->insert([
            'vendor_id' => $vendor->id,
            'plan_id' => null,
            'status' => Subscription::STATUS_TRIAL,
            'starts_at' => $start->toDateString(),
            'ends_at' => $start->copy()->addDays($this->days())->toDateString(),
            'trial_bookings_used' => 0,
            'trial_invoices_used' => 0,
            'amount_paid' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return Subscription::query()->where('vendor_id', $vendor->id)->first();
    }
}
