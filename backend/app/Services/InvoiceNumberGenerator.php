<?php

namespace App\Services;

use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Pembuat nomor invoice unik.
 *
 * Format: `INV/{tahun}/{bulan}/{urutan}` — mis. `INV/2026/10/0007`.
 *
 * Aturan (PRD):
 * - urutan berjalan per **tahun** dan berlanjut lintas bulan
 *   (`INV/2026/10/0007` → `INV/2026/11/0008`);
 * - nomor tidak pernah dipakai ulang, termasuk untuk invoice yang dibatalkan;
 * - nomor unik dijamin oleh unique index `invoices.invoice_number` sebagai
 *   jaring pengaman terakhir.
 *
 * Alokasi memakai tabel `invoice_sequences` yang dikunci dengan `lockForUpdate`
 * di dalam transaksi. Baris penghitung dibuat sekali per tahun; bila dua proses
 * mencoba membuat baris pertama bersamaan, unique index pada `year` menolak
 * salah satunya dan proses tersebut mengambil ulang baris yang sudah ada.
 */
class InvoiceNumberGenerator
{
    /**
     * Nomor berikutnya untuk tanggal terbit tertentu.
     *
     * Wajib dipanggil di dalam transaksi (lihat `withNumber`) agar kunci baris
     * penghitung tetap berlaku sampai invoice tersimpan.
     */
    public function next(string $issuedAt): string
    {
        $year = (int) substr($issuedAt, 0, 4);
        $month = substr($issuedAt, 5, 2);

        return $this->format($year, $month, $this->allocate($year));
    }

    /** Susun nomor dari komponennya (urutan minimal 4 digit, bertambah bila perlu). */
    public function format(int $year, string $month, int $sequence): string
    {
        return sprintf('INV/%04d/%s/%04d', $year, $month, $sequence);
    }

    /**
     * Ambil urutan berikutnya untuk tahun tertentu (atomik).
     */
    public function allocate(int $year): int
    {
        $row = DB::table('invoice_sequences')
            ->where('year', $year)
            ->lockForUpdate()
            ->first();

        if ($row === null) {
            try {
                DB::table('invoice_sequences')->insert([
                    'year' => $year,
                    'last_number' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return 1;
            } catch (UniqueConstraintViolationException) {
                // Proses lain lebih dulu membuat baris tahun ini.
                $row = DB::table('invoice_sequences')
                    ->where('year', $year)
                    ->lockForUpdate()
                    ->first();
            }
        }

        $next = ((int) ($row->last_number ?? 0)) + 1;

        DB::table('invoice_sequences')
            ->where('year', $year)
            ->update([
                'last_number' => $next,
                'updated_at' => now(),
            ]);

        return $next;
    }

    /**
     * Jalankan pembuatan invoice dengan nomor yang sudah dialokasikan.
     *
     * Nomor dialokasikan di dalam transaksi yang sama dengan insert invoice,
     * sehingga bila pembuatan invoice gagal (validasi, error database), urutan
     * ikut di-rollback dan tidak ada nomor yang "hilang". Bila tetap terjadi
     * bentrok unique (mis. data lama diimpor manual), percobaan diulang.
     *
     * @template T
     * @param  callable(string): T  $callback
     * @return T
     */
    public function withNumber(string $issuedAt, callable $callback, int $attempts = 3)
    {
        $lastException = null;

        for ($i = 0; $i < $attempts; $i++) {
            try {
                return DB::transaction(function () use ($issuedAt, $callback) {
                    return $callback($this->next($issuedAt));
                });
            } catch (UniqueConstraintViolationException $exception) {
                $lastException = $exception;
            }
        }

        throw $lastException ?? new \RuntimeException('Gagal membuat nomor invoice.');
    }

    /**
     * Sinkronkan penghitung dengan nomor tertinggi yang sudah ada.
     *
     * Berguna setelah impor data lama: mencegah generator memulai dari 1 dan
     * menabrak nomor yang sudah terpakai. Mengembalikan urutan terakhir.
     */
    public function syncFromExisting(int $year): int
    {
        $highest = 0;

        DB::table('invoices')
            ->where('invoice_number', 'like', "INV/{$year}/%")
            ->orderBy('id')
            ->select('invoice_number')
            ->get()
            ->each(function ($row) use (&$highest) {
                $tail = (int) substr((string) $row->invoice_number, strrpos((string) $row->invoice_number, '/') + 1);
                $highest = max($highest, $tail);
            });

        DB::table('invoice_sequences')->updateOrInsert(
            ['year' => $year],
            ['last_number' => $highest, 'updated_at' => now(), 'created_at' => now()],
        );

        return $highest;
    }
}
