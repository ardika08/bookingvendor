<?php

namespace App\Services;

use App\Models\Vendor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Penjaga kuota masa trial.
 *
 * PRD: vendor baru mendapat jatah 2 booking + 2 invoice. Kuota hanya berlaku
 * selama masa trial dan tidak direset saat vendor berlangganan. Penolakan
 * dikirim sebagai HTTP 422 dengan kode `trial_limit_reached` agar frontend
 * membuka `UpgradeModal` tanpa menghapus isian form.
 *
 * Tabel `subscriptions` dibuat pada fitur langganan. Sebelum tabel itu ada
 * (mis. instalasi backend baru), pengecekan dilewati supaya pengembangan
 * endpoint tidak terhambat; begitu tabel tersedia, penegakan langsung aktif.
 */
class TrialQuota
{
    public const CODE = 'trial_limit_reached';

    public function bookingsLimit(): int
    {
        return (int) config('trial.bookings_limit', 2);
    }

    public function invoicesLimit(): int
    {
        return (int) config('trial.invoices_limit', 2);
    }

    /**
     * Status pemakaian invoice vendor.
     *
     * @return array{limited: bool, used: int, limit: int}
     */
    public function invoiceUsage(Vendor $vendor): array
    {
        return $this->usageFor(
            $vendor,
            'trial_invoices_used',
            $this->invoicesLimit(),
            fn (): int => $vendor->invoices()->count(),
        );
    }

    /**
     * Status pemakaian booking vendor.
     *
     * @return array{limited: bool, used: int, limit: int}
     */
    public function bookingUsage(Vendor $vendor): array
    {
        return $this->usageFor(
            $vendor,
            'trial_bookings_used',
            $this->bookingsLimit(),
            fn (): int => $vendor->bookings()->count(),
        );
    }

    /** True bila vendor masih boleh menerbitkan invoice baru. */
    public function canCreateInvoice(Vendor $vendor): bool
    {
        return $this->hasRemaining($this->invoiceUsage($vendor));
    }

    /** True bila vendor masih boleh membuat booking baru. */
    public function canCreateBooking(Vendor $vendor): bool
    {
        return $this->hasRemaining($this->bookingUsage($vendor));
    }

    /**
     * Hitung pemakaian satu jenis kuota.
     *
     * - Tanpa baris langganan → hitung dari data nyata (PRD: sisa jatah trial
     *   dihitung dari booking/invoice yang benar-benar ada).
     * - Sudah berlangganan → tanpa batas.
     * - Trial → pakai penghitung yang tersimpan.
     *
     * @param  callable(): int  $realCount
     * @return array{limited: bool, used: int, limit: int}
     */
    private function usageFor(Vendor $vendor, string $column, int $limit, callable $realCount): array
    {
        $subscription = $this->activeSubscription($vendor);

        if ($subscription === null) {
            return ['limited' => true, 'used' => (int) $realCount(), 'limit' => $limit];
        }

        if ($subscription->status !== 'trial') {
            return ['limited' => false, 'used' => 0, 'limit' => $limit];
        }

        return [
            'limited' => true,
            'used' => (int) ($subscription->{$column} ?? 0),
            'limit' => $limit,
        ];
    }

    /** @param array{limited: bool, used: int, limit: int} $usage */
    private function hasRemaining(array $usage): bool
    {
        if (! $usage['limited']) {
            return true;
        }

        return $usage['used'] < $usage['limit'];
    }

    /** Pesan penolakan yang konsisten untuk API. */
    public function rejectionMessage(): string
    {
        return 'Jatah trial invoice sudah habis. Berlangganan untuk membuat invoice tanpa batas.';
    }

    /**
     * Tambah penghitung pemakaian booking selama trial (bila relevan).
     */
    public function recordBookingUsage(Vendor $vendor): void
    {
        if (! Schema::hasTable('subscriptions')) {
            return;
        }

        $subscription = $this->activeSubscription($vendor);
        if ($subscription === null || $subscription->status !== 'trial') {
            return;
        }

        DB::table('subscriptions')
            ->where('id', $subscription->id)
            ->increment('trial_bookings_used');
    }

    /**
     * Tambah penghitung pemakaian invoice selama trial (bila relevan).
     */
    public function recordInvoiceUsage(Vendor $vendor): void
    {
        if (! Schema::hasTable('subscriptions')) {
            return;
        }

        $subscription = $this->activeSubscription($vendor);
        if ($subscription === null || $subscription->status !== 'trial') {
            return;
        }

        DB::table('subscriptions')
            ->where('id', $subscription->id)
            ->increment('trial_invoices_used');
    }

    /** True bila tabel langganan sudah tersedia (penegakan aktif). */
    public function isEnforced(): bool
    {
        return Schema::hasTable('subscriptions');
    }

    /** Langganan trial/aktif milik vendor (hanya satu yang boleh hidup). */
    private function activeSubscription(Vendor $vendor): ?object
    {
        if (! Schema::hasTable('subscriptions')) {
            return null;
        }

        return DB::table('subscriptions')
            ->where('vendor_id', $vendor->id)
            ->whereIn('status', ['trial', 'active'])
            ->orderByDesc('id')
            ->first();
    }
}
