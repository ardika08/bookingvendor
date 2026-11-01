<?php

namespace App\Http\Requests;

use App\Models\Voucher;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi perubahan voucher oleh admin.
 *
 * Semua kolom opsional (PATCH). Yang perlu dijaga: bila tipe diubah, kolom
 * milik tipe baru harus ikut diisi — kalau tidak, voucher jadi tidak bisa
 * dipakai sama sekali.
 */
class UpdateAdminVoucherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        /** @var Voucher|null $voucher */
        $voucher = $this->route('voucher');

        // Tipe efektif: yang dikirim, atau yang tersimpan bila tidak dikirim.
        $type = $this->input('type', $voucher?->type);
        $isFree = $type === Voucher::TYPE_FREE_MONTHS;
        $isDiscount = $type === Voucher::TYPE_DISCOUNT;

        $kind = $this->input('discount_kind', $voucher?->discount_kind);

        return [
            'code' => [
                'sometimes',
                'string',
                'min:3',
                'max:40',
                'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique('vouchers', 'code')->ignore($voucher?->id),
            ],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'type' => ['sometimes', Rule::in([Voucher::TYPE_FREE_MONTHS, Voucher::TYPE_DISCOUNT])],

            'free_months' => [
                Rule::requiredIf($isFree && $this->has('type')),
                'nullable',
                'integer',
                'min:1',
                'max:24',
            ],
            'plan_id' => ['sometimes', 'nullable', 'integer', 'exists:plans,id'],

            'discount_kind' => [
                Rule::requiredIf($isDiscount && $this->has('type')),
                'nullable',
                Rule::in([Voucher::DISCOUNT_AMOUNT, Voucher::DISCOUNT_PERCENT]),
            ],
            'discount_amount' => [
                Rule::requiredIf($isDiscount && $kind === Voucher::DISCOUNT_AMOUNT && $this->has('type')),
                'nullable',
                'numeric',
                'min:1',
                'max:99999999',
            ],
            'discount_percent' => [
                Rule::requiredIf($isDiscount && $kind === Voucher::DISCOUNT_PERCENT && $this->has('type')),
                'nullable',
                'integer',
                'min:1',
                'max:100',
            ],

            'max_uses' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:100000'],
            'starts_at' => ['sometimes', 'nullable', 'date'],
            'expires_at' => ['sometimes', 'nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.regex' => 'Kode hanya boleh huruf, angka, garis bawah, dan tanda hubung.',
            'free_months.required' => 'Isi berapa bulan gratis untuk voucher ini.',
            'discount_amount.required' => 'Isi nominal potongan.',
            'discount_percent.required' => 'Isi persentase potongan.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code') && is_string($this->input('code'))) {
            $this->merge(['code' => strtoupper(trim($this->input('code')))]);
        }
    }

    /**
     * Data siap simpan.
     *
     * Hanya kolom yang benar-benar dikirim yang disertakan, supaya PATCH
     * sebagian tidak mengosongkan kolom lain. Bila `type` diubah, kolom milik
     * tipe lama dinolkan agar tidak ada sisa data menggantung.
     */
    public function normalized(): array
    {
        $data = $this->validated();

        if (! array_key_exists('type', $data)) {
            // Tipe tidak berubah: bersihkan kolom tipe lain bila admin mengisi
            // nilai yang tidak relevan, tapi jangan sentuh yang tidak dikirim.
            if (array_key_exists('discount_kind', $data)) {
                if ($data['discount_kind'] === Voucher::DISCOUNT_AMOUNT) {
                    $data['discount_percent'] = null;
                } elseif ($data['discount_kind'] === Voucher::DISCOUNT_PERCENT) {
                    $data['discount_amount'] = null;
                }
            }

            return $data;
        }

        if ($data['type'] === Voucher::TYPE_FREE_MONTHS) {
            $data['discount_kind'] = null;
            $data['discount_amount'] = null;
            $data['discount_percent'] = null;
        } else {
            $data['free_months'] = null;

            if (($data['discount_kind'] ?? null) === Voucher::DISCOUNT_PERCENT) {
                $data['discount_amount'] = null;
            } else {
                $data['discount_percent'] = null;
            }
        }

        return $data;
    }
}
