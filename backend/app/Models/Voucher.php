<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Kode voucher yang dibuat admin.
 *
 * Dua tipe:
 * - `free_months` — menambah masa aktif langsung, tanpa pembayaran.
 * - `discount`    — memotong harga saat checkout (nominal atau persen).
 *
 * Logika validasi dan klaim ada di `App\Services\VoucherService`; model ini
 * hanya pemetaan tabel + perhitungan status yang dipakai berulang.
 */
class Voucher extends Model
{
    use HasFactory;

    public const TYPE_FREE_MONTHS = 'free_months';
    public const TYPE_DISCOUNT = 'discount';

    public const DISCOUNT_AMOUNT = 'amount';
    public const DISCOUNT_PERCENT = 'percent';

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_EXHAUSTED = 'exhausted';

    protected $fillable = [
        'code',
        'description',
        'type',
        'free_months',
        'plan_id',
        'discount_kind',
        'discount_amount',
        'discount_percent',
        'max_uses',
        'used_count',
        'starts_at',
        'expires_at',
        'is_active',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'free_months' => 'integer',
            'discount_amount' => 'decimal:2',
            'discount_percent' => 'integer',
            'max_uses' => 'integer',
            'used_count' => 'integer',
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Kode selalu disimpan huruf besar.
     *
     * Vendor sering mengetik ulang kode dari gambar dan salah besar-kecil;
     * menormalkan di satu tempat membuat "hemat50" dan "HEMAT50" tidak pernah
     * jadi dua baris berbeda.
     */
    public function setCodeAttribute(string $value): void
    {
        $this->attributes['code'] = strtoupper(trim($value));
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(VoucherRedemption::class);
    }

    /**
     * Voucher yang masih bisa diklaim: aktif, sudah mulai, belum kedaluwarsa,
     * dan kuota total belum habis.
     *
     * Dipakai saat validasi klaim. Tidak dipakai untuk menampilkan daftar di
     * panel admin — admin perlu melihat yang sudah habis juga.
     */
    public function scopeRedeemable(Builder $query): Builder
    {
        $now = now();

        return $query
            ->where('is_active', true)
            ->where(fn (Builder $q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(fn (Builder $q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', $now))
            ->where(fn (Builder $q) => $q->whereNull('max_uses')->orWhereColumn('used_count', '<', 'max_uses'));
    }

    /** Apakah kuota total sudah habis. */
    public function isExhausted(): bool
    {
        return $this->max_uses !== null && $this->used_count >= $this->max_uses;
    }

    /** Apakah sedang dalam masa berlaku. */
    public function isWithinWindow(): bool
    {
        $now = now();

        if ($this->starts_at !== null && $this->starts_at->greaterThan($now)) {
            return false;
        }

        if ($this->expires_at !== null && $this->expires_at->lessThanOrEqualTo($now)) {
            return false;
        }

        return true;
    }

    /**
     * Status untuk ditampilkan di panel admin.
     *
     * Urutan pemeriksaan penting: nonaktif didahulukan, karena kode yang
     * dimatikan manual harus terlihat "nonaktif" apa pun tanggalnya.
     */
    public function statusKey(): string
    {
        if (! $this->is_active) {
            return self::STATUS_INACTIVE;
        }

        if ($this->starts_at !== null && $this->starts_at->isFuture()) {
            return self::STATUS_SCHEDULED;
        }

        if ($this->expires_at !== null && $this->expires_at->isPast()) {
            return self::STATUS_EXPIRED;
        }

        if ($this->isExhausted()) {
            return self::STATUS_EXHAUSTED;
        }

        return self::STATUS_ACTIVE;
    }

    /**
     * Nilai potongan dalam rupiah untuk harga tertentu.
     *
     * Hanya berlaku untuk tipe `discount`. Hasil tidak pernah melebihi harga
     * (potongan tidak boleh membuat total negatif).
     */
    public function discountFor(float $price): float
    {
        if ($this->type !== self::TYPE_DISCOUNT) {
            return 0.0;
        }

        $value = $this->discount_kind === self::DISCOUNT_PERCENT
            ? $price * ((int) $this->discount_percent / 100)
            : (float) $this->discount_amount;

        return round(min($value, $price), 2);
    }

    /** Label ringkas untuk daftar admin. */
    public function discountLabel(): string
    {
        if ($this->type === self::TYPE_FREE_MONTHS) {
            return ((int) $this->free_months).' bulan gratis';
        }

        if ($this->discount_kind === self::DISCOUNT_PERCENT) {
            return $this->discount_percent.'% potongan';
        }

        return 'Potongan Rp '.number_format((float) $this->discount_amount, 0, ',', '.');
    }
}
