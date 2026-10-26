<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi penambahan vendor oleh admin.
 *
 * Admin mendaftarkan vendor baru dengan akun Google yang sudah ditentukan
 * (PRD: tidak ada registrasi publik). Email harus belum terpakai — satu akun
 * hanya boleh punya satu profil vendor.
 */
class StoreAdminVendorRequest extends FormRequest
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
            'email' => ['required', 'email', 'max:120', 'unique:users,email'],
            'category' => ['required', 'string', 'max:60'],
            'city' => ['nullable', 'string', 'max:60'],
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
            'email.required' => 'Email akun Google wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email ini sudah terdaftar pada akun lain.',
            'category.required' => 'Pilih kategori usaha.',
        ];
    }
}
