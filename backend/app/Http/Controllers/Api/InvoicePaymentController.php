<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePaymentRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Models\Payment;
use App\Services\InvoiceStatusResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Pencatatan pembayaran invoice.
 *
 * Vendor mencatat dana yang benar-benar masuk (transfer/QRIS/tunai). Satu
 * invoice bisa menerima banyak pembayaran; `invoices.paid_amount` dan status
 * invoice diperbarui dalam transaksi yang sama agar tidak pernah ada selisih
 * antara riwayat pembayaran dan akumulasi tagihan.
 */
class InvoicePaymentController extends Controller
{
    use ResolvesVendor;
    public function __construct(private readonly InvoiceStatusResolver $statuses)
    {
    }

    /**
     * Riwayat pembayaran satu invoice.
     *
     * GET /api/invoices/{invoice}/payments
     *
     * Dipakai halaman detail invoice untuk menampilkan pembayaran yang sudah
     * dicatat. Tanpa endpoint ini halaman gagal memuat (405) meski invoice-nya
     * sendiri berhasil diambil.
     */
    public function index(Invoice $invoice): JsonResponse
    {
        $invoice->loadMissing('booking');

        $vendorId = $invoice->booking?->vendor_id;

        if ($vendorId === null || $vendorId !== $this->resolveVendor()->id) {
            abort(404);
        }

        $payments = Payment::query()
            ->where('invoice_id', $invoice->id)
            ->orderByDesc('paid_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Payment $payment): array => [
                'id' => (string) $payment->id,
                'invoiceId' => (string) $payment->invoice_id,
                'amount' => (float) $payment->amount,
                'paidAt' => optional($payment->paid_at)->toDateString(),
                'method' => $payment->method,
                'note' => $payment->note,
            ])
            ->values()
            ->all();

        return response()->json($payments);
    }

    /**
     * Catat pembayaran untuk satu invoice.
     *
     * POST /api/invoices/{invoice}/payments
     */
    public function store(StorePaymentRequest $request, Invoice $invoice): JsonResponse
    {
        $validated = $request->validated();

        $invoice = DB::transaction(function () use ($invoice, $validated) {
            // Kunci baris agar dua request bersamaan tidak melewati sisa tagihan.
            /** @var Invoice $locked */
            $locked = Invoice::query()->whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            $payment = Payment::create([
                'invoice_id' => $locked->id,
                'amount' => $validated['amount'],
                'method' => $validated['method'],
                'reference_number' => $validated['reference_number'] ?? null,
                'note' => $validated['note'] ?? null,
                'paid_at' => $validated['paid_at'],
                'created_by' => $this->recorderId($locked),
            ]);

            $locked->paid_amount = (float) $locked->paid_amount + (float) $payment->amount;
            $locked->save();

            // Status selalu diturunkan ulang dari riwayat pembayaran.
            $this->statuses->recalculate($locked);

            return $locked;
        });

        $invoice->load('booking.client', 'booking.package');

        return (new InvoiceResource($invoice))->response()->setStatusCode(201);
    }

    /**
     * Vendor yang mencatat. Tanpa sesi login (fitur auth belum ada), dipakai
     * pemilik booking agar foreign key `created_by` tetap terisi.
     */
    private function recorderId(Invoice $invoice): int
    {
        $userId = auth()->id();

        if ($userId !== null) {
            return (int) $userId;
        }

        return (int) $invoice->booking->vendor->user_id;
    }
}
