<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi pemblokiran tanggal (fitur kalender vendor).
 *
 * Vendor menandai tanggal yang sengaja ditutup (libur, acara pribadi).
 * Alasan opsional, maksimal 120 karakter — sama dengan batas form frontend.
 */
class StoreBlockedDateRequest extends FormRequest
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
            'date' => ['required', 'date_format:Y-m-d'],
            'reason' => ['nullable', 'string', 'max:120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date.required' => 'Tanggal wajib dipilih.',
            'date.date_format' => 'Format tanggal tidak valid.',
            'reason.max' => 'Keterangan maksimal 120 karakter.',
        ];
    }
}
