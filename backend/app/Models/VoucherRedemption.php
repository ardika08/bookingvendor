<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu baris riwayat pemakaian voucher oleh satu vendor.
 *
 * Keberadaan tabel ini menjawab dua kebutuhan sekaligus:
 * - Aturan "sekali per vendor" (dijaga unique index, bukan hanya pengecekan
 *   di kode, supaya dua permintaan bersamaan tidak bisa lolos dua-duanya).
 * - Riwayat: admin bisa melihat kode mana dipakai vendor mana dan kapan.
 *
 * `granted_months` dan `discount_applied` menyimpan nilai SAAT klaim. Kalau
 * admin mengubah voucher setelahnya, riwayat lama tetap akurat.
 */
class VoucherRedemption extends Model
{
    protected $fillable = [
        'voucher_id',
        'vendor_id',
        'granted_months',
        'discount_applied',
        'subscription_payment_id',
        'redeemed_at',
    ];

    protected function casts(): array
    {
        return [
            'granted_months' => 'integer',
            'discount_applied' => 'decimal:2',
            'redeemed_at' => 'datetime',
        ];
    }

    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPayment::class, 'subscription_payment_id');
    }
}
