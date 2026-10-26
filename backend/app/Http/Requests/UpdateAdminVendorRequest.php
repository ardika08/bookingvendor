<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi perubahan profil vendor oleh admin.
 *
 * Email akun Google tidak termasuk aturan — itu identitas login dan tidak bisa
 * diubah dari panel admin. Nama pemilik mengubah nama akun (`users.name`),
 * bukan email.
 */
class UpdateAdminVendorRequest extends FormRequest
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
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'owner_name' => ['required', 'string', 'min:2', 'max:80'],
            'category' => ['required', 'string', 'max:60'],
            'city' => ['nullable', 'string', 'max:60'],
            'description' => ['nullable', 'string', 'max:2000'],
            'contact' => ['nullable', 'string', 'max:30'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama usaha wajib diisi.',
            'name.min' => 'Nama usaha terlalu pendek.',
            'name.max' => 'Nama usaha maksimal 80 karakter.',
            'owner_name.required' => 'Nama pemilik wajib diisi.',
            'category.required' => 'Pilih kategori usaha.',
        ];
    }
}
