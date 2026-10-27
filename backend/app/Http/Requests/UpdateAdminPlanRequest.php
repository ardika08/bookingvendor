<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi perubahan paket langganan oleh admin.
 *
 * Semua field boleh diubah — termasuk nama — karena admin mengelola katalog
 * sendiri. Yang TIDAK bisa diubah hanya `code`: kolom itu penanda internal
 * yang dipakai katalog untuk menandai paket sorotan.
 *
 * Istilah harga mengikuti pemilik produk:
 * - `price`        = harga coret / harga promo, angka yang DIBAYAR vendor.
 * - `normal_price` = harga normal sebelum diskon, ditampilkan dicoret.
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
            'name' => ['sometimes', 'string', 'min:2', 'max:60'],
            'duration_months' => ['sometimes', 'integer', 'min:1', 'max:60'],
            'price' => ['sometimes', 'nullable', 'numeric', 'min:0.01'],
            'normal_price' => ['sometimes', 'nullable', 'numeric', 'min:0.01'],
            'description' => ['sometimes', 'nullable', 'string', 'max:200'],
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
            'duration_months.min' => 'Masa aktif minimal 1 bulan.',
            'duration_months.max' => 'Masa aktif maksimal 60 bulan.',
            'price.numeric' => 'Harga coret harus berupa angka.',
            'price.min' => 'Harga coret harus lebih besar dari nol.',
            'normal_price.numeric' => 'Harga normal harus berupa angka.',
            'description.max' => 'Deskripsi maksimal 200 karakter.',
        ];
    }
}
