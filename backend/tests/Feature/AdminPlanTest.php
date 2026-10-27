<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Katalog paket langganan dari sisi admin.
 *
 * Istilah harga mengikuti pemilik produk:
 * - `price`        = harga coret / harga promo (angka yang dibayar vendor)
 * - `normal_price` = harga normal sebelum diskon (ditampilkan dicoret)
 */
class AdminPlanTest extends TestCase
{
    use RefreshDatabase;

    private function buatAdmin(): User
    {
        return User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'is_active' => true,
        ]);
    }

    private function buatPaket(string $name = 'Bulanan', int $months = 1): Plan
    {
        return Plan::create([
            'code' => 'monthly',
            'name' => $name,
            'duration_months' => $months,
            'price' => 50000,
            'is_active' => true,
        ]);
    }

    public function test_index_mengembalikan_daftar_paket(): void
    {
        $admin = $this->buatAdmin();
        $this->buatPaket();

        $this->actingAs($admin)
            ->getJson('/api/admin/plans')
            ->assertOk()
            ->assertJsonPath('0.name', 'Bulanan')
            ->assertJsonPath('0.durationMonths', 1);
    }

    /**
     * Kartu katalog admin dan vendor memakai komponen yang sama, jadi admin
     * harus menerima daftar manfaat yang sama dengan yang dilihat vendor.
     * Tanpa ini, pratinjau di panel admin tidak mencerminkan kenyataan.
     */
    public function test_index_menyertakan_manfaat_sama_seperti_katalog_vendor(): void
    {
        $admin = $this->buatAdmin();
        $plan = $this->buatPaket('Paket Tiga Bulan', 3);

        $adminBenefits = $this->actingAs($admin)
            ->getJson('/api/admin/plans')
            ->assertOk()
            ->json('0.benefits');

        $vendorBenefits = $this->actingAs($admin)
            ->getJson('/api/plans')
            ->assertOk()
            ->json('0.benefits');

        $this->assertSame($vendorBenefits, $adminBenefits);
        $this->assertContains('Aktif 3 bulan', $adminBenefits);
        $this->assertSame($plan->duration_months, 3);
    }

    public function test_admin_bisa_tambah_paket_baru(): void
    {
        $admin = $this->buatAdmin();

        $response = $this->actingAs($admin)->postJson('/api/admin/plans', [
            'name' => 'Paket Hemat',
            'duration_months' => 3,
            'price' => 99000,
            'normal_price' => 150000,
            'description' => 'Cocok untuk vendor yang baru mulai.',
        ]);

        $response->assertCreated()
            ->assertJsonPath('name', 'Paket Hemat')
            ->assertJsonPath('durationMonths', 3)
            ->assertJsonPath('price', 99000)
            ->assertJsonPath('normalPrice', 150000)
            ->assertJsonPath('description', 'Cocok untuk vendor yang baru mulai.');

        $this->assertDatabaseHas('plans', ['name' => 'Paket Hemat']);
    }

    public function test_tambah_paket_tanpa_harga_tetap_boleh(): void
    {
        $admin = $this->buatAdmin();

        $this->actingAs($admin)
            ->postJson('/api/admin/plans', [
                'name' => 'Paket Nanti',
                'duration_months' => 6,
            ])
            ->assertCreated()
            ->assertJsonPath('price', null);
    }

    public function test_tambah_paket_menolak_nama_kosong(): void
    {
        $admin = $this->buatAdmin();

        $this->actingAs($admin)
            ->postJson('/api/admin/plans', ['duration_months' => 1])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_harga_normal_harus_lebih_besar_dari_harga_coret(): void
    {
        $admin = $this->buatAdmin();

        // Harga normal 50rb < harga coret 99rb -> tidak masuk akal (diskon negatif).
        $this->actingAs($admin)
            ->postJson('/api/admin/plans', [
                'name' => 'Paket Salah',
                'duration_months' => 1,
                'price' => 99000,
                'normal_price' => 50000,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('normal_price');
    }

    public function test_admin_bisa_ubah_nama_dan_harga_paket(): void
    {
        $admin = $this->buatAdmin();
        $plan = $this->buatPaket('Bulanan', 1);

        $this->actingAs($admin)
            ->patchJson("/api/admin/plans/{$plan->id}", [
                'name' => 'Bulanan Plus',
                'duration_months' => 2,
                'price' => 75000,
                'normal_price' => 100000,
                'description' => 'Deskripsi baru.',
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Bulanan Plus')
            ->assertJsonPath('durationMonths', 2)
            ->assertJsonPath('price', 75000)
            ->assertJsonPath('normalPrice', 100000)
            ->assertJsonPath('description', 'Deskripsi baru.');

        $this->assertDatabaseHas('plans', [
            'id' => $plan->id,
            'name' => 'Bulanan Plus',
        ]);
    }

    public function test_admin_bisa_hapus_paket_yang_belum_dipakai(): void
    {
        $admin = $this->buatAdmin();
        $plan = $this->buatPaket();

        $this->actingAs($admin)
            ->deleteJson("/api/admin/plans/{$plan->id}")
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->assertDatabaseMissing('plans', ['id' => $plan->id]);
    }

    public function test_paket_yang_sudah_dipakai_tidak_bisa_dihapus(): void
    {
        $admin = $this->buatAdmin();
        $plan = $this->buatPaket();

        $user = User::factory()->create(['role' => User::ROLE_VENDOR, 'is_active' => true]);
        $vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Vendor Uji',
            'slug' => 'vendor-uji',
            'is_active' => true,
        ]);
        Subscription::create([
            'vendor_id' => $vendor->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'starts_at' => now()->toDateString(),
            'ends_at' => now()->addMonth()->toDateString(),
        ]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/plans/{$plan->id}")
            ->assertStatus(409)
            ->assertJsonPath('code', 'plan_in_use');

        // Paket harus tetap ada supaya riwayat langganan tidak putus.
        $this->assertDatabaseHas('plans', ['id' => $plan->id]);
    }

    public function test_paket_dengan_riwayat_pembayaran_tidak_bisa_dihapus(): void
    {
        $admin = $this->buatAdmin();
        $plan = $this->buatPaket();

        $user = User::factory()->create(['role' => User::ROLE_VENDOR, 'is_active' => true]);
        $vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Vendor Uji',
            'slug' => 'vendor-uji-2',
            'is_active' => true,
        ]);
        SubscriptionPayment::create([
            'vendor_id' => $vendor->id,
            'plan_id' => $plan->id,
            'order_id' => 'ORD-1',
            'gateway' => 'duitku',
            'amount' => 50000,
            'status' => 'paid',
            'paid_at' => now(),
        ]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/plans/{$plan->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('plans', ['id' => $plan->id]);
    }

    public function test_vendor_tidak_boleh_mengelola_paket(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_VENDOR, 'is_active' => true]);
        Vendor::create([
            'user_id' => $user->id,
            'name' => 'Vendor Uji',
            'slug' => 'vendor-uji-3',
            'is_active' => true,
        ]);

        $this->actingAs($user)->getJson('/api/admin/plans')->assertForbidden();
        $this->actingAs($user)->postJson('/api/admin/plans', [
            'name' => 'Nakal',
            'duration_months' => 1,
        ])->assertForbidden();
    }

    public function test_tanpa_login_ditolak(): void
    {
        $this->getJson('/api/admin/plans')->assertUnauthorized();
    }
}
