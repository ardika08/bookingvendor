<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Jadwal tugas berkala.
 *
 * Semua tugas di sini bergantung pada `schedule:run` yang dipanggil cron tiap
 * menit. Tanpa cron, tidak satu pun berjalan.
 */

/*
 * Sinkronkan status invoice dari riwayat pembayaran.
 *
 * `paid_amount` dan `status` invoice disimpan di baris invoice, sementara
 * sumber kebenarannya adalah tabel `payments`. Kalau ada pembayaran yang
 * ditambahkan lewat jalur lain (mis. perbaikan manual di database), invoice
 * bisa tertinggal menampilkan status lama — klien melihat "belum lunas"
 * padahal sudah dibayar. Tugas ini menyamakannya sekali sehari.
 *
 * Dijalankan dini hari supaya tidak bersaing dengan trafik vendor.
 */
Schedule::command('invoices:recalculate-status')
    ->dailyAt('02:00')
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping();

/*
 * Bersihkan job antrean yang gagal lebih dari sebulan.
 *
 * Tabel `failed_jobs` tidak pernah menyusut sendiri. Dengan email memakai
 * queue, kegagalan berulang bisa menumpuk dan memperlambat query.
 */
Schedule::command('queue:prune-failed --hours=720')
    ->weekly()
    ->sundays()
    ->at('03:00')
    ->timezone('Asia/Jakarta');

/*
 * Bersihkan sesi kedaluwarsa.
 *
 * `SESSION_DRIVER=database`, jadi setiap pengunjung meninggalkan baris di
 * tabel `sessions`. Laravel membersihkan berdasarkan undian saat request,
 * tetapi pada trafik rendah pembersihan itu jarang terpicu dan tabelnya
 * membengkak. Tugas ini memastikan tetap rapi.
 */
Schedule::command('session:prune')
    ->dailyAt('03:30')
    ->timezone('Asia/Jakarta');
