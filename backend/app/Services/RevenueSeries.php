<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Penyusun seri pendapatan bulanan untuk grafik dashboard.
 *
 * Ditulis sebagai layanan terpisah (bukan di dalam controller) karena
 * perhitungannya murni: menerima booking & pembayaran yang sudah di-query,
 * mengembalikan keranjang bulan siap pakai. Karena murni, bisa diuji tanpa
 * database dan tanpa HTTP.
 *
 * Dua garis dibuat, bukan satu, karena keduanya menjawab pertanyaan berbeda:
 * - **nilai kontrak** — acara yang sudah pasti berjalan (confirmed/completed),
 *   dihitung dari tanggal acara. Ini yang menentukan kapasitas kerja vendor.
 * - **uang masuk** — dana yang benar-benar diterima, dihitung dari tanggal
 *   pembayaran. Ini yang menentukan arus kas.
 *
 * Booking batal sengaja tidak dihitung; memasukkan nilai kontrak batal akan
 * membuat grafik menampilkan pendapatan yang tidak pernah ada.
 */
class RevenueSeries
{
    /** Batas jumlah bulan yang boleh diminta klien. */
    public const MAX_MONTHS = 12;

    public const MIN_MONTHS = 1;

    /** Nama bulan singkat bahasa Indonesia, sesuai kalender yang dipakai vendor. */
    private const MONTH_LABELS = [
        1 => 'Jan',
        2 => 'Feb',
        3 => 'Mar',
        4 => 'Apr',
        5 => 'Mei',
        6 => 'Jun',
        7 => 'Jul',
        8 => 'Agu',
        9 => 'Sep',
        10 => 'Okt',
        11 => 'Nov',
        12 => 'Des',
    ];

    /**
     * Kunci bulan terakhir yang boleh dipakai.
     *
     * `null` berarti "sampai bulan berjalan", sehingga grafik tidak pernah
     * menampilkan bulan masa depan sebagai titik kosong yang membingungkan.
     *
     * @param  iterable<int, \App\Models\Booking>  $bookings
     * @param  iterable<int, \App\Models\Payment>  $payments
     * @return array<int, array{month: string, label: string, contractValue: float, paid: float, bookingCount: int}>
     */
    public function build(
        iterable $bookings,
        iterable $payments,
        ?string $endMonthKey = null,
        int $months = 6,
    ): array {
        $months = max(self::MIN_MONTHS, min($months, self::MAX_MONTHS));
        $endMonthKey = $endMonthKey !== null && $endMonthKey !== ''
            ? substr($endMonthKey, 0, 7)
            : Carbon::now()->format('Y-m');

        $buckets = $this->emptyBuckets($endMonthKey, $months);
        $index = array_flip(array_keys($buckets));

        foreach ($bookings as $booking) {
            $key = $this->monthKeyOf($booking->event_date);

            // Bulan di luar jendela grafik tidak ikut dihitung.
            if ($key === null || ! isset($index[$key])) {
                continue;
            }

            $bucket = &$buckets[$key];
            $bucket['bookingCount'] += 1;

            if (in_array($booking->status, ['confirmed', 'completed'], true)) {
                $bucket['contractValue'] += (float) $booking->total_price;
            }
            unset($bucket);
        }

        foreach ($payments as $payment) {
            $key = $this->monthKeyOf($payment->paid_at);

            if ($key === null || ! isset($index[$key])) {
                continue;
            }

            $buckets[$key]['paid'] += (float) $payment->amount;
        }

        return array_values($buckets);
    }

    /** Total nilai kontrak seluruh titik pada seri. */
    public function totalContractValue(array $series): float
    {
        return $this->sum($series, 'contractValue');
    }

    /** Total uang yang benar-benar masuk pada seri. */
    public function totalPaid(array $series): float
    {
        return $this->sum($series, 'paid');
    }

    /**
     * Keranjang bulan dari `endMonthKey` mundur sebanyak `months`.
     *
     * Urutan dijaga kronologis (terlama → terbaru) karena Recharts menggambar
     * garis mengikuti urutan array, bukan mengurutkannya sendiri.
     *
     * @return array<string, array{month: string, label: string, contractValue: float, paid: float, bookingCount: int}>
     */
    private function emptyBuckets(string $endMonthKey, int $months): array
    {
        $cursor = Carbon::createFromFormat('Y-m', $endMonthKey)->startOfMonth();
        $keys = [];

        for ($i = 0; $i < $months; $i++) {
            $keys[] = $cursor->format('Y-m');
            $cursor = $cursor->subMonthNoOverflow();
        }

        $keys = array_reverse($keys);

        $buckets = [];
        foreach ($keys as $key) {
            $monthNumber = (int) substr($key, 5, 2);

            $buckets[$key] = [
                'month' => $key,
                'label' => self::MONTH_LABELS[$monthNumber] ?? $key,
                'contractValue' => 0.0,
                'paid' => 0.0,
                'bookingCount' => 0,
            ];
        }

        return $buckets;
    }

    /** Kunci `YYYY-MM` dari kolom tanggal, atau `null` bila tidak terbaca. */
    private function monthKeyOf(mixed $date): ?string
    {
        if ($date === null) {
            return null;
        }

        if ($date instanceof Carbon) {
            return $date->format('Y-m');
        }

        $value = (string) $date;

        return preg_match('/^\d{4}-\d{2}/', $value) === 1 ? substr($value, 0, 7) : null;
    }

    private function sum(array $series, string $field): float
    {
        /** @var Collection<int, array<string, mixed>> $collection */
        $collection = new Collection($series);

        return (float) $collection->sum(fn (array $point): float => (float) ($point[$field] ?? 0));
    }
}
