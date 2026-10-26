<?php

namespace App\Http\Requests;

use App\Models\Booking;
use App\Models\Package;
use App\Models\VendorSchedule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Validasi perubahan booking.
 *
 * Aturannya sama dengan pembuatan, dengan dua pengecualian:
 * - tanggal milik booking ini sendiri tidak dianggap bentrok (reschedule ke
 *   tanggal yang sama tidak boleh ditolak);
 * - status tidak boleh melompati alur yang sah (lihat `Booking::TRANSITIONS`),
 *   karena transisi status punya konsekuensi pada penanda kalender.
 */
class UpdateBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'client' => ['required', 'array'],
            'client.name' => ['required', 'string', 'min:2', 'max:120'],
            'client.phone' => ['required', 'string', 'max:30'],
            'client.email' => ['nullable', 'email', 'max:120'],

            'event_date' => ['required', 'date_format:Y-m-d'],
            'event_time' => ['nullable', 'date_format:H:i'],
            'event_location' => ['nullable', 'string', 'max:255'],
            'package_id' => ['nullable', 'integer', 'exists:packages,id'],
            'total_price' => ['required', 'numeric', 'min:0'],
            'status' => ['required', 'string', 'in:tentative,confirmed,completed,cancelled'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'client.name.required' => 'Nama klien wajib diisi.',
            'client.phone.required' => 'Nomor WhatsApp wajib diisi.',
            'event_date.required' => 'Tanggal acara wajib diisi.',
            'event_date.date_format' => 'Format tanggal tidak valid.',
            'event_time.date_format' => 'Format jam tidak valid (HH:MM).',
            'total_price.required' => 'Nilai kontrak wajib diisi.',
            'total_price.numeric' => 'Nilai kontrak harus berupa angka.',
            'package_id.exists' => 'Paket tidak ditemukan.',
            'status.in' => 'Status tidak dikenal.',
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $booking = $this->route('booking');

                if (! $booking instanceof Booking) {
                    return;
                }

                $this->validatePhone($validator);
                $this->validatePackage($validator, $booking->vendor_id);
                $this->validateDateAvailability($validator, $booking);
                $this->validateStatusTransition($validator, $booking);
            },
        ];
    }

    private function validatePhone(Validator $validator): void
    {
        $phone = preg_replace('/[\s\-().]/', '', (string) $this->input('client.phone'));

        if (! preg_match('/^(\+62|62|0)8[1-9][0-9]{6,11}$/', (string) $phone)) {
            $validator->errors()->add(
                'client.phone',
                'Format nomor tidak valid. Contoh: 08123456789.',
            );
        }
    }

    private function validatePackage(Validator $validator, int $vendorId): void
    {
        $packageId = $this->input('package_id');

        if ($packageId === null || $packageId === '') {
            return;
        }

        $owned = Package::query()
            ->where('id', $packageId)
            ->where('vendor_id', $vendorId)
            ->exists();

        if (! $owned) {
            $validator->errors()->add('package_id', 'Paket tidak ditemukan.');
        }
    }

    /**
     * Tanggal bentrok hanya diperiksa bila booking menempati tanggal.
     *
     * Penanda milik booking ini sendiri diabaikan agar menyimpan ulang tanpa
     * mengubah tanggal tidak ditolak.
     */
    private function validateDateAvailability(Validator $validator, Booking $booking): void
    {
        $status = (string) $this->input('status');

        if (! in_array($status, Booking::OCCUPYING_STATUSES, true)) {
            return;
        }

        $date = (string) $this->input('event_date');

        // Cek penanda jadwal, kecuali milik booking ini sendiri.
        $scheduleTaken = VendorSchedule::query()
            ->where('vendor_id', $booking->vendor_id)
            ->whereDate('date', $date)
            ->where(function ($query) use ($booking) {
                $query->whereNull('booking_id')
                    ->orWhere('booking_id', '!=', $booking->id);
            })
            ->exists();

        // Jaring pengaman: cek booking aktif langsung.
        $bookingTaken = Booking::query()
            ->where('vendor_id', $booking->vendor_id)
            ->occupyingDate()
            ->whereDate('event_date', $date)
            ->where('id', '!=', $booking->id)
            ->exists();

        if ($scheduleTaken || $bookingTaken) {
            $validator->errors()->add(
                'event_date',
                'Tanggal ini sudah ada booking lain. Pilih tanggal berbeda.',
            );
        }
    }

    /**
     * Tolak lompatan status yang tidak sah.
     *
     * Status yang sama dengan status sekarang selalu boleh (form dikirim ulang
     * tanpa perubahan status). Selain itu hanya transisi di `Booking::TRANSITIONS`
     * yang diterima, supaya booking yang sudah selesai tidak bisa dikembalikan
     * ke tentative dan booking batal hanya bisa diaktifkan kembali.
     */
    private function validateStatusTransition(Validator $validator, Booking $booking): void
    {
        $status = (string) $this->input('status');

        if ($status === $booking->status) {
            return;
        }

        if (! $booking->canTransitionTo($status)) {
            $validator->errors()->add(
                'status',
                'Status tidak bisa diubah dari "' . $booking->status . '" ke "' . $status . '".',
            );
        }
    }
}
