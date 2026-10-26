<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Periode langganan vendor.
 *
 * Satu baris per periode; vendor baru punya baris `trial`. Penghitung
 * `trial_bookings_used`/`trial_invoices_used` hanya dipakai selama trial dan
 * tidak direset saat naik ke paket berbayar.
 */
class Subscription extends Model
{
    use HasFactory;

    public const STATUS_TRIAL = 'trial';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'vendor_id',
        'plan_id',
        'status',
        'starts_at',
        'ends_at',
        'trial_bookings_used',
        'trial_invoices_used',
        'amount_paid',
        'activated_by',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'date',
            'ends_at' => 'date',
            'trial_bookings_used' => 'integer',
            'trial_invoices_used' => 'integer',
            'amount_paid' => 'decimal:2',
        ];
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SubscriptionPayment::class);
    }
}
