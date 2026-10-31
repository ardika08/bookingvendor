<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Services\Payment\DuitkuException;
use App\Services\Payment\DuitkuGateway;
use App\Services\SubscriptionActivator;
use App\Services\SubscriptionStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Alur checkout langganan lewat Duitku (QRIS).
 *
 * Bentuk respons mengikuti kontrak `CheckoutSession` di frontend:
 *   { id, payment, plan, step, selectedMethod, methodInstructions }
 *
 * Alur:
 *   1. GET  /subscription/checkout?plan_id=…  → ringkasan, belum ada transaksi
 *   2. POST /subscription/checkout            → transaksi dibuat, dapat QR
 *   3. GET  /payments/{id}/status             → polling sampai lunas
 *
 * Pemetaan kode metode: frontend hanya mengenal `qris`, Duitku memakai `SP`
 * (ShopeePay QRIS) dan `NQ` (Nobu QRIS).
 */
class CheckoutController extends Controller
{
    use ResolvesVendor;

    /** Kode metode Duitku yang dianggap QRIS oleh frontend. */
    private const QRIS_CODES = ['SP', 'NQ'];

    public function __construct(
        private readonly SubscriptionStatus $statuses,
        private readonly SubscriptionActivator $activator,
    ) {
    }

    /**
     * GET /api/subscription/checkout?plan_id=…
     *
     * Ringkasan sebelum transaksi dibuat. Tidak memanggil gateway sehingga
     * aman dipanggil berulang saat halaman checkout dibuka.
     */
    public function show(Request $request): JsonResponse
    {
        $plan = $this->findPlan($request->query('plan_id'));

        if ($plan === null) {
            return $this->planNotFound();
        }

        $vendor = $this->resolveVendor();

        return response()->json([
            /*
             * `id` kosong menandakan transaksi belum dibuat. Frontend memakai
             * penanda ini untuk memutuskan kapan memanggil `POST /checkout`;
             * kalau diisi, UI akan mencoba memilih metode untuk transaksi yang
             * belum ada.
             */
            'id' => '',
            'payment' => $this->pendingPaymentPayload(null, $plan),
            'plan' => $this->planPayload($plan),
            'step' => 'summary',
            'selectedMethod' => null,
            'methodInstructions' => null,
        ]);
    }

