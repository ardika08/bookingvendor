<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Voucher;
use App\Models\VoucherRedemption;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji API voucher dari sisi admin: buat, ubah, nonaktifkan, daftar.
 *
 * Yang dijaga di sini adalah validasi input, bukan logika klaim (lihat
 * VoucherClaimTest untuk itu).
 */
class AdminVoucherApiTest extends TestCase
{
    use RefreshDatabase;

    private Plan $monthly;

    protected function setUp(): void
    {
        parent::setUp();

        $this->loginAsAdmin();

        $this->monthly = Plan::create([
            'code' => 'monthly',
            'name' => '1 Bulan',
            'duration_months' => 1,
            'price' => 50000,
            'is_active' => true,
        ]);
    }

    public function test_admin_can_create_free_months_voucher(): void
    {
        $response = $this->postJson('/api/admin/vouchers', [
            'code' => 'gratis1bulan',
            'description' => 'Promo launching',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
            'plan_id' => $this->monthly->id,
            'max_uses' => 10,
        ]);

        $response->assertCreated()
            ->assertJsonPath('code', 'GRATIS1BULAN')
            ->assertJsonPath('type', 'free_months')
            ->assertJsonPath('free_months', 1)
            ->assertJsonPath('used_count', 0)
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('discount_label', '1 bulan gratis');

        $this->assertDatabaseHas('vouchers', [
            'code' => 'GRATIS1BULAN',
            'type' => 'free_months',
            'max_uses' => 10,
        ]);
    }

    public function test_code_is_normalized_to_uppercase(): void
    {
        $this->postJson('/api/admin/vouchers', [
            'code' => '  hemat50  ',
            'type' => Voucher::TYPE_DISCOUNT,
            'discount_kind' => Voucher::DISCOUNT_PERCENT,
            'discount_percent' => 50,
        ])->assertCreated()->assertJsonPath('code', 'HEMAT50');
    }

    public function test_admin_can_create_percent_discount_voucher(): void
    {
        $this->postJson('/api/admin/vouchers', [
            'code' => 'HEMAT50',
            'type' => Voucher::TYPE_DISCOUNT,
            'discount_kind' => Voucher::DISCOUNT_PERCENT,
            'discount_percent' => 50,
        ])->assertCreated()
            ->assertJsonPath('discount_label', '50% potongan');
    }

    public function test_admin_can_create_amount_discount_voucher(): void
    {
        $this->postJson('/api/admin/vouchers', [
            'code' => 'POTONG20RB',
            'type' => Voucher::TYPE_DISCOUNT,
            'discount_kind' => Voucher::DISCOUNT_AMOUNT,
            'discount_amount' => 20000,
        ])->assertCreated()
            ->assertJsonPath('discount_label', 'Potongan Rp 20.000');
    }

    public function test_free_months_voucher_requires_month_count(): void
    {
        $this->postJson('/api/admin/vouchers', [
            'code' => 'TANPABULAN',
            'type' => Voucher::TYPE_FREE_MONTHS,
        ])->assertStatus(422)->assertJsonValidationErrors('free_months');
    }

    public function test_discount_voucher_requires_value_for_chosen_kind(): void
    {
        $this->postJson('/api/admin/vouchers', [
            'code' => 'TANPANILAI',
            'type' => Voucher::TYPE_DISCOUNT,
            'discount_kind' => Voucher::DISCOUNT_PERCENT,
        ])->assertStatus(422)->assertJsonValidationErrors('discount_percent');
    }

    public function test_duplicate_code_is_rejected(): void
    {
        Voucher::create([
            'code' => 'DOBEL',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
            'is_active' => true,
        ]);

        $this->postJson('/api/admin/vouchers', [
            'code' => 'DOBEL',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
        ])->assertStatus(422)->assertJsonValidationErrors('code');
    }

    public function test_code_with_spaces_is_rejected(): void
    {
        $this->postJson('/api/admin/vouchers', [
            'code' => 'ADA SPASI',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
        ])->assertStatus(422)->assertJsonValidationErrors('code');
    }

