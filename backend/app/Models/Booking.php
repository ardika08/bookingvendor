<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Booking extends Model
{
    use HasFactory;

    /** Status yang menempati tanggal di kalender. */
    public const OCCUPYING_STATUSES = ['tentative', 'confirmed', 'completed'];

    public const STATUS_TENTATIVE = 'tentative';
    public const STATUS_CONFIRMED = 'confirmed';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    /** Transisi status yang sah (mengikuti alur operasional vendor). */
    public const TRANSITIONS = [
        self::STATUS_TENTATIVE => [self::STATUS_CONFIRMED, self::STATUS_CANCELLED],
        self::STATUS_CONFIRMED => [self::STATUS_COMPLETED, self::STATUS_CANCELLED],
        self::STATUS_COMPLETED => [],
        self::STATUS_CANCELLED => [self::STATUS_TENTATIVE],
    ];

    protected $fillable = [
        'vendor_id',
        'client_id',
        'package_id',
        'event_date',
        'event_time',
        'event_location',
        'event_details',
        'status',
        'total_price',
    ];

    protected function casts(): array
    {
        return [
            'event_date' => 'date',
            // Kolom `time` diserialisasi langsung ke `HH:mm` agar JSON sudah
            // dalam bentuk yang dipakai frontend.
            'event_time' => 'datetime:H:i',
            'total_price' => 'decimal:2',
        ];
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(Package::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /** Booking yang benar-benar menempati tanggal (batal melepas tanggalnya). */
    public function scopeOccupyingDate($query)
    {
        return $query->whereIn('status', self::OCCUPYING_STATUSES);
    }

    /** Booking yang tanggalnya jatuh pada bulan tertentu (`YYYY-MM`). */
    public function scopeInMonth($query, string $monthKey)
    {
        $year = (int) substr($monthKey, 0, 4);
        $month = (int) substr($monthKey, 5, 2);

        // Hari terakhir bulan ini: tanggal 0 bulan berikutnya.
        $lastDay = (int) (new \DateTimeImmutable(sprintf('%04d-%02d-01', $year, $month)))
            ->modify('last day of this month')
            ->format('d');

        // whereDate (bukan whereBetween) karena driver menyimpan DATE dengan
        // komponen jam — perbandingan string mentah bisa melewatkan hari akhir.
        return $query
            ->whereDate('event_date', '>=', sprintf('%04d-%02d-01', $year, $month))
            ->whereDate('event_date', '<=', sprintf('%04d-%02d-%02d', $year, $month, $lastDay));
    }

    /** True bila status ini menempati tanggal di kalender. */
    public function occupiesDate(): bool
    {
        return in_array($this->status, self::OCCUPYING_STATUSES, true);
    }

    /** True bila booking sudah dibatalkan (tanggalnya bebas lagi). */
    public function isCancelled(): bool
    {
        return $this->status === self::STATUS_CANCELLED;
    }

    /** Transisi status yang diizinkan dari status saat ini. */
    public function availableTransitions(): array
    {
        return self::TRANSITIONS[$this->status] ?? [];
    }

    /** True bila status tujuan sah diturunkan dari status saat ini. */
    public function canTransitionTo(string $status): bool
    {
        return in_array($status, $this->availableTransitions(), true);
    }
}
