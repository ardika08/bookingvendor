<?php

namespace App\Services;

use App\Models\Vendor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Status masa uji — TANPA kuota transaksi.
 *
 * Masa uji kini berbasis **waktu** (lihat `config/trial.php`): vendor mendapat
 * akses penuh selama N hari, dan boleh membuat booking maupun invoice sebanyak
 * yang dibutuhkan. Kuota "2 booking + 2 invoice" sudah dihapus karena vendor
 * wedding biasanya hanya memegang 1–3 acara per bulan — kuota itu habis dalam
 * hitungan hari, sebelum vendor sempat mencoba alur lengkap (booking → invoice
 * → DP → pelunasan → acara selesai), padahal itulah nilai produknya.
 *
 * KONSEKUENSI PENTING
 * `canCreateBooking()` dan `canCreateInvoice()` sekarang **selalu true**
 * selama masa aktif belum lewat. Batas waktu ditegakkan oleh
 * `SubscriptionStatus` (kode `subscription_expired`) dan middleware
 * `EnsureInvoiceTrialQuota`; bukan di sini.
 *
 * Kelas ini dipertahankan (bukan dihapus) karena masih dipakai untuk
 * melaporkan sisa hari dan status masa uji ke frontend. Kolom
 * `trial_bookings_used` / `trial_invoices_used` di tabel `subscriptions` tidak
 * lagi dibaca sebagai pembatas — hanya dipertahankan agar data lama tidak
 * hilang.
 */
class TrialQuota
{
    /**
     * Kode lama untuk penolakan karena kuota habis.
     *
     * Tidak pernah dikirim lagi oleh server, tetapi dipertahankan karena
     * frontend masih menanganinya (dan untuk mencegah 500 bila ada klien lama
     * yang membandingkan nilainya).
     */
    public const CODE = 'trial_limit_reached';

    /**
     * Pemakaian booking.
     *
     * `limited` selalu `false` — tidak ada batas jumlah lagi. Angka `used`
     * tetap dilaporkan sebagai informasi ("kamu sudah membuat N booking"),
     * bukan sebagai pembatas.
     *
     * @return array{limited: bool, used: int, limit: int}
     */
    public function bookingUsage(Vendor $vendor): array
    {
        return [
            'limited' => false,
            'used' => $vendor->bookings()->count(),
            'limit' => 0,
        ];
    }

    /**
     * Pemakaian invoice.
     *
     * @return array{limited: bool, used: int, limit: int}
     */
    public function invoiceUsage(Vendor $vendor): array
    {
        return [
            'limited' => false,
            'used' => $vendor->invoices()->count(),
            'limit' => 0,
        ];
    }

    /** Selalu true — tidak ada kuota invoice selama masa aktif. */
    public function canCreateInvoice(Vendor $vendor): bool
    {
        return true;
    }

    /** Selalu true — tidak ada kuota booking selama masa aktif. */
    public function canCreateBooking(Vendor $vendor): bool
    {
        return true;
    }

    /**
     * Tidak lagi dipakai.
     *
     * Dibiarkan sebagai no-op supaya pemanggil lama tidak error bila masih
     * ada. Penghitung `trial_*_used` tidak lagi berpengaruh apa pun.
     */
    public function recordBookingUsage(Vendor $vendor): void
    {
        // sengaja kosong
    }

    /** Tidak lagi dipakai. */
    public function recordInvoiceUsage(Vendor $vendor): void
    {
        // sengaja kosong
    }

    /** True bila tabel langganan sudah tersedia. */
    public function isEnforced(): bool
    {
        return Schema::hasTable('subscriptions');
    }

    /**
     * Sisa hari masa aktif (null bila tidak ada langganan atau tanpa batas).
     *
     * Dipakai untuk menampilkan "sisa N hari" di banner — bukan kuota.
     */
    public function daysLeft(Vendor $vendor): ?int
    {
        if (! Schema::hasTable('subscriptions')) {
            return null;
        }

        $endsAt = DB::table('subscriptions')
            ->where('vendor_id', $vendor->id)
            ->whereIn('status', ['trial', 'active'])
            ->orderByDesc('id')
            ->value('ends_at');

        if ($endsAt === null) {
            return null;
        }

        $days = (int) now()->startOfDay()->diffInDays(
            \Illuminate\Support\Carbon::parse($endsAt)->startOfDay(),
            false,
        );

        return max($days, 0);
    }
}
