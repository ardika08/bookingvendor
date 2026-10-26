<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi perubahan paket langganan oleh admin.
 *
 * Hanya harga dan status aktif yang bisa diubah: `code`, `name`, dan
 * `duration_months` adalah identitas paket yang dipakai logika aktivasi.
 * Harga `null` berarti "belum ditetapkan" — katalog menampilkan "Segera".
 */
class UpdateAdminPlanRequest extends FormRequest
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
            'price' => ['sometimes', 'nullable', 'numeric', 'min:0.01'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'price.numeric' => 'Harga harus berupa angka.',
            'price.min' => 'Harga harus lebih besar dari nol.',
        ];
    }
}
