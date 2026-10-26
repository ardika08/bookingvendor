<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Transaksi pembayaran langganan lewat payment gateway.
 *
 * Hanya untuk langganan vendor — tagihan klien tetap transfer manual dan
 * dicatat di tabel `payments`. `order_id` adalah ID internal yang dikirim ke
 * gateway dan menjadi referensi yang dibaca admin.
 */
class SubscriptionPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'subscription_id',
        'vendor_id',
        'plan_id',
        'order_id',
        'gateway',
        'gateway_reference',
        'amount',
        'status',
        'payment_method',
        'raw_payload',
        'paid_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'raw_payload' => 'array',
            'paid_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /**
     * Route binding menerima ID numerik maupun `order_id`.
     *
     * Halaman `/subscription/success` adalah tujuan redirect Duitku, yang
     * mengirim `merchantOrderId` — bukan ID internal. Menerima keduanya membuat
     * satu route bisa dipakai UI maupun sebagai titik masuk dari gateway.
     */
    public function resolveRouteBinding($value, $field = null): ?self
    {
        $query = $this->newQuery();

        if (ctype_digit((string) $value)) {
            return $query->whereKey($value)->first();
        }

        return $query->where('order_id', $value)->first();
    }
}
