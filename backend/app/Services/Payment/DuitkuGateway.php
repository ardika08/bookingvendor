<?php

namespace App\Services\Payment;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Klien Duitku (mode Direct API).
 *
 * Alur yang dipakai:
 *   1. `paymentMethods()` — daftar metode aktif untuk nominal tertentu.
 *   2. `inquiry()`         — buat transaksi, dapat `reference` + `qrString`.
 *   3. `checkStatus()`     — verifikasi status saat callback masuk.
 *
 * Signature BERBEDA per endpoint. Ini bukan pilihan gaya, melainkan hasil
 * pengujian langsung ke sandbox:
 *
 *   inquiry           → MD5(mc + orderId + amount + key)
 *   paymentMethods    → SHA256(mc + amount + datetime + key)
 *   checkStatus       → MD5(mc + orderId + key)
 *
 * Memakai algoritma yang salah menghasilkan 401 "Wrong signature".
 */
class DuitkuGateway
{
    public function __construct(
        private readonly string $merchantCode,
        private readonly string $apiKey,
        private readonly string $baseUrl,
        private readonly string $callbackUrl,
        private readonly string $returnUrl,
        private readonly int $timeout = 30,
    ) {
    }

    public static function fromConfig(): self
    {
        $config = config('duitku');

        if (blank($config['merchant_code'] ?? null) || blank($config['api_key'] ?? null)) {
            throw new RuntimeException(
                'Kredensial Duitku belum diisi. Set DUITKU_MERCHANT_CODE dan DUITKU_API_KEY di .env.',
            );
        }

        return new self(
            merchantCode: (string) $config['merchant_code'],
            apiKey: (string) $config['api_key'],
            baseUrl: rtrim((string) $config['base_url'], '/'),
            callbackUrl: (string) ($config['callback_url'] ?? ''),
            returnUrl: (string) ($config['return_url'] ?? ''),
            timeout: (int) ($config['timeout'] ?? 30),
        );
    }

    /**
     * Daftar metode pembayaran yang tersedia untuk nominal tertentu.
     *
     * @return list<array{code: string, name: string, image: ?string, fee: int}>
     */
    public function paymentMethods(int $amount): array
    {
        $datetime = now()->format('Y-m-d H:i:s');

        $response = $this->post('paymentmethod/getpaymentmethod', [
            'merchantcode' => $this->merchantCode,
            'amount' => $amount,
            'datetime' => $datetime,
            'signature' => $this->hash(
                'sha256',
                $this->merchantCode.$amount.$datetime.$this->apiKey,
            ),
        ]);

        $items = $response['paymentFee'] ?? [];

        if (! is_array($items)) {
            return [];
        }

        return array_values(array_map(
            fn (array $item): array => [
                'code' => (string) ($item['paymentMethod'] ?? ''),
                'name' => (string) ($item['paymentName'] ?? ''),
                'image' => $item['paymentImage'] ?? null,
                'fee' => (int) ($item['totalFee'] ?? 0),
            ],
            array_filter($items, 'is_array'),
        ));
    }

