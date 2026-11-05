<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Snapshot addon pada booking.
 *
 * Harga dikunci saat booking dibuat; perubahan harga addon/katalog setelahnya
 * tidak mengubah baris ini. Invoice dibangun dari baris ini, bukan dari addon
 * live.
 */
class BookingAddon extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'addon_id',
        'name',
        'price',
    ];

    protected $casts = [
        'price' => 'float',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
