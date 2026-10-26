<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji endpoint profil akun pengguna ("Akun Saya").
 *
 * Akun berbeda dari profil usaha: hanya nama & nomor HP yang bisa diubah.
 * Email dan foto berasal dari Google dan tidak diterima lewat endpoint ini.
 */
class UserProfileApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Dika Pratama',
            'email' => 'dika@lumenwedding.id',
            'phone' => '0812-9000-1122',
            'role' => 'vendor',
            'avatar_url' => 'https://example.test/avatar.png',
        ]);

        $this->loginAs($this->user);
    }

    public function test_menampilkan_profil_akun(): void
    {
        $this->getJson('/api/user/profile')
            ->assertOk()
            ->assertJsonPath('id', (string) $this->user->id)
            ->assertJsonPath('name', 'Dika Pratama')
            ->assertJsonPath('email', 'dika@lumenwedding.id')
            ->assertJsonPath('phone', '0812-9000-1122')
            ->assertJsonPath('avatarUrl', 'https://example.test/avatar.png')
            ->assertJsonPath('role', 'vendor');
    }

    public function test_menyimpan_nama_dan_nomor_hp(): void
    {
        $this->putJson('/api/user/profile', [
            'name' => 'Dika P.',
            'phone' => '081311112222',
        ])
            ->assertOk()
            ->assertJsonPath('name', 'Dika P.')
            ->assertJsonPath('phone', '081311112222');

        $this->assertDatabaseHas('users', [
            'id' => $this->user->id,
            'name' => 'Dika P.',
            'phone' => '081311112222',
        ]);
    }

    public function test_email_tidak_bisa_diubah(): void
    {
        $this->putJson('/api/user/profile', [
            'name' => 'Dika Pratama',
            'email' => 'palsu@example.test',
            'avatar_url' => 'https://palsu.test/x.png',
        ])->assertOk();

        $fresh = $this->user->fresh();
        $this->assertSame('dika@lumenwedding.id', $fresh->email);
        $this->assertSame('https://example.test/avatar.png', $fresh->avatar_url);
    }

    public function test_nomor_hp_bisa_dikosongkan(): void
    {
        $this->putJson('/api/user/profile', [
            'name' => 'Dika Pratama',
            'phone' => null,
        ])
            ->assertOk()
            ->assertJsonPath('phone', null);

        $this->assertNull($this->user->fresh()->phone);
    }

    public function test_nama_wajib_diisi(): void
    {
        $this->putJson('/api/user/profile', ['name' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_format_nomor_tidak_valid_ditolak(): void
    {
        $this->putJson('/api/user/profile', [
            'name' => 'Dika Pratama',
            'phone' => '12345',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');
    }

    public function test_admin_juga_punya_profil_akun(): void
    {
        $admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@bookingvendor.id',
            'role' => 'admin',
        ]);

        // Mode pengembangan tanpa sesi memakai akun pertama (vendor).
        $this->getJson('/api/user/profile')->assertOk()->assertJsonPath('role', 'vendor');

        $this->getJson('/api/user/profile')->assertOk();

        $this->assertDatabaseHas('users', ['id' => $admin->id, 'role' => 'admin']);
    }
public function test_profil_diambil_sesuai_akun_yang_login(): void
    {
        $admin = User::create([
            'name' => 'Admin Platform',
            'email' => 'admin2@bookingvendor.id',
            'role' => 'admin',
        ]);

        $this->actingAs($admin)
            ->getJson('/api/user/profile')
            ->assertOk()
            ->assertJsonPath('id', (string) $admin->id)
            ->assertJsonPath('name', 'Admin Platform')
            ->assertJsonPath('role', 'admin');
    }

    public function test_tanpa_sesi_ditolak_401(): void
    {
        // Sebelum auth aktif, endpoint ini menjawab 404 "akun tidak ditemukan"
        // karena memakai fallback pengguna pertama. Sekarang tanpa sesi
        // permintaan harus ditolak di lapisan auth, bukan di controller.
        $this->loginAs(null);

        $this->getJson('/api/user/profile')
            ->assertUnauthorized()
            ->assertJsonPath('code', 'unauthenticated');
    }

    public function test_profil_menampilkan_nilai_terbaru_setelah_disimpan(): void
    {
        $this->putJson('/api/user/profile', [
            'name' => 'Nama Baru',
            'phone' => '081355556666',
        ])->assertOk();

        $this->getJson('/api/user/profile')
            ->assertOk()
            ->assertJsonPath('name', 'Nama Baru')
            ->assertJsonPath('phone', '081355556666');
    }
}