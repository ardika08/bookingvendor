<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi paket layanan (tambah).
 *
 * Nama wajib agar kolom tabel booking tetap terbaca; harga > 0 karena paket
 * gratis membuat perhitungan invoice membingungkan; durasi opsional tetapi
 * harus masuk akal (1–48 jam).
 */
class StorePackageRequest extends FormRequest
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
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'price' => ['required', 'numeric', 'min:0.01'],
            'duration_hours' => ['nullable', 'integer', 'min:1', 'max:48'],
            'description' => ['nullable', 'string', 'max:2000'],
            'active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama paket wajib diisi.',
            'name.min' => 'Nama paket terlalu pendek.',
            'name.max' => 'Nama paket maksimal 60 karakter.',
            'price.required' => 'Harga paket wajib diisi.',
            'price.min' => 'Harga harus lebih besar dari nol.',
            'duration_hours.min' => 'Durasi antara 1–48 jam.',
            'duration_hours.max' => 'Durasi antara 1–48 jam.',
        ];
    }
}
