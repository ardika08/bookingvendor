<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Kategori usaha vendor.
 *
 * Daftar kategori bersifat referensi (WO, fotografer, venue, dekorasi, MUA,
 * catering, seserahan) dan dipakai untuk mengelompokkan vendor.
 */
class Category extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'sort_order',
    ];

    public function vendors(): HasMany
    {
        return $this->hasMany(Vendor::class);
    }
}
