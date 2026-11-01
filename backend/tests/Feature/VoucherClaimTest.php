<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Voucher;
use App\Models\VoucherRedemption;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Uji klaim voucher oleh vendor.
 *
 * Aturan yang diuji:
 * - hanya tipe `free_months` yang bisa diklaim di endpoint ini
 * - sekali per vendor (kode sama tidak bisa dipakai dua kali)
 * - kuota total dihormati
 * - masa berlaku (belum mulai / sudah lewat) dihormati
 * - kode nonaktif ditolak
 * - masa aktif bertambah sesuai jumlah bulan voucher, bukan durasi paket
 */
class VoucherClaimTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;

    private Plan $monthly;

    private Plan $yearly;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Dika Pratama',
            'email' => 'dika@example.test',
            'password' => 'password',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
        ]);

        $this->monthly = Plan::create([
            'code' => 'monthly',
            'name' => '1 Bulan',
            'duration_months' => 1,
            'price' => 50000,
            'is_active' => true,
        ]);

        $this->yearly = Plan::create([
            'code' => 'yearly',
            'name' => '12 Bulan',
            'duration_months' => 12,
            'price' => 480000,
            'is_active' => true,
        ]);
    }

    private function makeVoucher(array $overrides = []): Voucher
    {
        return Voucher::create([
            'code' => 'GRATIS1',
            'type' => Voucher::TYPE_FREE_MONTHS,
            'free_months' => 1,
            'plan_id' => $this->monthly->id,
            'is_active' => true,
            ...$overrides,
        ]);
    }

    public function test_vendor_can_claim_free_months_voucher(): void
    {
        $this->makeVoucher();
        $this->loginAsVendorOf($this->vendor);

        $response = $this->postJson('/api/subscription/voucher', ['code' => 'GRATIS1']);

        $response->assertOk()
            ->assertJsonPath('code', 'GRATIS1')
            ->assertJsonPath('granted_months', 1);

        $this->assertDatabaseHas('voucher_redemptions', [
            'voucher_id' => Voucher::first()->id,
            'vendor_id' => $this->vendor->id,
            'granted_months' => 1,
        ]);

        // Penghitung ikut naik supaya admin bisa melihat pemakaian.
        $this->assertSame(1, Voucher::first()->refresh()->used_count);
    }

    public function test_claiming_extends_subscription_by_voucher_months(): void
    {
        $this->makeVoucher(['free_months' => 3]);
        $this->loginAsVendorOf($this->vendor);

        $this->postJson('/api/subscription/voucher', ['code' => 'GRATIS1'])->assertOk();

        $subscription = Subscription::query()->where('vendor_id', $this->vendor->id)->first();

        $this->assertNotNull($subscription);
        $this->assertSame(Subscription::STATUS_ACTIVE, $subscription->status);

        // Durasi mengikuti voucher (3 bulan), bukan durasi paket (1 bulan).
        $starts = Carbon::parse($subscription->starts_at);
        $ends = Carbon::parse($subscription->ends_at);

        $this->assertSame(3, (int) round($starts->diffInMonths($ends)));
    }

    public function test_same_vendor_cannot_use_code_twice(): void
    {
        $this->makeVoucher();
        $this->loginAsVendorOf($this->vendor);

        $this->postJson('/api/subscription/voucher', ['code' => 'GRATIS1'])->assertOk();

        $this->postJson('/api/subscription/voucher', ['code' => 'GRATIS1'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');

        // Hanya satu baris riwayat, dan penghitung tidak bertambah dua kali.
        $this->assertSame(1, VoucherRedemption::count());
        $this->assertSame(1, Voucher::first()->refresh()->used_count);
    }

    public function test_code_is_case_insensitive_when_claimed(): void
    {
        $this->makeVoucher();
        $this->loginAsVendorOf($this->vendor);

        $this->postJson('/api/subscription/voucher', ['code' => 'gratis1'])->assertOk();
    }

    public function test_total_quota_is_enforced(): void
    {
        $voucher = $this->makeVoucher(['max_uses' => 1]);

        // Vendor pertama menghabiskan kuota.
        $this->loginAsVendorOf($this->vendor);
        $this->postJson('/api/subscription/voucher', ['code' => 'GRATIS1'])->assertOk();

        // Vendor kedua ditolak karena kuota habis.
        $other = User::create([
            'name' => 'Vendor Lain',
            'email' => 'lain@example.test',
            'password' => 'password',
        ]);
        $otherVendor = Vendor::create([
            'user_id' => $other->id,
            'name' => 'Vendor Lain',
            'slug' => 'vendor-lain',
        ]);

        $this->loginAsVendorOf($otherVendor);

        $this->postJson('/api/subscription/voucher', ['code' => 'GRATIS1'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');

        $this->assertSame(1, $voucher->refresh()->used_count);
    }

    public function test_expired_voucher_is_rejected(): void
    {
        $this->makeVoucher(['expires_at' => now()->subMinute()]);
        $this->loginAsVendorOf($this->vendor);

        $this->postJson('/api/subscription/voucher', ['code' => 'GRATIS1'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');

        $this->assertSame(0, VoucherRedemption::count());
    }

    public function test_not_yet_started_voucher_is_rejected(): void
    {
        $this->makeVoucher(['starts_at' => now()->addDay()]);
        $this->loginAsVendorOf($this->vendor);

        $this->postJson('/api/subscription/voucher', ['code' => 'GRATIS1'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');

        $this->assertSame(0, VoucherRedemption::count());
    }

    public function test_inactive_voucher_is_rejected(): void
    {
        $this->makeVoucher(['is_active' => false]);
        $this->loginAsVendorOf($this->vendor);

        $this->postJson('/api/subscription/voucher', ['code' => 'GRATIS1'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');
    }

    public function test_unknown_code_is_rejected(): void
    {
        $this->loginAsVendorOf($this->vendor);

        $this->postJson('/api/subscription/voucher', ['code' => 'TIDAKADA'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');
    }

    public function test_discount_voucher_cannot_be_claimed_here(): void
    {
        Voucher::create([
            'code' => 'HEMAT50',
            'type' => Voucher::TYPE_DISCOUNT,
            'discount_kind' => Voucher::DISCOUNT_PERCENT,
            'discount_percent' => 50,
            'is_active' => true,
        ]);

        $this->loginAsVendorOf($this->vendor);

        // Voucher diskon dipakai saat checkout, bukan diklaim di sini.
        $this->postJson('/api/subscription/voucher', ['code' => 'HEMAT50'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');

        $this->assertSame(0, VoucherRedemption::count());
    }

    public function test_empty_code_is_rejected(): void
    {
        $this->loginAsVendorOf($this->vendor);

        $this->postJson('/api/subscription/voucher', ['code' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');
    }

    public function test_guest_cannot_claim_voucher(): void
    {
        $this->makeVoucher();

        $this->postJson('/api/subscription/voucher', ['code' => 'GRATIS1'])
            ->assertUnauthorized();
    }

    public function test_history_lists_claimed_vouchers(): void
    {
        $this->makeVoucher();
        $this->loginAsVendorOf($this->vendor);

        $this->postJson('/api/subscription/voucher', ['code' => 'GRATIS1'])->assertOk();

        $this->getJson('/api/subscription/voucher')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.code', 'GRATIS1')
            ->assertJsonPath('0.granted_months', 1);
    }

    public function test_voucher_without_plan_uses_cheapest_active_plan(): void
    {
        // plan_id kosong: paket termurah aktif dipakai supaya "1 bulan gratis"
        // tidak pernah tanpa sengaja memberi paket tahunan.
        $this->makeVoucher(['plan_id' => null]);
        $this->loginAsVendorOf($this->vendor);

        $this->postJson('/api/subscription/voucher', ['code' => 'GRATIS1'])->assertOk();

        $subscription = Subscription::query()->where('vendor_id', $this->vendor->id)->first();

        $this->assertSame($this->monthly->id, $subscription->plan_id);
    }
}