    /**
     * POST /api/subscription/checkout
     *
     * Membuat transaksi Duitku. Bila vendor sudah punya transaksi pending
     * untuk paket yang sama, transaksi itu dipakai ulang agar tidak menumpuk
     * tagihan ganda di sisi gateway.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'plan_id' => ['required'],
            'method' => ['nullable', 'string', 'in:qris,SP,NQ'],
        ]);

        $plan = $this->findPlan($request->input('plan_id'));

        if ($plan === null) {
            return $this->planNotFound();
        }

        $vendor = $this->resolveVendor();
        $user = $request->user();

        $existing = SubscriptionPayment::query()
            ->where('vendor_id', $vendor->id)
            ->where('plan_id', $plan->id)
            ->where('status', 'pending')
            ->where(fn ($query) => $query
                ->whereNull('expires_at')
                ->orWhere('expires_at', '>', now()))
            ->latest('id')
            ->first();

        if ($existing !== null) {
            return response()->json($this->sessionPayload($existing, $plan, 'summary'));
        }

        try {
            $gateway = DuitkuGateway::fromConfig();

            $orderId = $this->orderId($vendor->id);
            $amount = (int) round((float) $plan->price);

            $result = $gateway->inquiry([
                'order_id' => $orderId,
                'amount' => $amount,
                'method' => $this->defaultMethod(),
                'product' => 'Langganan '.$plan->name.' — VendorKit',
                'customer_name' => $vendor->name ?: ($user?->name ?? 'Vendor'),
                'email' => $user?->email ?? 'vendor@example.com',
                'phone' => $this->normalizePhone($vendor->phone ?? null),
            ]);
        } catch (DuitkuException $exception) {
            Log::error('Checkout langganan gagal', [
                'vendor_id' => $vendor->id,
                'plan_id' => $plan->id,
                'message' => $exception->getMessage(),
                'payload' => $exception->payload,
            ]);

            return response()->json([
                'message' => 'Gagal membuat transaksi pembayaran. Coba lagi beberapa saat.',
                'code' => 'gateway_error',
            ], 502);
        }

        $payment = SubscriptionPayment::query()->create([
            'subscription_id' => $this->subscriptionId($vendor->id),
            'vendor_id' => $vendor->id,
            'plan_id' => $plan->id,
            'order_id' => $orderId,
            'gateway' => 'duitku',
            'gateway_reference' => $result['reference'],
            'amount' => $amount,
            'status' => 'pending',
            'payment_method' => $this->defaultMethod(),
            'raw_payload' => $result['raw'],
            'expires_at' => now()->addMinutes((int) config('duitku.expiry_minutes', 1440)),
        ]);

        return response()->json($this->sessionPayload($payment, $plan, 'summary'), 201);
    }

    /**
     * GET /api/subscription/checkout/methods
     *
     * Hanya QRIS yang ditawarkan. Daftar diambil dari gateway agar kode yang
     * ditampilkan benar-benar aktif untuk akun merchant ini.
     */
    public function methods(): JsonResponse
    {
        $plan = Plan::query()->where('is_active', true)->orderBy('duration_months')->first();
        $amount = (int) round((float) ($plan?->price ?? 50000));

        try {
            $available = DuitkuGateway::fromConfig()->paymentMethods($amount);
        } catch (DuitkuException $exception) {
            Log::warning('Gagal mengambil metode Duitku', ['message' => $exception->getMessage()]);

            return response()->json($this->fallbackMethods());
        }

        $qris = array_values(array_filter(
            $available,
            fn (array $method): bool => in_array($method['code'], self::QRIS_CODES, true),
        ));

        if ($qris === []) {
            return response()->json($this->fallbackMethods());
        }

        /*
         * Frontend hanya punya satu tipe metode `qris`. Duitku menyediakan dua
         * kanal QRIS (ShopeePay & Nobu); menampilkan keduanya akan menghasilkan
         * dua kartu identik di UI. Yang dipakai adalah yang pertama tersedia —
         * QRIS hasil pemindaian tetap bisa dibayar aplikasi apa pun.
         */
        return response()->json([[
            'code' => 'qris',
            'name' => 'QRIS',
            'description' => 'Scan dengan aplikasi bank atau e-wallet apa pun.',
            'provider' => $qris[0]['name'],
        ]]);
    }

    /**
     * POST /api/payments/{payment}/method
     *
     * Memilih metode pembayaran. Hanya QRIS yang tersedia, dan transaksi sudah
     * dibuat dengan QRIS saat `POST /checkout` (Duitku memerlukan kode metode
     * pada saat inquiry). Jadi endpoint ini tidak membuat transaksi baru — ia
     * mengembalikan sesi dengan langkah `instructions` beserta QR-nya.
     */
    public function selectMethod(Request $request, SubscriptionPayment $payment): JsonResponse
    {
        $this->authorizePayment($payment);

        $request->validate([
            'method' => ['required', 'string', 'in:qris,SP,NQ'],
        ]);

        $plan = $payment->plan;

        if ($plan === null) {
            return $this->planNotFound();
        }

        if ($payment->status !== 'pending') {
            return response()->json($this->sessionPayload(
                $payment,
                $plan,
                $payment->status === 'paid' ? 'success' : 'expired',
            ));
        }

        return response()->json($this->sessionPayload($payment, $plan, 'instructions'));
    }

    /**
     * GET /api/payments/{payment}/checkout
     *
     * Melanjutkan transaksi pending dari riwayat pembayaran.
     */
    public function resume(SubscriptionPayment $payment): JsonResponse
    {
        $this->authorizePayment($payment);

        $plan = $payment->plan;

        if ($plan === null) {
            return $this->planNotFound();
        }

        $step = $payment->status === 'paid'
            ? 'success'
            : ($this->isExpired($payment) ? 'expired' : 'instructions');

        return response()->json($this->sessionPayload($payment, $plan, $step));
    }

