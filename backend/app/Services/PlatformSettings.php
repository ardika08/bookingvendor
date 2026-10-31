<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Aturan platform yang bisa diubah admin dari panel.
 *
 * CARA NILAI INI SAMPAI KE KODE YANG MEMAKAINYA
 * Kode yang sudah ada membaca `config('subscription.grace_days')` dan
 * `config('trial.*')`. Daripada mengubah semua pemanggil itu, nilai dari
 * database ditulis KE config saat aplikasi boot (lihat AppServiceProvider).
 * Dengan begitu `SubscriptionStatus` dan `TrialQuota` tidak perlu tahu
 * apa pun soal tabel ini.
 *
 * BILA TABEL BELUM ADA
 * Migrasi belum dijalankan di environment tersebut, atau tes memakai database
 * tanpa tabel ini. Dalam kondisi itu config dari `.env` tetap dipakai, jadi
 * aplikasi tidak pernah gagal hanya karena tabel pengaturan tidak tersedia.
 *
 * BILA DATABASE BELUM BISA DIHUBUNGI SAMA SEKALI
 * Kasus ini nyata saat pemasangan pertama: `composer install` menjalankan
 * `artisan package:discover`, yang memicu boot aplikasi — padahal `.env`
 * masih menunjuk database yang belum dibuat. Tanpa penanganan, pemasangan
 * gagal di langkah pertama dengan pesan yang membingungkan soal file SQLite.
 * Karena itu `available()` menelan kegagalan koneksi dan menganggap tabelnya
 * tidak ada; nilai dari `.env` tetap dipakai.
 */
class PlatformSettings
{
    /**
     * Definisi aturan yang boleh diubah, beserta batas nilai yang masuk akal.
     *
     * Batas bawah bukan sekadar validasi formal: `grace_days` 0 berarti vendor
     * langsung kehilangan akses tepat saat langganan habis, dan kuota 0 berarti
     * vendor trial tidak bisa membuat apa pun. Keduanya sah secara teknis
     * tetapi hampir pasti salah ketik, jadi ditolak.
     *
     * @var array<string, array{config: string, default: int, min: int, max: int}>
     */
    public const RULES = [
        'subscription.grace_days' => [
            'config' => 'subscription.grace_days',
            'default' => 7,
            'min' => 1,
            'max' => 30,
        ],
        /*
         * Durasi masa uji. Menggantikan kuota booking/invoice yang sudah
         * dihapus: masa uji kini berbasis waktu, jadi yang perlu diatur admin
         * adalah berapa lama akses penuh diberikan.
         */
        'trial.days' => [
            'config' => 'trial.days',
            'default' => 30,
            'min' => 1,
            'max' => 90,
        ],
    ];

