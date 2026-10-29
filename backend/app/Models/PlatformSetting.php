<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Satu baris aturan platform (key-value).
 *
 * Logika baca/tulis ada di `App\Services\PlatformSettings` — model ini hanya
 * pemetaan tabel. Riwayat perubahan sengaja tidak dijadikan relasi karena
 * tidak pernah dibaca lewat model.
 */
class PlatformSetting extends Model
{
    protected $fillable = ['key', 'value'];

    protected function casts(): array
    {
        return [
            'value' => 'string',
        ];
    }
}