    /**
     * GET /api/payments/{payment}/status
     *
     * Dipanggil frontend berulang (polling) selama vendor menunggu pembayaran.
     *
     * Selama status masih `pending`, status dicek juga ke gateway. Tanpa ini
     * langganan hanya bisa aktif lewat webhook: kalau webhook Duitku tertunda
     * atau tidak sampai (firewall, URL callback salah), vendor yang sudah
     * membayar akan terjebak di "menunggu pembayaran" selamanya meski tombol
     * "Cek status" ditekan berkali-kali.
     *
     * Verifikasi ke gateway tetap aman: yang menentukan lunas adalah Duitku,
     * bukan klaim dari klien. Aktivasi memakai `SubscriptionActivator` yang
     * idempoten, jadi webhook dan polling yang tiba bersamaan tidak
     * memperpanjang langganan dua kali.
     */
    public function status(SubscriptionPayment $payment): JsonResponse
    {
        $this->authorizePayment($payment);

        if ($payment->status === 'pending') {
            $this->syncFromGateway($payment);
        }

        return response()->json([
            'status' => $this->mapPaymentStatus($payment->refresh()),
        ]);
    }

    /**
     * Sinkronkan status satu pembayaran pending dengan Duitku.
     *
     * Kegagalan gateway tidak pernah melempar ke pemanggil: polling status
     * tidak boleh berubah menjadi error 500 hanya karena Duitku sedang tidak
     * bisa dihubungi. Transaksi dibiarkan `pending` dan dicoba lagi pada
     * polling berikutnya atau lewat webhook.
     */
    private function syncFromGateway(SubscriptionPayment $payment): void
    {
        try {
            $gateway = DuitkuGateway::fromConfig();
            $status = $gateway->checkStatus($payment->order_id);
        } catch (\Throwable $exception) {
            Log::warning('Polling status Duitku gagal', [
                'order_id' => $payment->order_id,
                'message' => $exception->getMessage(),
            ]);

            return;
        }

        // Nominal dari gateway harus cocok; kalau tidak, jangan aktifkan.
        if ($status['amount'] !== null
            && (int) round((float) $status['amount']) !== (int) round((float) $payment->amount)) {
            Log::error('Polling Duitku nominal tidak cocok', [
                'order_id' => $payment->order_id,
                'gateway_amount' => $status['amount'],
                'expected' => $payment->amount,
            ]);

            return;
        }

        match ($status['status_code']) {
            '00' => $this->activator->activate($payment),
            '02' => $this->activator->markFailed($payment),
            // '01' = masih diproses; biarkan pending.
            default => null,
        };
    }

    /**
     * POST /api/payments/{payment}/expire
     *
     * Menandai transaksi kedaluwarsa saat countdown di UI habis. Tidak
     * menghubungi gateway: status sebenarnya tetap diverifikasi lewat webhook,
     * sehingga pembayaran yang telanjur masuk tidak hilang.
     */
    public function expire(SubscriptionPayment $payment): JsonResponse
    {
        $this->authorizePayment($payment);

        if ($payment->status === 'pending') {
            $payment->forceFill(['status' => 'expired'])->save();
        }

        $plan = $payment->plan;

        return response()->json(
            $plan === null
                ? ['status' => 'expired']
                : $this->sessionPayload($payment->refresh(), $plan, 'expired'),
        );
    }

    // -----------------------------------------------------------------------
    // Bantuan
    // -----------------------------------------------------------------------

    private function findPlan(mixed $planId): ?Plan
    {
        if (! is_scalar($planId) || (string) $planId === '') {
            return null;
        }

        $id = preg_replace('/^plan-/', '', (string) $planId);

        return Plan::query()
            ->whereKey($id)
            ->where('is_active', true)
            ->whereNotNull('price')
            ->first();
    }

    /**
     * Bentuk `CheckoutSession` yang dibaca frontend.
     */
    private function sessionPayload(SubscriptionPayment $payment, Plan $plan, string $step): array
    {
        $raw = is_array($payment->raw_payload) ? $payment->raw_payload : [];
        $qrString = $raw['qrString'] ?? null;

        return [
            'id' => (string) $payment->id,
            'payment' => $this->pendingPaymentPayload($payment, $plan),
            'plan' => $this->planPayload($plan),
            'step' => $step,
            'selectedMethod' => $qrString !== null || $payment->status === 'paid' ? 'qris' : null,
            'methodInstructions' => $qrString === null ? null : [
                'code' => 'qris',
                'name' => 'QRIS',
                'description' => 'Scan dengan aplikasi bank atau e-wallet apa pun.',
                'provider' => $this->methodLabel($payment->payment_method),
                // Payload QR mentah; frontend merendernya menjadi gambar QR.
                'qrString' => $qrString,
                // Halaman pembayaran Duitku sebagai cadangan bila QR gagal dipindai.
                'qrCodeUrl' => $raw['paymentUrl'] ?? null,
            ],
        ];
    }

