<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    use HasFactory;

    /** Batas trial untuk pembuatan invoice (PRD: 2 selama masa trial). */
    public const STATUS_UNPAID = 'unpaid';
    public const STATUS_PARTIAL = 'partial';
    public const STATUS_PAID = 'paid';
    public const STATUS_CANCELLED = 'cancelled';

    /** Status yang masih menagih sisa pembayaran. */
    public const COLLECTIBLE_STATUSES = [self::STATUS_UNPAID, self::STATUS_PARTIAL];

    protected $fillable = [
        'booking_id',
        'invoice_number',
        'public_token',
        'type',
        'term_number',
        'amount',
        'paid_amount',
        'status',
        'due_date',
        'note',
        'link_active',
    ];

    protected function casts(): array
    {
        return [
            'term_number' => 'integer',
            'amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'due_date' => 'date',
            'link_active' => 'boolean',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /** Sisa tagihan yang belum dibayar (tidak pernah negatif). */
    public function remainingAmount(): float
    {
        return max((float) $this->amount - (float) $this->paid_amount, 0);
    }

    public function isCollectible(): bool
    {
        return in_array($this->status, self::COLLECTIBLE_STATUSES, true);
    }
}
