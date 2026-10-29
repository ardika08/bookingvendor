<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Invoice;

/**
 * Perhitungan nominal invoice: DP, pelunasan, dan sisa tagihan.
 *
 * Satu sumber kebenaran untuk aturan uang, dipakai oleh form (saran nominal),
 * validasi (batas sisa kontrak), dan pengelolaan status. Semua nilai
 * dibulatkan ke satuan rupiah (2 desimal) agar tidak muncul pecahan sen.
 *
 * Aturan (mengikuti PRD & perilaku form frontend):
 * - DP = 40% dari nilai kontrak;
 * - pelunasan = nilai kontrak - DP;
 * - nominal yang disarankan untuk pelunasan adalah sisa kontrak yang belum
 *   ditagihkan, supaya tagihan terakhir menutup persis nilai kontrak;
 * - invoice berstatus `cancelled` tidak dihitung sebagai tagihan.
 */
class InvoiceCalculator
{
    public function dpPercentage(): float
    {
        return (float) config('billing.dp_percentage', 0.4);
    }

    /** Nominal DP untuk nilai kontrak tertentu. */
    public function dpAmount(float $totalPrice): float
    {
        if ($totalPrice <= 0) {
            return 0.0;
        }

        return round($totalPrice * $this->dpPercentage(), 2);
    }

    /** Nominal pelunasan untuk nilai kontrak tertentu (tidak negatif). */
    public function settlementAmount(float $totalPrice): float
    {
        return round(max($totalPrice - $this->dpAmount($totalPrice), 0), 2);
    }

    /** Nominal bawaan menurut jenis tagihan (`dp` atau `pelunasan`). */
    public function amountForType(float $totalPrice, string $type): float
    {
        if ($type === 'pelunasan') {
            return $this->settlementAmount($totalPrice);
        }

        // `full` menagih seluruh kontrak; `dp` memakai pembagian 40%.
        if ($type === 'full') {
            return round(max($totalPrice, 0), 2);
        }

        return $this->dpAmount($totalPrice);
    }

    /** Total nominal invoice yang sudah terbit (yang dibatalkan tidak dihitung). */
    public function billedTotal(Booking $booking): float
    {
        $billed = $booking->invoices()
            ->where('status', '!=', Invoice::STATUS_CANCELLED)
            ->sum('amount');

        return round((float) $billed, 2);
    }

    /** Sisa kontrak yang belum ditagihkan (tidak pernah negatif). */
    public function remainingBillable(Booking $booking): float
    {
        return round(max((float) $booking->total_price - $this->billedTotal($booking), 0), 2);
    }

    /**
     * Nominal yang disarankan saat vendor memilih jenis tagihan.
     *
     * Pelunasan memakai sisa kontrak bila masih ada sehingga tidak menyisakan
     * selisih pembulatan; DP selalu memakai 40% dari nilai kontrak.
     */
    public function suggestedAmount(Booking $booking, string $type): float
    {
        $total = (float) $booking->total_price;

        if ($type === 'pelunasan') {
            $remaining = $this->remainingBillable($booking);

            return $remaining > 0 ? $remaining : $this->settlementAmount($total);
        }

        return $this->amountForType($total, $type);
    }

    /**
     * Rincian kalkulasi untuk ditampilkan di ringkasan form.
     *
     * @return array{total: float, billed: float, remaining: float, current: float, afterThis: float}
     */
    public function breakdown(Booking $booking, float $currentAmount = 0.0): array
    {
        $total = round((float) $booking->total_price, 2);
        $billed = $this->billedTotal($booking);
        $remaining = round(max($total - $billed, 0), 2);

        return [
            'total' => $total,
            'billed' => $billed,
            'remaining' => $remaining,
            'current' => round($currentAmount, 2),
            'afterThis' => round(max($remaining - $currentAmount, 0), 2),
        ];
    }

    /**
     * Nominal maksimum yang masih boleh ditagihkan lewat invoice baru.
     *
     * `$excludeInvoiceId` berguna saat mengubah invoice: sisa kontrak dihitung
     * tanpa menyertakan invoice yang sedang diedit.
     */
    public function billableLimit(Booking $booking, ?int $excludeInvoiceId = null): float
    {
        $query = $booking->invoices()->where('status', '!=', Invoice::STATUS_CANCELLED);

        if ($excludeInvoiceId !== null) {
            $query->where('id', '!=', $excludeInvoiceId);
        }

        $billed = (float) $query->sum('amount');

        return round(max((float) $booking->total_price - $billed, 0), 2);
    }

    /**
     * Status invoice setelah sejumlah pembayaran dicatat.
     *
     * Invoice yang sudah dibatalkan tetap `cancelled`.
     */
    public function statusAfterPayment(
        float $amount,
        float $paidAmount,
        float $incomingPayment,
        string $currentStatus = Invoice::STATUS_UNPAID,
    ): string {
        if ($currentStatus === Invoice::STATUS_CANCELLED) {
            return Invoice::STATUS_CANCELLED;
        }

        $paid = round($paidAmount + $incomingPayment, 2);

        if ($paid <= 0) {
            return Invoice::STATUS_UNPAID;
        }

        return $paid >= round($amount, 2) ? Invoice::STATUS_PAID : Invoice::STATUS_PARTIAL;
    }

    /** Sisa tagihan satu invoice (tidak pernah negatif). */
    public function remainingOf(Invoice $invoice): float
    {
        return round(max((float) $invoice->amount - (float) $invoice->paid_amount, 0), 2);
    }

    /**
     * Posisi dan total term untuk satu invoice.
     *
     * Term dihitung dari **semua** invoice booking yang terurut menaik
     * (tanggal terbit lalu id), termasuk yang dibatalkan. Alasan memasukkan
     * invoice batal: nomor term tidak boleh bergeser — kalau invoice term 2
     * dibatalkan, invoice term 3 tetap "term 3", bukan menjadi "term 2".
     * Kalau yang batal dikeluarkan dari perhitungan, label term bisa berubah
     * dari hari ke hari dan membuat vendor/klien bingung.
     *
     * @return array{term: int, total: int}  `term` mulai dari 1; `total` ≥ 1.
     */
    public function termPosition(Invoice $invoice): array
    {
        $booking = $invoice->booking;

        if ($booking === null) {
            return ['term' => 1, 'total' => 1];
        }

        $invoices = $booking->invoices()
            ->orderBy('created_at')
            ->orderBy('id')
            ->get(['id']);

        $position = 1;
        foreach ($invoices as $index => $row) {
            if ($row->id === $invoice->id) {
                $position = $index + 1;
                break;
            }
        }

        return [
            'term' => $position,
            'total' => $invoices->count(),
        ];
    }
}
