<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\VendorSchedule;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * Menjaga tabel `vendor_schedules` tetap mencerminkan booking aktif.
 *
 * Satu tanggal hanya boleh punya satu penanda (unique `vendor_id` + `date`).
 * Penanda `booked` dibuat saat booking menempati tanggal dan dilepas ketika
 * booking dibatalkan, sehingga kalender & `taken-dates` cukup membaca satu
 * tabel tanpa menggabungkan dua sumber.
 *
 * Semua operasi bersifat idempoten: memanggil `sync()` berulang untuk booking
 * yang sama tidak menambah baris.
 */
class BookingScheduleSync
{
    /**
     * Selaraskan penanda tanggal dengan status booking saat ini.
     *
     * Booking yang menempati tanggal (tentative/confirmed/completed) mendapat
     * penanda `booked`; booking batal melepas penandanya agar tanggalnya bisa
     * dipakai lagi.
     */
    public function sync(Booking $booking): void
    {
        $booking->loadMissing('vendor');

        if ($booking->occupiesDate()) {
            $this->occupy($booking);

            return;
        }

        $this->release($booking);
    }

    /**
     * Buat penanda `booked` untuk tanggal booking.
     *
     * Bila tanggal itu sudah diblokir manual, blokir tersebut digantikan oleh
     * booking: vendor jelas memilih menerima pesanan pada tanggal tersebut,
     * dan unique index tidak mengizinkan keduanya berdampingan.
     */
    private function occupy(Booking $booking): void
    {
        $date = $booking->event_date->toDateString();
        $vendorId = $booking->vendor_id;

        $existing = VendorSchedule::query()
            ->where('vendor_id', $vendorId)
            ->whereDate('date', $date)
            ->first();

        if ($existing !== null) {
            if ($existing->booking_id === $booking->id) {
                return;
            }

            // Penanda milik booking lain pada tanggal yang sama: tidak mungkin
            // terjadi lewat API (ditolak validasi), tetapi bisa muncul dari
            // data lama. Biarkan; validasi yang mencegah, bukan sinkronisasi.
            if ($existing->type === VendorSchedule::TYPE_BOOKED) {
                return;
            }

            // Blokir manual digantikan booking.
            $existing->update([
                'type' => VendorSchedule::TYPE_BOOKED,
                'booking_id' => $booking->id,
                'note' => null,
            ]);

            return;
        }

        try {
            VendorSchedule::create([
                'vendor_id' => $vendorId,
                'date' => $date,
                'booking_id' => $booking->id,
                'type' => VendorSchedule::TYPE_BOOKED,
            ]);
        } catch (UniqueConstraintViolationException) {
            // Balapan dua permintaan pada tanggal yang sama: baris sudah dibuat
            // permintaan lain, jadi tidak ada yang perlu dilakukan.
        }
    }

    /** Lepas penanda `booked` milik booking ini (tanggal jadi bebas lagi). */
    private function release(Booking $booking): void
    {
        VendorSchedule::query()
            ->where('vendor_id', $booking->vendor_id)
            ->where('booking_id', $booking->id)
            ->booked()
            ->delete();
    }

    /**
     * Tanggal yang sudah terpakai untuk vendor, dalam bentuk `YYYY-MM-DD`.
     *
     * Sumbernya penanda jadwal (booking aktif + blokir manual), sehingga
     * frontend bisa memakai hasilnya langsung sebagai `takenDates`.
     *
     * @return array<int, string>
     */
    public function takenDates(int $vendorId, ?int $excludeBookingId = null): array
    {
        $query = VendorSchedule::query()
            ->where('vendor_id', $vendorId)
            ->orderBy('date');

        if ($excludeBookingId !== null) {
            // Booking yang sedang diedit tidak dianggap bentrok dengan dirinya.
            $query->where(function ($inner) use ($excludeBookingId) {
                $inner->whereNull('booking_id')
                    ->orWhere('booking_id', '!=', $excludeBookingId);
            });
        }

        return $query->pluck('date')
            ->map(fn ($date) => $date instanceof \DateTimeInterface
                ? $date->format('Y-m-d')
                : substr((string) $date, 0, 10))
            ->unique()
            ->values()
            ->all();
    }
}
