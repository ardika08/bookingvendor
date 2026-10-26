<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Endpoint checkout langganan (Duitku QRIS).
 *
 * Gateway selalu di-fake: test tidak boleh bergantung pada jaringan atau
 * menghabiskan kuota transaksi sandbox.
 */
class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'duitku.merchant_code' => 'DS37116',
            'duitku.api_key' => 'rahasia-uji',
            'duitku.base_url' => 'https://sandbox.duitku.test/webapi/api/merchant',
            'duitku.methods' => ['SP', 'NQ'],
            'duitku.expiry_minutes' => 1440,
        ]);
    }

    public function test_katalog_paket_hanya_yang_punya_harga(): void
    {
        $this->vendorUser();

        Plan::query()->create([
            'code' => 'monthly', 'name' => 'Bulanan',
            'duration_months' => 1, 'price' => 50000, 'is_active' => true,
        ]);
        Plan::query()->create([
            'code' => 'quarterly', 'name' => '3 Bulan',
            'duration_months' => 3, 'price' => null, 'is_active' => true,
        ]);

        $response = $this->getJson('/api/plans')->assertOk();

        $this->assertCount(1, $response->json());
        $this->assertSame(50000, $response->json()[0]['price']);
    }

    public function test_metode_pembayaran_hanya_satu_qris(): void
    {
        $this->vendorUser();
        $this->plan();

        Http::fake([
            '*/getpaymentmethod' => Http::response([
                'paymentFee' => [
                    ['paymentMethod' => 'SP', 'paymentName' => 'SHOPEEPAY QRIS', 'totalFee' => '0'],
                    ['paymentMethod' => 'NQ', 'paymentName' => 'NOBU QRIS', 'totalFee' => '0'],
                    ['paymentMethod' => 'BC', 'paymentName' => 'BCA VA', 'totalFee' => '0'],
                ],
            ], 200),
        ]);

        $methods = $this->getJson('/api/subscription/checkout/methods')->assertOk()->json();

        // Dua kanal QRIS Duitku tidak boleh jadi dua kartu di UI.
        $this->assertCount(1, $methods);
        $this->assertSame('qris', $methods[0]['code']);
    }

    public function test_ringkasan_checkout_tidak_membuat_transaksi(): void
    {
        $this->vendorUser();
        $plan = $this->plan();

        $this->getJson('/api/subscription/checkout?plan_id='.$plan->id)
            ->assertOk()
            ->assertJsonPath('step', 'summary')
            ->assertJsonPath('plan.id', (string) $plan->id);

        $this->assertSame(0, SubscriptionPayment::query()->count());
    }

    public function test_membuat_transaksi_mengembalikan_qr(): void
    {
        $this->vendorUser();
        $plan = $this->plan();

        Http::fake([
            '*/v2/inquiry' => Http::response([
                'statusCode' => '00',
                'statusMessage' => 'SUCCESS',
                'reference' => 'REF-123',
                'paymentUrl' => 'https://sandbox.duitku.test/pay/abc',
                'qrString' => '0002010102122661',
                'amount' => '50000',
            ], 200),
        ]);

        $response = $this->postJson('/api/subscription/checkout', ['plan_id' => (string) $plan->id])
            ->assertCreated()
            // Transaksi lahir di langkah ringkasan; QR muncul setelah vendor
            // memilih metode (lihat test pemilihan metode di bawah).
            ->assertJsonPath('step', 'summary');

        $payment = SubscriptionPayment::query()->first();
        $this->assertNotNull($payment);
        $this->assertSame('pending', $payment->status);
        $this->assertSame('duitku', $payment->gateway);
        $this->assertNotNull($payment->expires_at);
        $this->assertSame('0002010102122661', $payment->raw_payload['qrString']);
        $this->assertSame((string) $payment->id, $response->json('id'));
    }

    public function test_memilih_metode_mengembalikan_qr_untuk_dipindai(): void
    {
        $this->vendorUser();
        $plan = $this->plan();

        Http::fake([
            '*/v2/inquiry' => Http::response([
                'statusCode' => '00',
                'reference' => 'REF-123',
                'paymentUrl' => 'https://sandbox.duitku.test/pay/abc',
                'qrString' => '0002010102122661',
                'amount' => '50000',
            ], 200),
        ]);

        $created = $this->postJson('/api/subscription/checkout', ['plan_id' => (string) $plan->id])
            ->assertCreated();

        $this->postJson('/api/payments/'.$created->json('id').'/method', ['method' => 'qris'])
            ->assertOk()
            ->assertJsonPath('step', 'instructions')
            ->assertJsonPath('selectedMethod', 'qris')
            ->assertJsonPath('methodInstructions.qrString', '0002010102122661')
            // URL bayar dipakai sebagai cadangan bila QR gagal dipindai.
            ->assertJsonPath('methodInstructions.qrCodeUrl', 'https://sandbox.duitku.test/pay/abc');
    }

    public function test_transaksi_pending_yang_sama_dipakai_ulang(): void
    {
        $this->vendorUser();
        $plan = $this->plan();

        Http::fake([
            '*/v2/inquiry' => Http::response([
                'statusCode' => '00',
                'reference' => 'REF-123',
                'qrString' => '00020101',
                'amount' => '50000',
            ], 200),
        ]);

        $this->postJson('/api/subscription/checkout', ['plan_id' => (string) $plan->id])->assertCreated();
        $this->postJson('/api/subscription/checkout', ['plan_id' => (string) $plan->id])->assertOk();

        // Tidak menumpuk tagihan ganda di sisi gateway.
        $this->assertSame(1, SubscriptionPayment::query()->count());
    }

    public function test_gateway_menolak_transaksi_dibalas_502(): void
    {
        $this->vendorUser();
        $plan = $this->plan();

        Http::fake([
            '*/v2/inquiry' => Http::response(['Message' => 'Wrong signature'], 401),
        ]);

        $this->postJson('/api/subscription/checkout', ['plan_id' => (string) $plan->id])
            ->assertStatus(502)
            ->assertJsonPath('code', 'gateway_error');

        $this->assertSame(0, SubscriptionPayment::query()->count());
    }

    public function test_transaksi_vendor_lain_tidak_bisa_dibaca(): void
    {
        $this->vendorUser();
        $plan = $this->plan();

        $lain = User::query()->create([
            'name' => 'Vendor Lain', 'email' => 'lain@example.com', 'role' => User::ROLE_VENDOR,
        ]);
        $vendorLain = Vendor::query()->create([
            'user_id' => $lain->id, 'name' => 'Vendor Lain', 'slug' => 'vendor-lain',
        ]);

        $payment = SubscriptionPayment::query()->create([
            'vendor_id' => $vendorLain->id,
            'plan_id' => $plan->id,
            'order_id' => 'SUB-LAIN',
            'gateway' => 'duitku',
            'amount' => 50000,
            'status' => 'pending',
        ]);

        // 404, bukan 403 — tidak membocorkan keberadaan transaksi.
        $this->getJson('/api/payments/'.$payment->id.'/status')->assertNotFound();
    }

    public function test_paket_tanpa_harga_tidak_bisa_dibeli(): void
    {
        $this->vendorUser();

        $plan = Plan::query()->create([
            'code' => 'yearly', 'name' => 'Tahunan',
            'duration_months' => 12, 'price' => null, 'is_active' => true,
        ]);

        $this->postJson('/api/subscription/checkout', ['plan_id' => (string) $plan->id])
            ->assertNotFound()
            ->assertJsonPath('code', 'plan_not_found');
    }

    // -----------------------------------------------------------------------

    private function plan(): Plan
    {
        return Plan::query()->create([
            'code' => 'monthly',
            'name' => 'Bulanan',
            'duration_months' => 1,
            'price' => 50000,
            'is_active' => true,
        ]);
    }

    private function vendorUser(): User
    {
        $user = User::query()->create([
            'name' => 'Vendor Uji',
            'email' => 'vendor-checkout@example.com',
            'role' => User::ROLE_VENDOR,
        ]);

        Vendor::query()->create([
            'user_id' => $user->id,
            'name' => 'Vendor Uji',
            'slug' => 'vendor-checkout',
        ]);

        $this->loginAs($user->fresh());

        return $user;
    }
}
