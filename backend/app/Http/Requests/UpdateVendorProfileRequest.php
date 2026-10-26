<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Validasi perubahan profil vendor.
 *
 * Aturan menyamai form frontend (`/settings`): nama usaha wajib, kontak
 * opsional tetapi formatnya diperiksa, dan rekening berlaku aturan
 * "lengkap semuanya atau kosong semuanya" — rekening setengah jadi tidak boleh
 * tersimpan karena akan tercetak di invoice klien.
 *
 * Kunci error memakai nama field API (`business_name`, `bank.name`, dst.) agar
 * pemetaan di frontend (`mapVendorServerErrors`) langsung jalan.
 */
class UpdateVendorProfileRequest extends FormRequest
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
            'business_name' => ['required', 'string', 'min:2', 'max:80'],
            'category' => ['nullable', 'string', 'max:60'],
            'description' => ['nullable', 'string', 'max:2000'],
            'contact_phone' => ['nullable', 'string', 'max:20', 'regex:/^(\+62|62|0)8[1-9][0-9]{6,11}$/'],
            'contact_email' => ['nullable', 'email', 'max:120'],
            'city' => ['nullable', 'string', 'max:60'],
            'bank.name' => ['nullable', 'string', 'max:40'],
            'bank.account_number' => ['nullable', 'string', 'regex:/^\d{6,20}$/'],
            'bank.account_holder' => ['nullable', 'string', 'max:80'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'business_name.required' => 'Nama usaha wajib diisi.',
            'business_name.min' => 'Nama usaha terlalu pendek.',
            'business_name.max' => 'Nama usaha maksimal 80 karakter.',
            'contact_phone.regex' => 'Format nomor tidak valid. Contoh: 08123456789.',
            'contact_email.email' => 'Format email tidak valid.',
            'bank.account_number.regex' => 'Nomor rekening hanya angka (6–20 digit).',
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $bank = (array) $this->input('bank', []);
                $filled = collect($bank)->filter(fn ($value) => filled($value))->count();

                // Atomicity rekening: tidak boleh hanya sebagian terisi.
                if ($filled > 0 && $filled < 3) {
                    $validator->errors()->add(
                        'bank.name',
                        'Lengkapi nama bank, nomor rekening, dan pemilik rekening.',
                    );
                }
            },
        ];
    }
}