    /**
     * Buat transaksi baru.
     *
     * @param  array{order_id: string, amount: int, method: string, product: string, customer_name: string, email: string, phone: string}  $order
     * @return array{reference: string, payment_url: ?string, qr_string: ?string, va_number: ?string, amount: int, raw: array}
     */
    public function inquiry(array $order): array
    {
        $amount = (int) $order['amount'];

        $payload = [
            'merchantCode' => $this->merchantCode,
            'paymentAmount' => $amount,
            'paymentMethod' => $order['method'],
            'merchantOrderId' => $order['order_id'],
            'productDetails' => $order['product'],
            'customerVaName' => $order['customer_name'],
            'email' => $order['email'],
            'phoneNumber' => $order['phone'],
            'callbackUrl' => $this->callbackUrl,
            'returnUrl' => $this->returnUrl,
            'expiryPeriod' => (int) config('duitku.expiry_minutes', 1440),
            'signature' => $this->hash(
                'md5',
                $this->merchantCode.$order['order_id'].$amount.$this->apiKey,
            ),
        ];

        // Alamat wajib diisi Duitku untuk sebagian metode; nilai netral dipakai
        // karena vendor tidak mengisi alamat penagihan pada alur langganan.
        $payload['customerDetail'] = [
            'firstName' => mb_substr($order['customer_name'], 0, 50) ?: 'Vendor',
            'email' => $order['email'],
            'phoneNumber' => $order['phone'],
            'billingAddress' => [
                'firstName' => mb_substr($order['customer_name'], 0, 50) ?: 'Vendor',
                'lastName' => '',
                'address' => 'Indonesia',
                'city' => 'Jakarta',
                'postalCode' => '10000',
                'phone' => $order['phone'],
                'countryCode' => 'ID',
            ],
        ];

        $response = $this->post('v2/inquiry', $payload);

        if (($response['statusCode'] ?? '') !== '00') {
            throw new DuitkuException(
                'Duitku menolak transaksi: '.($response['statusMessage'] ?? 'tidak diketahui'),
                $response,
            );
        }

        return [
            'reference' => (string) ($response['reference'] ?? ''),
            'payment_url' => $response['paymentUrl'] ?? null,
            'qr_string' => $response['qrString'] ?? null,
            'va_number' => $response['vaNumber'] ?? null,
            'amount' => (int) ($response['amount'] ?? $amount),
            'raw' => $response,
        ];
    }

    /**
     * Cek status transaksi langsung ke Duitku.
     *
     * Dipakai untuk memverifikasi callback: status yang dilaporkan webhook
     * tidak dipercaya begitu saja, melainkan dicek ulang ke gateway.
     *
     * @return array{status_code: string, status_message: string, reference: ?string, amount: ?int, raw: array}
     */
    public function checkStatus(string $merchantOrderId): array
    {
        $response = $this->post('transactionStatus', [
            'merchantCode' => $this->merchantCode,
            'merchantOrderId' => $merchantOrderId,
            'signature' => $this->hash(
                'md5',
                $this->merchantCode.$merchantOrderId.$this->apiKey,
            ),
        ]);

        return [
            'status_code' => (string) ($response['statusCode'] ?? ''),
            'status_message' => (string) ($response['statusMessage'] ?? ''),
            'reference' => $response['reference'] ?? null,
            'amount' => isset($response['amount']) ? (int) $response['amount'] : null,
            'raw' => $response,
        ];
    }

    /**
     * Verifikasi signature yang dikirim Duitku pada callback.
     *
     * Rumus callback: MD5(merchantCode + amount + merchantOrderId + apiKey).
     * Perhatikan urutannya berbeda dari `inquiry` — amount dan orderId
     * bertukar posisi.
     */
    public function verifyCallbackSignature(
        string $merchantCode,
        string $amount,
        string $merchantOrderId,
        string $signature,
    ): bool {
        if ($merchantCode !== $this->merchantCode) {
            return false;
        }

        $expected = $this->hash('md5', $merchantCode.$amount.$merchantOrderId.$this->apiKey);

        return hash_equals($expected, strtolower($signature));
    }

    private function hash(string $algorithm, string $payload): string
    {
        return hash($algorithm, $payload);
    }

    /**
     * @return array<string, mixed>
     */
    private function post(string $path, array $payload): array
    {
        $url = $this->baseUrl.'/'.ltrim($path, '/');

        $response = Http::timeout($this->timeout)
            ->acceptJson()
            ->asJson()
            ->post($url, $payload);

        $body = $response->json();

        if (! $response->successful()) {
            Log::warning('Duitku request gagal', [
                'url' => $url,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new DuitkuException(
                'Duitku membalas HTTP '.$response->status().': '.mb_substr($response->body(), 0, 200),
                is_array($body) ? $body : [],
                $response->status(),
            );
        }

        if (! is_array($body)) {
            throw new DuitkuException('Respons Duitku bukan JSON yang valid.', []);
        }

        return $body;
    }
}