    public function test_expires_at_must_be_after_starts_at(): void
    {
        $this->postJson('/api/admin/vouchers', [
            'code' => 'TERBALIK',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
            'starts_at' => '2026-12-31 00:00:00',
            'expires_at' => '2026-12-01 00:00:00',
        ])->assertStatus(422)->assertJsonValidationErrors('expires_at');
    }

    public function test_changing_type_clears_columns_of_other_type(): void
    {
        $voucher = Voucher::create([
            'code' => 'GANTITIPE',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 3,
            'is_active' => true,
        ]);

        $this->patchJson("/api/admin/vouchers/{$voucher->id}", [
            'type' => Voucher::TYPE_DISCOUNT,
            'discount_kind' => Voucher::DISCOUNT_PERCENT,
            'discount_percent' => 25,
        ])->assertOk()->assertJsonPath('type', 'discount');

        $fresh = $voucher->refresh();

        // Kolom tipe lama harus kosong, supaya tidak ada data menggantung yang
        // membingungkan saat voucher diedit lagi.
        $this->assertNull($fresh->free_months);
        $this->assertSame(25, $fresh->discount_percent);
    }

    public function test_admin_can_deactivate_voucher_without_deleting_it(): void
    {
        $voucher = Voucher::create([
            'code' => 'MATIKAN',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
            'is_active' => true,
        ]);

        $this->patchJson("/api/admin/vouchers/{$voucher->id}/status", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('is_active', false)
            ->assertJsonPath('status', 'inactive');

        // Baris tetap ada — riwayat pemakaian tidak boleh hilang.
        $this->assertDatabaseHas('vouchers', ['code' => 'MATIKAN', 'is_active' => false]);
    }

    public function test_index_returns_derived_status(): void
    {
        Voucher::create([
            'code' => 'AKTIF',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
            'is_active' => true,
        ]);

        Voucher::create([
            'code' => 'KEDALUWARSA',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
            'is_active' => true,
            'expires_at' => now()->subDay(),
        ]);

        Voucher::create([
            'code' => 'HABIS',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
            'is_active' => true,
            'max_uses' => 2,
            'used_count' => 2,
        ]);

        Voucher::create([
            'code' => 'NANTI',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
            'is_active' => true,
            'starts_at' => now()->addDay(),
        ]);

        $response = $this->getJson('/api/admin/vouchers')->assertOk();

        $byCode = collect($response->json())->keyBy('code');

        $this->assertSame('active', $byCode['AKTIF']['status']);
        $this->assertSame('expired', $byCode['KEDALUWARSA']['status']);
        $this->assertSame('exhausted', $byCode['HABIS']['status']);
        $this->assertSame('scheduled', $byCode['NANTI']['status']);
    }

    public function test_index_can_filter_by_status(): void
    {
        Voucher::create([
            'code' => 'AKTIF',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
            'is_active' => true,
        ]);
        Voucher::create([
            'code' => 'MATI',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
            'is_active' => false,
        ]);

        $response = $this->getJson('/api/admin/vouchers?status=inactive')->assertOk();

        $codes = collect($response->json())->pluck('code');

        $this->assertTrue($codes->contains('MATI'));
        $this->assertFalse($codes->contains('AKTIF'));
    }

    public function test_vendor_cannot_access_admin_voucher_endpoints(): void
    {
        $user = User::create([
            'name' => 'Vendor Biasa',
            'email' => 'vendor@example.test',
            'password' => 'password',
        ]);

        Vendor::create([
            'user_id' => $user->id,
            'name' => 'Vendor Biasa',
            'slug' => 'vendor-biasa',
        ]);

        $this->loginAs($user);

        $this->getJson('/api/admin/vouchers')->assertForbidden();
        $this->postJson('/api/admin/vouchers', [
            'code' => 'COBA',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
        ])->assertForbidden();
    }
}
