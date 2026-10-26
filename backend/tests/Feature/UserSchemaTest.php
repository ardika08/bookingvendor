<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Skema pengguna & peran untuk "Masuk dengan Google" (PRD §6 users).
 *
 * Dua peran saja: vendor & admin. Akun masuk lewat Google — `google_id` unik
 * menjadi kunci pencocokan saat callback OAuth. Akun nonaktif tidak boleh bisa
 * masuk, tetapi datanya tetap utuh.
 */
class UserSchemaTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(array $overrides = []): User
    {
        static $sequence = 0;
        $sequence++;

        return User::create(array_merge([
            'name' => "Pengguna {$sequence}",
            'email' => "user{$sequence}@example.test",
            'password' => 'password',
        ], $overrides));
    }

    public function test_kolom_pengguna_lengkap(): void
    {
        foreach ([
            'id',
            'google_id',
            'name',
            'email',
            'avatar_url',
            'phone',
            'role',
            'is_active',
            'created_at',
            'updated_at',
        ] as $column) {
            $this->assertTrue(
                Schema::hasColumn('users', $column),
                "Kolom users.{$column} tidak ditemukan.",
            );
        }
    }

    public function test_nilai_default_akun_baru(): void
    {
        $user = $this->makeUser()->fresh();

        $this->assertSame('vendor', $user->role);
        $this->assertTrue($user->is_active);
        $this->assertNull($user->google_id);
        $this->assertNull($user->phone);
    }

    public function test_google_id_unik(): void
    {
        $this->makeUser(['google_id' => 'google-123']);

        $this->expectException(UniqueConstraintViolationException::class);

        $this->makeUser(['google_id' => 'google-123']);
    }

    public function test_google_id_boleh_kosong_untuk_lebih_dari_satu_akun(): void
    {
        $this->makeUser();
        $this->makeUser();

        $this->assertSame(2, User::query()->whereNull('google_id')->count());
    }

    public function test_peran_admin_dan_vendor(): void
    {
        // create() tidak mengembalikan nilai default DB — ambil ulang dari DB.
        $vendor = $this->makeUser()->fresh();
        $admin = $this->makeUser(['role' => User::ROLE_ADMIN])->fresh();

        $this->assertTrue($vendor->isVendor());
        $this->assertFalse($vendor->isAdmin());
        $this->assertTrue($admin->isAdmin());
        $this->assertFalse($admin->isVendor());
    }

    public function test_peran_luar_daftar_ditolak(): void
    {
        // Catatan: SQLite tidak menegakkan enum setelah ALTER TABLE, jadi
        // penegakan dilakukan di model. MySQL produksi tetap punya CHECK.
        $this->expectException(\InvalidArgumentException::class);

        $this->makeUser(['role' => 'superuser']);
    }

    public function test_scope_active_menyaring_akun_nonaktif(): void
    {
        $this->makeUser(['is_active' => true]);
        $this->makeUser(['is_active' => false]);

        $this->assertSame(1, User::query()->active()->count());
    }

    public function test_cari_berdasarkan_google_id(): void
    {
        $this->makeUser(['google_id' => 'google-abc']);

        $found = User::query()->byGoogleId('google-abc')->first();

        $this->assertNotNull($found);
        $this->assertSame('google-abc', $found->google_id);
    }

    public function test_menonaktifkan_akun_tidak_menghapus_data(): void
    {
        $user = $this->makeUser(['is_active' => true]);

        $user->update(['is_active' => false]);

        $this->assertFalse($user->fresh()->is_active);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_email_tetap_unik(): void
    {
        $this->makeUser(['email' => 'sama@example.test']);

        $this->expectException(UniqueConstraintViolationException::class);

        $this->makeUser(['email' => 'sama@example.test']);
    }

    public function test_akun_google_tanpa_kata_sandi_bisa_ada(): void
    {
        // Login hanya lewat Google — akun tidak pernah membuat kata sandi.
        $user = User::create([
            'name' => 'Vendor Google',
            'email' => 'google@example.test',
            'google_id' => 'google-xyz',
        ]);

        $this->assertNull($user->fresh()->password);
    }
}