    /**
     * True bila tabel pengaturan tersedia di database saat ini.
     *
     * Kegagalan koneksi diperlakukan sebagai "tabel belum ada", bukan error:
     * aplikasi harus tetap bisa boot saat database belum dibuat atau belum
     * bisa dihubungi (mis. saat `composer install` pada pemasangan pertama,
     * atau saat `php artisan config:cache` dijalankan sebelum migrasi).
     * Pemanggil sudah menangani nilai `false` dengan memakai default `.env`.
     */
    public function available(): bool
    {
        try {
            return Schema::hasTable('platform_settings');
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Seluruh nilai aturan, sudah di-cast ke integer.
     *
     * Kunci yang belum ada di database memakai nilai default, sehingga
     * penambahan aturan baru tidak pernah menghasilkan `null`.
     *
     * @return array<string, int>
     */
    public function all(): array
    {
        $stored = $this->available()
            ? DB::table('platform_settings')->pluck('value', 'key')->all()
            : [];

        $values = [];
        foreach (self::RULES as $key => $rule) {
            $values[$key] = isset($stored[$key])
                ? (int) $stored[$key]
                : $rule['default'];
        }

        return $values;
    }

    /** Satu nilai aturan. */
    public function get(string $key): int
    {
        return $this->all()[$key] ?? self::RULES[$key]['default'] ?? 0;
    }

    /**
     * Tulis nilai dari database ke config aplikasi.
     *
     * Dipanggil sekali saat boot. Tanpa ini, nilai yang disimpan admin tidak
     * akan pernah terbaca oleh `SubscriptionStatus`/`TrialQuota`.
     */
    public function applyToConfig(): void
    {
        if (! $this->available()) {
            return;
        }

        foreach (self::RULES as $key => $rule) {
            config([$rule['config'] => $this->get($key)]);
        }
    }

    /**
     * Simpan perubahan sekaligus, lengkap dengan catatan riwayat.
     *
     * Hanya nilai yang BERUBAH yang dicatat. Menyimpan ulang nilai yang sama
     * tidak boleh membanjiri riwayat dengan entri palsu.
     *
     * @param  array<string, int>  $changes
     * @return list<string> kunci yang benar-benar berubah
     */
    public function update(array $changes, ?User $actor): array
    {
        $current = $this->all();
        $changed = [];

        DB::transaction(function () use ($changes, $current, $actor, &$changed) {
            foreach ($changes as $key => $value) {
                if (! isset(self::RULES[$key])) {
                    continue;
                }

                $new = (int) $value;
                $old = $current[$key];

                if ($new === $old) {
                    continue;
                }

                /*
                 * `updateOrInsert`, bukan `update`: kunci baru (mis.
                 * `trial.days` yang menggantikan kuota) belum punya baris di
                 * tabel, sehingga `update()` tidak melakukan apa pun dan nilai
                 * admin diam-diam hilang.
                 */
                DB::table('platform_settings')->updateOrInsert(
                    ['key' => $key],
                    ['value' => (string) $new, 'updated_at' => now()],
                );

                DB::table('platform_setting_changes')->insert([
                    'key' => $key,
                    'old_value' => (string) $old,
                    'new_value' => (string) $new,
                    'changed_by' => $actor?->id,
                    'created_at' => now(),
                ]);

                $changed[] = $key;
            }
        });

        if ($changed !== []) {
            $this->applyToConfig();
        }

        return $changed;
    }

    /**
     * Riwayat perubahan terbaru, sudah dilengkapi nama admin.
     *
     * @return list<array<string, mixed>>
     */
    public function history(int $limit = 20): array
    {
        if (! Schema::hasTable('platform_setting_changes')) {
            return [];
        }

        return DB::table('platform_setting_changes as c')
            ->leftJoin('users as u', 'u.id', '=', 'c.changed_by')
            ->orderByDesc('c.id')
            ->limit($limit)
            ->get(['c.key', 'c.old_value', 'c.new_value', 'c.created_at', 'u.name as actor_name'])
            ->map(fn ($row) => [
                'key' => $row->key,
                'oldValue' => $row->old_value,
                'newValue' => $row->new_value,
                'actorName' => $row->actor_name,
                'changedAt' => $row->created_at,
            ])
            ->all();
    }

    /**
     * Berapa vendor yang SEDANG dalam masa tenggang.
     *
     * Dipakai sebagai peringatan sebelum menyimpan: memperpendek masa tenggang
     * bisa langsung memutus akses vendor-vendor ini. Dihitung dari `ends_at`
     * yang sudah lewat tetapi belum melewati tenggang lama.
     */
    public function vendorsInGrace(): int
    {
        if (! Schema::hasTable('subscriptions')) {
            return 0;
        }

        $today = now()->startOfDay();
        $graceDays = $this->get('subscription.grace_days');

        return DB::table('subscriptions')
            ->where('status', 'active')
            ->whereNotNull('ends_at')
            ->whereDate('ends_at', '<', $today->toDateString())
            ->whereDate('ends_at', '>=', $today->copy()->subDays($graceDays)->toDateString())
            ->count();
    }
}
