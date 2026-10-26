<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi perubahan paket layanan.
 *
 * Semua field `sometimes` — frontend hanya mengirim yang berubah. Paket yang
 * sudah dipakai booking tetap boleh diedit (nama, isi, harga) karena invoice
 * menyimpan nominalnya sendiri; hanya penghapusan yang dicek ketat.
 */
class UpdatePackageRequest extends FormRequest
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
            'name' => ['sometimes', 'string', 'min:2', 'max:60'],
            'price' => ['sometimes', 'numeric', 'min:0.01'],
            'duration_hours' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:48'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.min' => 'Nama paket terlalu pendek.',
            'name.max' => 'Nama paket maksimal 60 karakter.',
            'price.min' => 'Harga harus lebih besar dari nol.',
            'duration_hours.min' => 'Durasi antara 1–48 jam.',
            'duration_hours.max' => 'Durasi antara 1–48 jam.',
        ];
    }
}
