<?php

namespace App\Http\Requests;

use App\Models\Voucher;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validasi pembuatan voucher oleh admin.
 *
 * Aturan silang yang penting: tipe `free_months` wajib punya `free_months`,
 * tipe `discount` wajib punya `discount_kind` beserta nilainya. Kolom milik
 * tipe lain harus kosong supaya tidak ada data menggantung yang membingungkan
 * saat voucher diedit.
 */
class StoreAdminVoucherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isFree = $this->input('type') === Voucher::TYPE_FREE_MONTHS;
        $isDiscount = $this->input('type') === Voucher::TYPE_DISCOUNT;
        $kind = $this->input('discount_kind');

        return [
            'code' => ['required', 'string', 'min:3', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/', 'unique:vouchers,code'],
            'description' => ['nullable', 'string', 'max:255'],
            'type' => ['required', Rule::in([Voucher::TYPE_FREE_MONTHS, Voucher::TYPE_DISCOUNT])],

            // ── free_months ──
            'free_months' => [
                Rule::requiredIf($isFree),
                'nullable',
                'integer',
                'min:1',
                'max:24',
            ],
            'plan_id' => ['nullable', 'integer', 'exists:plans,id'],

            // ── discount ──
            'discount_kind' => [
                Rule::requiredIf($isDiscount),
                'nullable',
                Rule::in([Voucher::DISCOUNT_AMOUNT, Voucher::DISCOUNT_PERCENT]),
            ],
            'discount_amount' => [
                Rule::requiredIf($isDiscount && $kind === Voucher::DISCOUNT_AMOUNT),
                'nullable',
                'numeric',
                'min:1',
                'max:99999999',
            ],
            'discount_percent' => [
                Rule::requiredIf($isDiscount && $kind === Voucher::DISCOUNT_PERCENT),
                'nullable',
                'integer',
                'min:1',
                'max:100',
            ],

            // ── batas & masa berlaku ──
            'max_uses' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.unique' => 'Kode ini sudah dipakai voucher lain.',
            'code.regex' => 'Kode hanya boleh huruf, angka, garis bawah, dan tanda hubung.',
            'expires_at.after' => 'Tanggal berakhir harus setelah tanggal mulai.',
            'free_months.required' => 'Isi berapa bulan gratis untuk voucher ini.',
            'discount_amount.required' => 'Isi nominal potongan.',
            'discount_percent.required' => 'Isi persentase potongan.',
        ];
    }

    /**
     * Buang kolom milik tipe lain sebelum disimpan.
     *
     * Tanpa ini, voucher diskon bisa menyimpan `free_months` sisa percobaan
     * sebelumnya, dan saat admin mengubah tipe, angka lama itu ikut terbawa.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('code') && is_string($this->input('code'))) {
            $this->merge(['code' => strtoupper(trim($this->input('code')))]);
        }
    }

    /** Data siap simpan: kolom tipe lain dinolkan. */
    public function normalized(): array
    {
        $data = $this->validated();
        $type = $data['type'];

        if ($type === Voucher::TYPE_FREE_MONTHS) {
            $data['discount_kind'] = null;
            $data['discount_amount'] = null;
            $data['discount_percent'] = null;
        } else {
            $data['free_months'] = null;

            if (($data['discount_kind'] ?? null) === Voucher::DISCOUNT_AMOUNT) {
                $data['discount_percent'] = null;
            } else {
                $data['discount_amount'] = null;
            }
        }

        return $data;
    }
}
