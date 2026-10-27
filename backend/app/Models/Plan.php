<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Katalog paket langganan (PRD: Bulanan pasti; 3 Bulan & Tahunan bisa `null`).
 *
 * Kuota TIDAK disimpan di sini — batas hanya milik masa trial dan konstan.
 */
class Plan extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'duration_months',
        'price',
        'normal_price',
        'description',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'duration_months' => 'integer',
            'price' => 'decimal:2',
            'normal_price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SubscriptionPayment::class);
    }

    /** True bila harga sudah ditetapkan (bisa dibeli vendor). */
    public function isPurchasable(): bool
    {
        return $this->is_active && $this->price !== null;
    }
}
