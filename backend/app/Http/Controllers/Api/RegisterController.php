<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Vendor;
use App\Services\NotificationMailer;
use App\Services\TrialStarter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * Pendaftaran vendor mandiri.
 *
 * Sebelumnya vendor hanya bisa dibuat admin, sehingga tidak ada corong masuk
 * untuk calon pelanggan. Endpoint ini membuka pendaftaran sendiri: vendor mengisi
 * data, langsung mendapat akses penuh selama masa uji (30 hari), tanpa
 * persetujuan admin.
 *
 * Keamanan yang tetap dijaga meski tanpa verifikasi admin:
 *   - **Rate limit per IP** — mencegah pembuatan akun massal dari satu mesin;
 *   - **Email unik** — satu email hanya boleh punya satu akun;
 *   - **Nomor WhatsApp unik** — mencegah satu orang membuat banyak akun untuk
 *     memperpanjang masa uji berkali-kali;
 *   - **Kata sandi minimal 8 karakter** — disimpan ter-hash (bcrypt).
 *
 * Email **tidak** diverifikasi lewat tautan: notifikasi hanya informasi, bukan
 * syarat masuk. Vendor langsung bisa memakai aplikasi setelah mendaftar.
 */
class RegisterController extends Controller
{
    /** Batas percobaan pendaftaran per IP per menit. */
    private const RATE_LIMIT_ATTEMPTS = 5;

    private const RATE_LIMIT_DECAY_SECONDS = 3600;

    public function __construct(private readonly TrialStarter $trials)
    {
    }

    /**
     * POST /api/register
     */
    public function store(Request $request): JsonResponse
    {
        $key = 'register:'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, self::RATE_LIMIT_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($key);

            return response()->json([
                'message' => 'Terlalu banyak percobaan pendaftaran. Coba lagi dalam '
                    .ceil($seconds / 60).' menit.',
                'code' => 'too_many_attempts',
            ], 429);
        }

        $validated = $request->validate([
            'owner_name' => ['required', 'string', 'max:100'],
            'vendor_name' => ['required', 'string', 'max:120'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'category_other' => ['nullable', 'string', 'max:60'],
            'phone' => ['required', 'string', 'max:20'],
            'email' => ['required', 'string', 'email', 'max:150'],
            'password' => ['required', 'string', 'min:8', 'max:100'],
        ], [
            'owner_name.required' => 'Nama pemilik wajib diisi.',
            'vendor_name.required' => 'Nama vendor wajib diisi.',
            'category_id.required' => 'Kategori vendor wajib dipilih.',
            'category_id.exists' => 'Kategori yang dipilih tidak dikenal.',
            'phone.required' => 'Nomor WhatsApp wajib diisi.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'password.required' => 'Kata sandi wajib diisi.',
            'password.min' => 'Kata sandi minimal 8 karakter.',
        ]);

        $email = strtolower(trim($validated['email']));

        $phone = $this->normalizePhone($validated['phone']);

        if (mb_strlen($phone) < 9) {
            RateLimiter::hit($key, self::RATE_LIMIT_DECAY_SECONDS);

            return response()->json([
                'message' => 'Nomor WhatsApp tidak valid.',
                'errors' => ['phone' => ['Nomor WhatsApp tidak valid.']],
            ], 422);
        }

        // Duplikat diperiksa sebelum menulis agar pesan errornya jelas.
        if (User::query()->where('email', $email)->exists()) {
            RateLimiter::hit($key, self::RATE_LIMIT_DECAY_SECONDS);

            return response()->json([
                'message' => 'Email ini sudah terdaftar. Silakan masuk dengan email tersebut.',
                'errors' => ['email' => ['Email ini sudah terdaftar.']],
                'code' => 'email_taken',
            ], 422);
        }

        $phoneTaken = Vendor::query()
            ->where(fn ($query) => $query->where('contact', $phone)->orWhere('contact', $validated['phone']))
            ->exists();

        if ($phoneTaken) {
            RateLimiter::hit($key, self::RATE_LIMIT_DECAY_SECONDS);

            return response()->json([
                'message' => 'Nomor WhatsApp ini sudah dipakai vendor lain.',
                'errors' => ['phone' => ['Nomor WhatsApp ini sudah dipakai vendor lain.']],
                'code' => 'phone_taken',
            ], 422);
        }

        $vendor = DB::transaction(function () use ($validated, $email, $phone): Vendor {
            $user = User::query()->create([
                'name' => $validated['owner_name'],
                'email' => $email,
                'phone' => $phone,
                'role' => User::ROLE_VENDOR,
                'is_active' => true,
                // Kata sandi di-hash (bcrypt). Masuk lewat POST /api/login.
                'password' => bcrypt($validated['password']),
            ]);

            $vendor = Vendor::query()->create([
                'user_id' => $user->id,
                'category_id' => $validated['category_id'],
                'category_other' => $this->categoryOther($validated),
                'name' => $validated['vendor_name'],
                'slug' => $this->uniqueSlug($validated['vendor_name']),
                'contact' => $phone,
                'contact_email' => $email,
                'is_active' => true,
                // Halaman jadwal publik tidak langsung aktif: vendor baru perlu
                // melengkapi profil dulu. Aplikasi internal tetap bisa dipakai.
                'schedule_link_active' => false,
            ]);

            // Masa uji 30 hari sejak hari ini.
            $this->trials->start($vendor);

            return $vendor;
        });

        RateLimiter::clear($key);

        // Login langsung supaya vendor tidak perlu mengulang lewat Google.
        Auth::login($vendor->user);

        $trialEndsAt = Subscription::query()
            ->where('vendor_id', $vendor->id)
            ->value('ends_at');

        // Notifikasi email: kegagalannya tidak menggagalkan pendaftaran
        // (lihat NotificationMailer).
        app(NotificationMailer::class)->sendVendorWelcome(
            $vendor,
            $this->trials->days(),
            $trialEndsAt !== null ? (string) $trialEndsAt : null,
        );

        Log::info('Vendor mendaftar sendiri', [
            'vendor_id' => $vendor->id,
            'user_id' => $vendor->user_id,
            'email' => $email,
        ]);

        return response()->json([
            'message' => 'Pendaftaran berhasil. Selamat mencoba!',
            'vendor' => [
                'id' => (string) $vendor->id,
                'name' => $vendor->name,
                'slug' => $vendor->slug,
            ],
            'trialDays' => $this->trials->days(),
            'trialEndsAt' => $trialEndsAt,
        ], 201);
    }

