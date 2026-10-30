<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPayment;
use App\Services\Payment\DuitkuException;
use App\Services\Payment\DuitkuGateway;
use App\Services\SubscriptionActivator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Callback (webhook) Duitku.
 *
 * Endpoint ini publik — tidak memakai `auth:sanctum` karena dipanggil server
 * Duitku, bukan browser vendor. Karena itu keamanannya bergantung pada dua
 * lapis verifikasi:
 *
 *   1. Signature `MD5(merchantCode + amount + merchantOrderId + apiKey)`
 *      dicocokkan; permintaan dengan signature salah ditolak 401.
 *   2. Status hasil callback **dicek ulang** ke gateway lewat
 *      `transactionStatus`, sehingga penyerang tidak bisa memalsukan
 *      "sudah dibayar" hanya dengan menebak payload.
 *
 * Lapis kedua penting: tanpa itu, siapa pun yang tahu URL callback bisa
 * mengaktifkan langganan gratis dengan signature yang dihitung dari data
 * publik — kecuali apiKey juga diketahui. Verifikasi ulang membuat apiKey
 * tidak lagi menjadi satu-satunya garis pertahanan.
 */
class DuitkuCallbackController extends Controller
{
    public function __construct(
        private readonly SubscriptionActivator $activator,
    ) {
    }

    /**
     * POST /api/webhooks/duitku
     */
    public function __invoke(Request $request): JsonResponse
    {
        $merchantCode = (string) $request->input('merchantCode', '');
        $amount = (string) $request->input('amount', '');
        $orderId = (string) $request->input('merchantOrderId', '');
        $signature = (string) $request->input('signature', '');

        if ($orderId === '' || $signature === '') {
            return response()->json(['message' => 'Payload tidak lengkap.'], 400);
        }

        $payment = SubscriptionPayment::query()->where('order_id', $orderId)->first();

        if ($payment === null) {
            Log::warning('Callback Duitku untuk order tidak dikenal', ['order_id' => $orderId]);

            // Tetap 200 agar Duitku berhenti mengulang; tidak ada yang bisa
            // diproses untuk order yang tidak kita kenal.
            return response()->json(['message' => 'Order tidak dikenal.']);
        }

        try {
            $gateway = DuitkuGateway::fromConfig();
        } catch (\RuntimeException $exception) {
            Log::error('Callback Duitku tidak dapat diproses: kredensial kosong');

            return response()->json(['message' => 'Gateway belum dikonfigurasi.'], 500);
        }

        if (! $gateway->verifyCallbackSignature($merchantCode, $amount, $orderId, $signature)) {
            Log::warning('Callback Duitku signature tidak valid', [
                'order_id' => $orderId,
                'merchant_code' => $merchantCode,
            ]);

            return response()->json(['message' => 'Signature tidak valid.'], 401);
        }

        // Nominal harus sama dengan yang tercatat; kalau berbeda, jangan aktifkan.
        if ((int) round((float) $amount) !== (int) round((float) $payment->amount)) {
            Log::error('Callback Duitku nominal tidak cocok', [
                'order_id' => $orderId,
                'callback_amount' => $amount,
                'expected' => $payment->amount,
            ]);

            return response()->json(['message' => 'Nominal tidak cocok.'], 422);
        }

        $status = $this->gatewayStatus($gateway, $orderId);

        if ($status === null) {
            Log::warning('Callback Duitku gagal verifikasi ulang ke gateway', ['order_id' => $orderId]);

            return response()->json(['message' => 'Status tidak terverifikasi.'], 502);
        }

        $statusCode = $status['code'];
        $gatewayReference = $status['reference'];

        /*
         * Metadata ditulis dari hasil verifikasi gateway, bukan dari payload
         * callback. `reference` pada callback bisa dikarang: penyerang yang
         * mengetahui apiKey bisa mengirim signature sah dengan reference palsu
         * dan menimpa jejak audit transaksi asli. Nilai dari `checkStatus()`
         * sudah terbukti milik transaksi ini.
         */
        $payment->forceFill([
            'gateway_reference' => $gatewayReference ?? $payment->gateway_reference,
            'payment_method' => $request->input('paymentCode', $payment->payment_method),
            'raw_payload' => array_merge(
                is_array($payment->raw_payload) ? $payment->raw_payload : [],
                ['callback' => $request->all()],
            ),
        ])->save();

        /*
         * Keputusan akhir memakai status dari GATEWAY, bukan `resultCode` pada
         * callback. Callback hanyalah pemicu; kalau keduanya berbeda, gateway
         * yang benar. Dengan begitu payload yang dimodifikasi — meski
         * signature-nya dihitung ulang oleh pihak yang mengetahui apiKey —
         * tetap tidak bisa mengaktifkan langganan tanpa pembayaran nyata.
         */
        match ($statusCode) {
            '00' => $this->activator->activate($payment),
            '02' => $this->activator->markFailed($payment),
            // '01' = masih diproses; biarkan pending dan tunggu callback berikutnya.
            default => null,
        };

        return response()->json(['message' => 'OK']);
    }

    /**
     * Ambil status transaksi dari gateway, atau null bila tidak dapat dipastikan.
     *
     * Mengembalikan status code **dan** reference milik gateway. Reference
     * dipakai untuk menulis jejak audit, jadi harus berasal dari sini — bukan
     * dari payload callback yang bisa dikarang.
     *
     * Bila gateway tidak dapat dihubungi, callback ditolak (502) supaya Duitku
     * mengirim ulang — lebih baik terlambat aktif daripada aktif karena
     * payload palsu.
     *
     * @return array{code: string, reference: ?string}|null
     */
    private function gatewayStatus(DuitkuGateway $gateway, string $orderId): ?array
    {
        try {
            $status = $gateway->checkStatus($orderId);
        } catch (DuitkuException $exception) {
            Log::warning('Cek status Duitku gagal', [
                'order_id' => $orderId,
                'message' => $exception->getMessage(),
            ]);

            return null;
        }

        // `00` sukses, `01` proses, `02` dibatalkan/kedaluwarsa.
        $code = $status['status_code'];

        if (! in_array($code, ['00', '01', '02'], true)) {
            return null;
        }

        return [
            'code' => $code,
            'reference' => $status['reference'],
        ];
    }
}
