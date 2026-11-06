<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Ubah data kontak klien.
 *
 * Klien muncul otomatis dari form booking, jadi nama & telepon sudah pasti
 * valid saat dibuat. Validasi di sini menjaga agar vendor tidak menimpa data
 * dengan kontak yang tidak bisa dihubungi — nomor India-format Indonesia,
 * email yang benar, dan alamat/catatan yang tidak membengkak.
 */
class UpdateClientRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['required', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama klien wajib diisi.',
            'name.max' => 'Nama klien terlalu panjang.',
            'phone.required' => 'Nomor telepon wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.max' => 'Email terlalu panjang.',
            'address.max' => 'Alamat terlalu panjang.',
            'notes.max' => 'Catatan terlalu panjang.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $phone = preg_replace('/[\s\-().]/', '', (string) $this->input('phone'));

            if (! preg_match('/^(\+62|62|0)8[1-9][0-9]{6,11}$/', (string) $phone)) {
                $validator->errors()->add(
                    'phone',
                    'Format nomor tidak valid. Contoh: 08123456789.',
                );
            }
        });
    }
}
