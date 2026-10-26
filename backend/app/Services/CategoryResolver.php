<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Support\Str;

/**
 * Pencarian / pembuatan kategori usaha berdasarkan nama.
 *
 * Vendor dan admin sama-sama memilih kategori berupa teks bebas (bukan id),
 * jadi konversi ke tabel referensi dilakukan di satu tempat: nama yang sudah
 * ada dipakai ulang (tanpa membedakan huruf besar/kecil), nama baru dibuatkan
 * baris kategori dengan slug unik.
 */
class CategoryResolver
{
    public function resolveId(?string $name): ?int
    {
        $name = trim((string) $name);

        if ($name === '') {
            return null;
        }

        $existing = Category::query()
            ->whereRaw('lower(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing !== null) {
            return $existing->id;
        }

        $slug = Str::slug($name);

        if (Category::query()->where('slug', $slug)->exists()) {
            $slug .= '-' . Str::lower(Str::random(4));
        }

        return Category::create(['name' => $name, 'slug' => $slug])->id;
    }
}
