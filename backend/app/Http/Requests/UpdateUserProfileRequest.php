<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi perubahan profil akun pengguna.
 *
 * Hanya nama dan nomor HP yang bisa diubah. Email & foto berasal dari akun
 * Google (identitas login) sehingga tidak diterima di sini.
 */
class UpdateUserProfileRequest extends FormRequest
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
            'phone' => ['nullable', 'string', 'max:20', 'regex:/^(\+62|62|0)8[1-9][0-9]{6,11}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama wajib diisi.',
            'name.min' => 'Nama terlalu pendek.',
            'name.max' => 'Nama maksimal 80 karakter.',
            'phone.regex' => 'Format nomor tidak valid. Contoh: 08123456789.',
        ];
    }
}
