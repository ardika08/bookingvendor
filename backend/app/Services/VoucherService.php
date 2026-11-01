<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Vendor;
use App\Models\Voucher;
use App\Models\VoucherRedemption;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Validasi dan klaim voucher.
 *
 * Aturan yang ditegakkan di sini:
 * - **Sekali per vendor.** Vendor yang sama tidak bisa memakai kode yang sama
 *   dua kali. Dijaga juga oleh unique index di database, jadi dua permintaan
 *   bersamaan tidak bisa lolos dua-duanya.
 * - **Kuota total.** Bila `max_uses` diisi, klaim berhenti setelah tercapai.
 * - **Masa berlaku.** `starts_at` dan `expires_at` opsional.
 * - **Aktif.** Admin bisa menonaktifkan kode kapan saja.
 *
 * Voucher tipe `free_months` langsung menambah masa aktif tanpa pembayaran.
 * Voucher tipe `discount` TIDAK mengubah langganan di sini — potongannya
 * dipakai saat checkout, karena harus menempel pada transaksi tertentu.
 */
class VoucherService
{
    public function __construct(private readonly SubscriptionManager $subscriptions) {}

    /**
     * Cari voucher berdasarkan kode yang diketik vendor.
     *
     * @throws ValidationException bila kode tidak ada.
     */
    public function findByCode(string $code): Voucher
    {
        $normalized = strtoupper(trim($code));

        $voucher = Voucher::query()->where('code', $normalized)->first();

        if ($voucher === null) {
            throw ValidationException::withMessages([
                'code' => 'Kode voucher tidak ditemukan. Periksa lagi penulisannya.',
            ]);
        }

        return $voucher;
    }

    /**
     * Klaim voucher gratis (tipe `free_months`).
     *
     * Mengembalikan subscription yang sudah diperpanjang. Voucher tipe
     * `discount` ditolak di sini karena tidak mengubah langganan — potongannya
     * baru berlaku saat checkout.
     *
     * @throws ValidationException bila voucher tidak bisa dipakai.
     */
    public function redeemFreeMonths(Vendor $vendor, string $code): VoucherRedemption
    {
        $voucher = $this->findByCode($code);

        if ($voucher->type !== Voucher::TYPE_FREE_MONTHS) {
            throw ValidationException::withMessages([
                'code' => 'Voucher ini berisi potongan harga. Pakai saat memilih paket di tab Paket.',
            ]);
        }

        $this->assertRedeemable($voucher, $vendor);

        $plan = $this->planFor($voucher);

        if ($plan === null) {
            throw ValidationException::withMessages([
                'code' => 'Voucher ini belum terhubung ke paket mana pun. Hubungi admin.',
            ]);
        }

        return DB::transaction(function () use ($voucher, $vendor, $plan): VoucherRedemption {
            // Kunci baris voucher supaya dua vendor yang klaim bersamaan tidak
            // sama-sama membaca used_count yang sama lalu melewati kuota.
            $locked = Voucher::query()->lockForUpdate()->find($voucher->id);

            if ($locked === null) {
                throw ValidationException::withMessages([
                    'code' => 'Kode voucher tidak ditemukan.',
                ]);
            }

            // Ulangi pemeriksaan setelah baris dikunci: keadaan bisa berubah
            // antara pembacaan awal dan titik ini.
            $this->assertRedeemable($locked, $vendor);

            try {
                $redemption = VoucherRedemption::create([
                    'voucher_id' => $locked->id,
                    'vendor_id' => $vendor->id,
                    'granted_months' => $locked->free_months,
                    'redeemed_at' => now(),
                ]);
            } catch (UniqueConstraintViolationException) {
                // Unique index (voucher_id, vendor_id) menolak klaim kedua.
                // Ini jaring pengaman terakhir bila dua permintaan benar-benar
                // berjalan bersamaan.
                throw ValidationException::withMessages([
                    'code' => 'Kamu sudah pernah memakai kode ini.',
                ]);
            }

            $locked->increment('used_count');

            // Tambah masa aktif. Memakai SubscriptionManager agar perilakunya
            // sama dengan perpanjangan berbayar: sisa hari tidak hangus.
            $this->subscriptions->renew($vendor, $plan);

            // renew() memakai durasi paket, bukan durasi voucher. Untuk voucher
            // "N bulan" kita perlu menimpa ends_at agar sesuai jumlah bulannya.
            $this->applyVoucherMonths($vendor, (int) $locked->free_months, $plan);

            return $redemption;
        });
    }

    /**
     * Pastikan voucher boleh dipakai vendor ini.
     *
     * @throws ValidationException
     */
    public function assertRedeemable(Voucher $voucher, Vendor $vendor): void
    {
        if (! $voucher->is_active) {
            throw ValidationException::withMessages([
                'code' => 'Kode voucher ini sudah tidak aktif.',
            ]);
        }

        if (! $voucher->isWithinWindow()) {
            throw ValidationException::withMessages([
                'code' => $voucher->starts_at !== null && $voucher->starts_at->isFuture()
                    ? 'Kode voucher ini belum bisa dipakai.'
                    : 'Kode voucher ini sudah kedaluwarsa.',
            ]);
        }

        if ($voucher->isExhausted()) {
            throw ValidationException::withMessages([
                'code' => 'Kuota kode voucher ini sudah habis.',
            ]);
        }

        $alreadyUsed = VoucherRedemption::query()
            ->where('voucher_id', $voucher->id)
            ->where('vendor_id', $vendor->id)
            ->exists();

        if ($alreadyUsed) {
            throw ValidationException::withMessages([
                'code' => 'Kamu sudah pernah memakai kode ini.',
            ]);
        }
    }

    /**
     * Paket yang diberikan voucher.
     *
     * Bila admin tidak memilih paket, dipakai paket aktif berdurasi terpendek
     * — pilihan paling masuk akal untuk "1 bulan gratis", dan tidak pernah
     * memberikan paket tahunan secara tidak sengaja.
     */
    public function planFor(Voucher $voucher): ?Plan
    {
        if ($voucher->plan_id !== null) {
            return $voucher->plan;
        }

        return Plan::query()
            ->where('is_active', true)
            ->orderBy('duration_months')
            ->orderBy('id')
            ->first();
    }

    /**
     * Timpa `ends_at` agar sesuai jumlah bulan voucher.
     *
     * `SubscriptionManager::renew()` memakai `duration_months` milik paket.
     * Untuk voucher "3 bulan" pada paket bulanan, hasilnya baru 1 bulan.
     * Karena itu tanggal berakhir dihitung ulang dari titik mulai yang dipakai
     * renew(), lalu ditambah `free_months`.
     */
    private function applyVoucherMonths(Vendor $vendor, int $months, Plan $plan): void
    {
        if ($months <= 0) {
            return;
        }

        $subscription = Subscription::query()
            ->where('vendor_id', $vendor->id)
            ->orderByDesc('id')
            ->first();

        if ($subscription === null) {
            return;
        }

        // Titik mulai: kalau langganan lama masih berlaku, sisa harinya harus
        // ikut dihitung. renew() sudah menangani ini, jadi kita ambil hasilnya
        // lalu kurangi durasi paket dan tambahkan durasi voucher.
        $base = Carbon::parse($subscription->ends_at)
            ->copy()
            ->subMonthsNoOverflow($plan->duration_months);

        $subscription->forceFill([
            'ends_at' => $base->copy()->addMonthsNoOverflow($months)->toDateString(),
        ])->save();
    }
}
