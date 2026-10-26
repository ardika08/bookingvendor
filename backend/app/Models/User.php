<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    public const ROLE_VENDOR = 'vendor';
    public const ROLE_ADMIN = 'admin';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'google_id',
        'phone',
        'role',
        'is_active',
        'avatar_url',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    /** Peran hanya boleh vendor/admin — SQLite tidak menegakkan enum setelah alter. */
    public function setRoleAttribute($value): void
    {
        if ($value !== null && ! in_array($value, [self::ROLE_VENDOR, self::ROLE_ADMIN], true)) {
            throw new \InvalidArgumentException("Peran '{$value}' tidak dikenal.");
        }

        $this->attributes['role'] = $value;
    }

    /** Profil usaha milik akun vendor (null untuk akun admin). */
    public function vendor(): HasOne
    {
        return $this->hasOne(Vendor::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isVendor(): bool
    {
        return $this->role === self::ROLE_VENDOR;
    }

    /** Akun nonaktif tidak bisa masuk; data tetap utuh. */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /** Cari akun berdasarkan ID Google (dipakai saat callback OAuth). */
    public function scopeByGoogleId($query, string $googleId)
    {
        return $query->where('google_id', $googleId);
    }
}
