<?php

namespace App\Http\Requests;

use App\Models\Booking;
use App\Services\InvoiceCalculator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Validasi pembuatan invoice dari booking.
 *
 * Aturan mengikuti PRD & perilaku form frontend:
 * - nominal harus > 0 dan tidak boleh melebihi sisa kontrak yang belum ditagih;
 * - tanggal terbit wajib; jatuh tempo tidak boleh sebelum tanggal terbit;
 * - jenis tagihan hanya `dp`, `pelunasan`, atau `full`.
 *
 * Nama field sengaja snake_case (`issued_at`, `due_at`) karena frontend sudah
 * memetakan error berdasarkan nama tersebut.
 */
class StoreInvoiceRequest extends FormRequest
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
            'type' => ['required', 'string', 'in:dp,pelunasan,full'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'issued_at' => ['required', 'date_format:Y-m-d'],
            'due_at' => ['required', 'date_format:Y-m-d', 'after_or_equal:issued_at'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.required' => 'Jenis tagihan wajib dipilih.',
            'type.in' => 'Jenis tagihan tidak dikenal.',
            'amount.required' => 'Nominal tagihan wajib diisi.',
            'amount.min' => 'Nominal harus lebih besar dari nol.',
            'issued_at.required' => 'Tanggal terbit wajib diisi.',
            'issued_at.date_format' => 'Format tanggal terbit tidak valid.',
            'due_at.required' => 'Jatuh tempo wajib diisi.',
            'due_at.after_or_equal' => 'Jatuh tempo tidak boleh sebelum tanggal terbit.',
        ];
    }

    /** Cek sisa kontrak: nominal tidak boleh melebihi yang belum ditagihkan. */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $booking = $this->route('booking');

                if (! $booking instanceof Booking) {
                    return;
                }

                $amount = (float) $this->input('amount', 0);
                $remaining = app(InvoiceCalculator::class)->billableLimit($booking);

                if ($amount > $remaining) {
                    $validator->errors()->add(
                        'amount',
                        'Nominal melebihi sisa kontrak yang belum ditagihkan (Rp'
                        . number_format($remaining, 0, ',', '.') . ').',
                    );
                }
            },
        ];
    }
}
