<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Penanda ketersediaan tanggal vendor.
 *
 * `booked` mengikuti booking aktif; `blocked` dipilih manual oleh vendor.
 * Keduanya menempati tanggal yang sama dan tidak bisa berdampingan karena ada
 * unique index (`vendor_id`, `date`).
 */
class VendorSchedule extends Model
{
    use HasFactory;

    public const TYPE_BOOKED = 'booked';
    public const TYPE_BLOCKED = 'blocked';

    protected $fillable = [
        'vendor_id',
        'date',
        'booking_id',
        'type',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function scopeBooked(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_BOOKED);
    }

    public function scopeBlocked(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_BLOCKED);
    }

    public function scopeForVendor(Builder $query, int $vendorId): Builder
    {
        return $query->where('vendor_id', $vendorId);
    }

    public function isBlocked(): bool
    {
        return $this->type === self::TYPE_BLOCKED;
    }
}