    /**
     * GET /api/register/categories
     *
     * Daftar kategori untuk dropdown formulir pendaftaran. Endpoint publik —
     * tidak butuh sesi karena dipakai sebelum vendor punya akun.
     */
    public function categories(): JsonResponse
    {
        $items = Category::query()
            /*
             * Urut `sort_order`, bukan `id`: pada instalasi baru, kategori
             * tambahan dibuat migrasi lebih dulu sehingga id-nya lebih kecil
             * dan "Wedding Organizer" jatuh ke bawah. Urutan id dijadikan
             * penentu kedua agar stabil bila ada nilai yang sama.
             */
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'name', 'slug'])
            ->map(fn (Category $category): array => [
                'id' => (string) $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                // Frontend menandai opsi ini agar menampilkan input teks bebas.
                'isOther' => $category->slug === 'lainnya',
            ])
            ->values()
            ->all();

        return response()->json($items);
    }

    /**
     * Normalisasi nomor WhatsApp ke bentuk `62…` tanpa pemisah.
     *
     * Dipakai juga untuk cek duplikat, supaya `0812…` dan `+62812…` dikenali
     * sebagai nomor yang sama.
     */
    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';

        if (str_starts_with($digits, '0')) {
            return '62'.substr($digits, 1);
        }

        if (str_starts_with($digits, '8')) {
            return '62'.$digits;
        }

        return $digits;
    }

    /**
     * Teks kategori bebas, hanya disimpan bila vendor memilih "Lainnya".
     *
     * @param  array<string, mixed>  $validated
     */
    private function categoryOther(array $validated): ?string
    {
        $other = trim((string) ($validated['category_other'] ?? ''));

        if ($other === '') {
            return null;
        }

        $isOtherCategory = Category::query()
            ->whereKey($validated['category_id'])
            ->where('slug', 'lainnya')
            ->exists();

        return $isOtherCategory ? $other : null;
    }

    /** Slug unik dari nama usaha (`lumen-wedding-story`, `…-2`, dst.). */
    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'vendor';
        $slug = $base;
        $suffix = 2;

        while (Vendor::query()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }
}