    private function pendingPaymentPayload(?SubscriptionPayment $payment, Plan $plan): array
    {
        $status = $payment === null ? 'pending' : $this->mapPaymentStatus($payment);

        return [
            'id' => $payment === null ? '' : (string) $payment->id,
            'reference' => $payment?->order_id ?? '',
            'planId' => (string) $plan->id,
            'planName' => $plan->name,
            'amount' => (int) round((float) ($payment?->amount ?? $plan->price)),
            'status' => $status,
            // Transfer manual tidak dipakai lagi; field dipertahankan karena
            // tipe `Payment` di frontend mewajibkannya.
            'bank' => ['name' => '', 'accountNumber' => '', 'accountHolder' => ''],
            'createdAt' => ($payment?->created_at ?? now())->toIso8601String(),
            'expiresAt' => $payment?->expires_at?->toIso8601String(),
        ];
    }

    private function planPayload(Plan $plan): array
    {
        return [
            'id' => (string) $plan->id,
            'code' => $plan->code,
            'name' => $plan->name,
            'durationMonths' => $plan->duration_months,
            'price' => (int) round((float) $plan->price),
            'maxBookings' => null,
            'maxInvoices' => null,
            'benefits' => $this->benefits($plan),
        ];
    }

    /**
     * @return list<string>
     */
    private function benefits(Plan $plan): array
    {
        return [
            'Booking & invoice tanpa batas',
            'Link jadwal publik',
            'Aktif '.$plan->duration_months.' bulan',
        ];
    }

    /**
     * Status internal → status yang dikenal tipe `Payment` frontend.
     *
     * Frontend hanya punya `pending|confirmed|rejected|expired`, sedangkan
     * database memakai `pending|paid|failed|expired|refunded`.
     */
    private function mapPaymentStatus(SubscriptionPayment $payment): string
    {
        if ($payment->status === 'paid') {
            return 'confirmed';
        }

        if ($payment->status === 'pending' && $this->isExpired($payment)) {
            return 'expired';
        }

        return match ($payment->status) {
            'expired' => 'expired',
            'failed', 'refunded' => 'rejected',
            default => 'pending',
        };
    }

    private function isExpired(SubscriptionPayment $payment): bool
    {
        return $payment->expires_at !== null && $payment->expires_at->isPast();
    }

    private function methodLabel(?string $code): string
    {
        return match ($code) {
            'SP' => 'ShopeePay QRIS',
            'NQ' => 'Nobu QRIS',
            default => 'QRIS',
        };
    }

    private function defaultMethod(): string
    {
        $methods = (array) config('duitku.methods', ['SP']);

        return (string) ($methods[0] ?? 'SP');
    }

    /**
     * @return list<array{code: string, name: string, description: string, provider: string}>
     */
    private function fallbackMethods(): array
    {
        return [[
            'code' => 'qris',
            'name' => 'QRIS',
            'description' => 'Scan dengan aplikasi bank atau e-wallet apa pun.',
            'provider' => 'QRIS',
        ]];
    }

    /** Nomor pesanan internal yang dikirim ke Duitku. */
    private function orderId(int $vendorId): string
    {
        return 'SUB-'.$vendorId.'-'.now()->format('YmdHis').'-'.Str::upper(Str::random(4));
    }

    private function subscriptionId(int $vendorId): ?int
    {
        return Subscription::query()->where('vendor_id', $vendorId)->value('id');
    }

    /**
     * Duitku menolak nomor yang tidak valid, sedangkan kolom vendor boleh kosong.
     */
    private function normalizePhone(?string $phone): string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone);

        if ($digits === '' || $digits === null) {
            return '081234567890';
        }

        if (str_starts_with($digits, '62')) {
            return '0'.substr($digits, 2);
        }

        return $digits;
    }

    /** Transaksi milik vendor lain diperlakukan tidak ada (404, bukan 403). */
    private function authorizePayment(SubscriptionPayment $payment): void
    {
        $vendor = $this->resolveVendor();

        abort_if($payment->vendor_id !== $vendor->id, 404);
    }

    private function planNotFound(): JsonResponse
    {
        return response()->json([
            'message' => 'Paket tidak ditemukan atau belum dijual.',
            'code' => 'plan_not_found',
        ], 404);
    }
}
