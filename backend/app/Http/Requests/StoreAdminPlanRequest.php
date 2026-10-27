<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi pembuatan paket langganan oleh admin.
 *
 * Istilah harga mengikuti pemilik produk:
 * - `price`        = harga coret / harga promo, yaitu angka yang DIBAYAR vendor.
 * - `normal_price` = harga normal sebelum diskon, ditampilkan dicoret.
 *
 * `code` dibuat otomatis dari nama bila tidak dikirim, karena kolom itu hanya
 * penanda internal (dipakai untuk menandai paket "yearly" sebagai sorotan).
 */
class StoreAdminPlanRequest extends FormRequest
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
            'duration_months' => ['required', 'integer', 'min:1', 'max:60'],
            'price' => ['nullable', 'numeric', 'min:0.01'],
            'normal_price' => ['nullable', 'numeric', 'min:0.01', 'gte:price'],
            'description' => ['nullable', 'string', 'max:200'],
            'is_active' => ['sometimes', 'boolean'],
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
            'duration_months.required' => 'Masa aktif wajib diisi.',
            'duration_months.min' => 'Masa aktif minimal 1 bulan.',
            'duration_months.max' => 'Masa aktif maksimal 60 bulan.',
            'price.numeric' => 'Harga coret harus berupa angka.',
            'price.min' => 'Harga coret harus lebih besar dari nol.',
            'normal_price.numeric' => 'Harga normal harus berupa angka.',
            'normal_price.gte' => 'Harga normal harus lebih besar atau sama dengan harga coret.',
            'description.max' => 'Deskripsi maksimal 200 karakter.',
        ];
    }
}
