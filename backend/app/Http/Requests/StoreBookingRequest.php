<?php

namespace App\Http\Requests;

use App\Models\Booking;
use App\Models\Package;
use App\Models\VendorSchedule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Validasi pembuatan booking.
 *
 * Frontend mengirim klien sebagai objek bersarang (`client.name`,
 * `client.phone`, `client.email`) karena satu form membuat klien dan booking
 * sekaligus. Klien dicocokkan berdasarkan nomor telepon dalam lingkup vendor,
 * jadi pelanggan yang memesan dua kali tidak menghasilkan baris ganda.
 *
 * Nama field mengikuti payload frontend (`event_date`, `total_price`, …).
 */
class StoreBookingRequest extends FormRequest
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
            'client.name.min' => 'Nama klien terlalu pendek.',
            'client.phone.required' => 'Nomor WhatsApp wajib diisi.',
            'client.email.email' => 'Format email tidak valid.',
            'event_date.required' => 'Tanggal acara wajib diisi.',
            'event_date.date_format' => 'Format tanggal tidak valid.',
            'event_time.date_format' => 'Format jam tidak valid (HH:MM).',
            'total_price.required' => 'Nilai kontrak wajib diisi.',
            'total_price.numeric' => 'Nilai kontrak harus berupa angka.',
            'total_price.min' => 'Nilai kontrak tidak boleh negatif.',
            'package_id.exists' => 'Paket tidak ditemukan.',
            'status.in' => 'Status tidak dikenal.',
        ];
    }

    /**
     * Pemeriksaan lintas-field yang butuh data vendor.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                // Vendor selalu berasal dari sesi login (lihat ResolvesVendor).
                $vendorId = auth()->user()?->vendor?->id;

                if ($vendorId === null) {
                    return;
                }

                $this->validatePhone($validator);
                $this->validatePackage($validator, $vendorId);
                $this->validateDateAvailability($validator, $vendorId);
            },
        ];
    }

    /** Nomor WA harus format Indonesia yang bisa dihubungi. */
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

    /** Paket yang dipilih harus milik vendor ini, bukan vendor lain. */
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
     * Tanggal harus bebas untuk booking yang menempati tanggal.
     *
     * Booking berstatus `cancelled` tidak menempati tanggal, jadi boleh
     * memakai tanggal yang sudah terpakai.
     */
    private function validateDateAvailability(Validator $validator, int $vendorId): void
    {
        $status = (string) $this->input('status');

        if (! in_array($status, Booking::OCCUPYING_STATUSES, true)) {
            return;
        }

        $date = (string) $this->input('event_date');

        // Cek penanda jadwal terlebih dahulu (sumber utama).
        $scheduleTaken = VendorSchedule::query()
            ->where('vendor_id', $vendorId)
            ->whereDate('date', $date)
            ->exists();

        // Jaring pengaman: cek booking aktif langsung bila penanda belum
        // tersinkron (mis. data lama atau dibuat langsung di database).
        $bookingTaken = Booking::query()
            ->where('vendor_id', $vendorId)
            ->occupyingDate()
            ->whereDate('event_date', $date)
            ->exists();

        if ($scheduleTaken || $bookingTaken) {
            $validator->errors()->add(
                'event_date',
                'Tanggal ini sudah ada booking lain. Pilih tanggal berbeda.',
            );
        }
    }
}
