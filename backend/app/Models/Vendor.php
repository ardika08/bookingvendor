<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Vendor extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'category_id',
        'category_other',
        'name',
        'slug',
        'description',
        'location',
        'contact',
        'contact_email',
        'bank_name',
        'bank_account_number',
        'bank_account_name',
        'schedule_link_active',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'schedule_link_active' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function packages(): HasMany
    {
        return $this->hasMany(Package::class);
    }

    public function clients(): HasMany
    {
        return $this->hasMany(Client::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    /** Invoice milik vendor lewat booking — dipakai menghitung pemakaian. */
    public function invoices(): HasManyThrough
    {
        return $this->hasManyThrough(Invoice::class, Booking::class);
    }

    /** Transaksi langganan vendor (payment gateway). */
    public function subscriptionPayments(): HasMany
    {
        return $this->hasMany(SubscriptionPayment::class);
    }

    /** Penanda ketersediaan tanggal (booking aktif + blokir manual). */
    public function schedules(): HasMany
    {
        return $this->hasMany(VendorSchedule::class);
    }

    /** Hanya akun vendor yang masih aktif (belum dinonaktifkan admin). */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /** True bila data rekening lengkap dan bisa dicetak di invoice. */
    public function hasCompleteBankAccount(): bool
    {
        return filled($this->bank_name)
            && filled($this->bank_account_number)
            && filled($this->bank_account_name);
    }
}
