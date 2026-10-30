<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Models\Vendor;
use App\Services\SubscriptionActivator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Callback Duitku dan aktivasi langganan.
 *
 * Yang diuji adalah jalur uang: siapa pun yang bisa memicu aktivasi tanpa
 * pembayaran nyata berarti kebocoran pendapatan. Karena itu test di sini
 * mencakup signature salah, nominal salah, dan pemalsuan status.
 */
class DuitkuCallbackTest extends TestCase
{
    use RefreshDatabase;

    private const MERCHANT = 'DS37116';
    private const KEY = 'rahasia-uji';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'duitku.merchant_code' => self::MERCHANT,
            'duitku.api_key' => self::KEY,
            'duitku.sandbox' => true,
            'duitku.base_url' => 'https://sandbox.duitku.test/webapi/api/merchant',
        ]);
    }

    public function test_callback_signature_sah_mengaktifkan_langganan(): void
    {
        [$payment, $vendor] = $this->pendingPayment();

        $this->fakeGatewayStatus('00');

        $this->postJson('/api/webhooks/duitku', $this->callbackPayload($payment, '00'))
            ->assertOk();

        $payment->refresh();
        $this->assertSame('paid', $payment->status);
        $this->assertNotNull($payment->paid_at);

        $subscription = Subscription::query()->where('vendor_id', $vendor->id)->first();
        $this->assertNotNull($subscription);
        $this->assertSame('active', $subscription->status);
        $this->assertNotNull($subscription->ends_at);
    }

    public function test_signature_salah_ditolak_dan_tidak_mengaktifkan(): void
    {
        [$payment, $vendor] = $this->pendingPayment();

        $payload = $this->callbackPayload($payment, '00');
        $payload['signature'] = md5('signature-palsu');

        $this->postJson('/api/webhooks/duitku', $payload)->assertStatus(401);

        $this->assertSame('pending', $payment->refresh()->status);
        $this->assertNull(Subscription::query()->where('vendor_id', $vendor->id)->first()?->ends_at);
    }

    public function test_nominal_tidak_cocok_ditolak(): void
    {
        [$payment] = $this->pendingPayment();

        $payload = $this->callbackPayload($payment, '00');
        $payload['amount'] = '1000';
        // Signature dihitung ulang dengan nominal palsu agar lolos lapis pertama.
        $payload['signature'] = md5(
            self::MERCHANT.'1000'.$payment->order_id.self::KEY,
        );

        $this->postJson('/api/webhooks/duitku', $payload)->assertStatus(422);

        $this->assertSame('pending', $payment->refresh()->status);
    }

    public function test_status_gateway_menang_atas_result_code_callback(): void
    {
        [$payment, $vendor] = $this->pendingPayment();

        // Callback mengaku sukses, tetapi gateway bilang masih diproses.
        $this->fakeGatewayStatus('01');

        $this->postJson('/api/webhooks/duitku', $this->callbackPayload($payment, '00'))
            ->assertOk();

        $this->assertSame('pending', $payment->refresh()->status);
        $this->assertNull(Subscription::query()->where('vendor_id', $vendor->id)->first()?->ends_at);
    }

    /**
     * Reference yang ditulis ke database harus berasal dari gateway, bukan
     * dari payload callback. Tanpa ini, penyerang yang mengetahui apiKey bisa
     * mengirim signature sah dengan reference karangan dan merusak jejak audit.
     */
    public function test_reference_dari_gateway_bukan_dari_callback(): void
    {
        [$payment] = $this->pendingPayment();

        // Gateway mengembalikan REF-UJI (lihat fakeGatewayStatus).
        $this->fakeGatewayStatus('00');

        $payload = $this->callbackPayload($payment, '00');
        $payload['reference'] = 'REF-KARANGAN';

        $this->postJson('/api/webhooks/duitku', $payload)->assertOk();

        $payment->refresh();

        $this->assertSame('REF-UJI', $payment->gateway_reference);
        $this->assertNotSame('REF-KARANGAN', $payment->gateway_reference);
    }

    public function test_callback_ganda_tidak_menambah_masa_aktif_dua_kali(): void
    {
        [$payment, $vendor] = $this->pendingPayment();

        $this->fakeGatewayStatus('00');

        $this->postJson('/api/webhooks/duitku', $this->callbackPayload($payment, '00'))->assertOk();
        $endsAtPertama = Subscription::query()->where('vendor_id', $vendor->id)->first()->ends_at;

        $this->postJson('/api/webhooks/duitku', $this->callbackPayload($payment, '00'))->assertOk();
        $endsAtKedua = Subscription::query()->where('vendor_id', $vendor->id)->first()->ends_at;

        $this->assertEquals($endsAtPertama, $endsAtKedua);
    }

    public function test_order_tidak_dikenal_dibalas_200(): void
    {
        // Duitku akan mengulang terus bila tidak dibalas 2xx, padahal tidak ada
        // yang bisa diproses untuk order yang tidak kita catat.
        $this->postJson('/api/webhooks/duitku', [
            'merchantCode' => self::MERCHANT,
            'amount' => '50000',
            'merchantOrderId' => 'TIDAK-ADA',
            'signature' => md5(self::MERCHANT.'50000'.'TIDAK-ADA'.self::KEY),
        ])->assertOk();
    }

    public function test_aktivasi_memperpanjang_dari_ends_at_lama(): void
    {
        [$payment, $vendor] = $this->pendingPayment();

        // Vendor masih aktif 10 hari lagi.
        Subscription::query()->create([
            'vendor_id' => $vendor->id,
            'plan_id' => $payment->plan_id,
            'status' => 'active',
            'starts_at' => now()->subDays(20)->toDateString(),
            'ends_at' => now()->addDays(10)->toDateString(),
            'amount_paid' => 50000,
        ]);

        $payment->refresh();
        app(SubscriptionActivator::class)->activate($payment);

        $subscription = Subscription::query()->where('vendor_id', $vendor->id)->first();

        // 10 hari sisa + 1 bulan, bukan mulai hari ini.
        $this->assertTrue(
            $subscription->ends_at->greaterThan(now()->addDays(35)),
            'Masa aktif baru harus disambung dari ends_at lama.',
        );
    }

    // -----------------------------------------------------------------------
    // Bantuan
    // -----------------------------------------------------------------------

    /**
     * @return array{0: SubscriptionPayment, 1: Vendor}
     */
    private function pendingPayment(): array
    {
        $user = User::query()->create([
            'name' => 'Vendor Uji',
            'email' => 'vendor-uji@example.com',
            'role' => User::ROLE_VENDOR,
        ]);

        $vendor = Vendor::query()->create([
            'user_id' => $user->id,
            'name' => 'Vendor Uji',
            'slug' => 'vendor-uji',
        ]);

        $this->loginAs($user->fresh());

        $plan = Plan::query()->create([
            'code' => 'monthly',
            'name' => 'Bulanan',
            'duration_months' => 1,
            'price' => 50000,
            'is_active' => true,
        ]);

        $payment = SubscriptionPayment::query()->create([
            'vendor_id' => $vendor->id,
            'plan_id' => $plan->id,
            'order_id' => 'SUB-'.$vendor->id.'-UJI',
            'gateway' => 'duitku',
            'gateway_reference' => 'REF-UJI',
            'amount' => 50000,
            'status' => 'pending',
            'payment_method' => 'SP',
            'raw_payload' => ['qrString' => 'QR-PALSU'],
            'expires_at' => now()->addDay(),
        ]);

        return [$payment, $vendor];
    }

    /**
     * @return array<string, string>
     */
    private function callbackPayload(SubscriptionPayment $payment, string $resultCode): array
    {
        $amount = (string) (int) $payment->amount;

        return [
            'merchantCode' => self::MERCHANT,
            'amount' => $amount,
            'merchantOrderId' => $payment->order_id,
            'resultCode' => $resultCode,
            'reference' => 'REF-DARI-DUITKU',
            'paymentCode' => 'SP',
            // Urutan callback: merchantCode + amount + orderId + apiKey.
            'signature' => md5(self::MERCHANT.$amount.$payment->order_id.self::KEY),
        ];
    }

    private function fakeGatewayStatus(string $statusCode): void
    {
        Http::fake([
            '*/transactionStatus' => Http::response([
                'statusCode' => $statusCode,
                'statusMessage' => $statusCode === '00' ? 'SUCCESS' : 'PROCESS',
                'reference' => 'REF-UJI',
                'amount' => '50000',
            ], 200),
        ]);
    }

    /**
     * Polling status (`GET /api/payments/{id}/status`) harus bisa mengaktifkan
     * langganan tanpa menunggu webhook. Ini penting kalau webhook Duitku tertunda
     * atau tidak sampai — vendor yang sudah membayar tidak boleh terjebak
     * di "menunggu pembayaran" selamanya.
     */
    public function test_polling_status_mengaktifkan_langganan_tanpa_webhook(): void
    {
        [$payment, $vendor] = $this->pendingPayment();

        // Gateway bilang lunas, tapi tidak ada callback yang masuk.
        $this->fakeGatewayStatus('00');

        $this->getJson("/api/payments/{$payment->id}/status")
            ->assertOk()
            ->assertJsonPath('status', 'confirmed');

        $this->assertSame('paid', $payment->refresh()->status);
        $this->assertNotNull(
            Subscription::query()->where('vendor_id', $vendor->id)->first()?->ends_at,
        );
    }

    /**
     * Polling saat gateway masih `01` tidak boleh mengubah apa pun.
     */
    public function test_polling_status_saat_masih_proses_tidak_mengaktifkan(): void
    {
        [$payment] = $this->pendingPayment();

        $this->fakeGatewayStatus('01');

        $this->getJson("/api/payments/{$payment->id}/status")
            ->assertOk()
            ->assertJsonPath('status', 'pending');

        $this->assertSame('pending', $payment->refresh()->status);
    }

    /**
     * Kalau gateway tidak bisa dihubungi saat polling, tidak boleh ada error
     * 500 — transaksi dibiarkan pending dan dicoba lagi nanti.
     */
    public function test_polling_status_gagal_gateway_tidak_melempar_error(): void
    {
        [$payment] = $this->pendingPayment();

        Http::fake([
            '*/transactionStatus' => Http::response(null, 500),
        ]);

        $this->getJson("/api/payments/{$payment->id}/status")
            ->assertOk()
            ->assertJsonPath('status', 'pending');

        $this->assertSame('pending', $payment->refresh()->status);
    }
}
