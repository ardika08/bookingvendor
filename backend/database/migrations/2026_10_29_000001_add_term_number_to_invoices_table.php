<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Nomor term yang bisa diatur vendor.
 *
 * Sebelumnya nomor term diturunkan dari urutan `created_at`, sehingga vendor
 * tidak bisa menerbitkan pelunasan lebih dulu lalu menandainya sebagai term 3.
 * Kolom ini menyimpan nomor term secara eksplisit; vendor bebas menyusun ulang
 * urutannya kapan saja.
 *
 * Backfill: invoice lama diurutkan per booking mengikuti `created_at` lalu `id`
 * — sama dengan urutan yang selama ini dipakai `InvoiceCalculator::termPosition()`
 * — supaya label term yang sudah dilihat klien tidak berubah setelah migrasi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            // Null = belum diberi nomor (hanya terjadi pada baris lama sebelum
            // backfill di bawah). Unique per booking dijaga di lapisan aplikasi
            // karena MySQL tidak punya partial index.
            $table->unsignedInteger('term_number')->nullable()->after('type');
            $table->index(['booking_id', 'term_number']);
        });

        $bookingIds = DB::table('invoices')->distinct()->pluck('booking_id');

        foreach ($bookingIds as $bookingId) {
            $rows = DB::table('invoices')
                ->where('booking_id', $bookingId)
                ->orderBy('created_at')
                ->orderBy('id')
                ->pluck('id');

            $position = 1;
            foreach ($rows as $id) {
                DB::table('invoices')->where('id', $id)->update(['term_number' => $position]);
                $position++;
            }
        }
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex(['booking_id', 'term_number']);
            $table->dropColumn('term_number');
        });
    }
};
