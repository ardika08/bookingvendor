<?php

namespace App\Services;

use App\Models\Invoice;
use Illuminate\Support\Carbon;

/**
 * Penentu status invoice secara otomatis.
 *
 * Status **tidak** diinput manual: selalu diturunkan dari dua angka, yaitu
 * `amount` (tagihan) dan `paid_amount` (akumulasi pembayaran). `paid_amount`
 * sendiri dihitung ulang dari tabel `payments`, sehingga riwayat pembayaran
 * selalu menjadi sumber kebenaran.
 *
 * Aturan:
 * - `cancelled` bersifat terminal — invoice yang digugurkan tidak pernah
 *   berubah status karena pembayaran;
 * - belum ada pembayaran → `unpaid`;
 * - pembayaran sebagian → `partial`;
 * - pembayaran menutup tagihan (atau lebih) → `paid`.
 *
 * "Terlambat" (overdue) bukan status tersimpan, melainkan hasil hitung saat
 * dibaca: invoice masih collectible dan `due_date` sudah lewat.
 */
class InvoiceStatusResolver
{
    /** Status yang masih menagih sisa pembayaran. */
    public const COLLECTIBLE = [Invoice::STATUS_UNPAID, Invoice::STATUS_PARTIAL];

    /** Tentukan status dari nominal tagihan dan total pembayaran. */
    public function derive(float $amount, float $paidAmount, string $currentStatus): string
    {
        if ($currentStatus === Invoice::STATUS_CANCELLED) {
            return Invoice::STATUS_CANCELLED;
        }

        $paid = round($paidAmount, 2);

        if ($paid <= 0) {
            return Invoice::STATUS_UNPAID;
        }

        return $paid >= round($amount, 2) ? Invoice::STATUS_PAID : Invoice::STATUS_PARTIAL;
    }

    /**
     * Hitung ulang `paid_amount` & `status` satu invoice dari riwayat pembayaran.
     *
     * Dipakai setelah pembayaran dicatat dan oleh perintah rekonsiliasi untuk
     * memperbaiki data yang menyimpang.
     */
    public function recalculate(Invoice $invoice): Invoice
    {
        $paid = round((float) $invoice->payments()->sum('amount'), 2);

        $invoice->paid_amount = $paid;
        $invoice->status = $this->derive((float) $invoice->amount, $paid, $invoice->status);

        if ($invoice->isDirty()) {
            $invoice->save();
        }

        return $invoice;
    }

    /** True bila invoice masih menagih dan sudah melewati jatuh tempo. */
    public function isOverdue(Invoice $invoice, ?Carbon $today = null): bool
    {
        if (! in_array($invoice->status, self::COLLECTIBLE, true)) {
            return false;
        }

        if ($invoice->due_date === null) {
            return false;
        }

        $startOfToday = ($today ?? now())->copy()->startOfDay();

        return $invoice->due_date->lt($startOfToday) && $this->remaining($invoice) > 0;
    }

    /** Sisa tagihan (tidak pernah negatif). */
    public function remaining(Invoice $invoice): float
    {
        return round(max((float) $invoice->amount - (float) $invoice->paid_amount, 0), 2);
    }

    /** Persentase pembayaran 0–100 untuk progress bar. */
    public function paidPercent(Invoice $invoice): int
    {
        $amount = (float) $invoice->amount;
        $paid = (float) $invoice->paid_amount;

        if ($amount <= 0) {
            return $paid > 0 ? 100 : 0;
        }

        return (int) min(round($paid / $amount * 100), 100);
    }

    /**
     * Status yang dikirim ke frontend.
     *
     * Frontend memakai `void` untuk invoice yang digugurkan.
     */
    public function toFrontendStatus(Invoice $invoice): string
    {
        return $invoice->status === Invoice::STATUS_CANCELLED ? 'void' : $invoice->status;
    }
}
