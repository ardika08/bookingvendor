<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInvoiceRequest;
use App\Http\Requests\UpdateInvoiceRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\Booking;
use App\Models\Invoice;
use App\Services\InvoiceCalculator;
use App\Services\InvoiceNumberGenerator;
use App\Services\TrialQuota;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Endpoint invoice.
 *
 * `store` menerbitkan invoice dari sebuah booking: semua data klien & acara
 * diambil dari booking (bukan dikirim ulang oleh klien) sehingga tidak ada
 * risiko data tagihan berbeda dari data acara. Nomor invoice dibuat berurutan
 * per tahun dan link publik mendapat token acak.
 *
 * `index` mengembalikan daftar invoice beserta agregat nominal dihitung dari
 * seluruh hasil filter (bukan hanya halaman aktif), agar kartu ringkasan di UI
 * menunjukkan total piutang yang sebenarnya.
 */
class InvoiceController extends Controller
{
    public function __construct(
        private readonly InvoiceNumberGenerator $numbers,
        private readonly TrialQuota $quota,
    ) {
    }

    /**
     * Daftar invoice dengan filter & paginasi.
     *
     * GET /api/invoices?status=&type=&q=&page=&per_page=
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->query('per_page', 10), 1), 100);

        $query = Invoice::query()->with('booking.client', 'booking.package');

        if (($status = $request->query('status')) && $status !== 'all') {
            // Frontend memakai `void`; database menyimpan `cancelled`.
            $query->where('status', $status === 'void' ? Invoice::STATUS_CANCELLED : $status);
        }

        if (($type = $request->query('type')) && $type !== 'all') {
            $query->where('type', $type);
        }

        if (($keyword = trim((string) $request->query('q', ''))) !== '') {
            $query->where(function ($builder) use ($keyword) {
                $builder->where('invoice_number', 'like', "%{$keyword}%")
                    ->orWhereHas('booking.client', function ($client) use ($keyword) {
                        $client->where('name', 'like', "%{$keyword}%")
                            ->orWhere('phone', 'like', "%{$keyword}%");
                    });
            });
        }

        // Agregat dihitung dari hasil filter sebelum paginasi.
        $summary = $this->summarize((clone $query)->get());

        $paginator = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'items' => InvoiceResource::collection($paginator->getCollection())->resolve(),
            'total' => $paginator->total(),
            'page' => $paginator->currentPage(),
            'perPage' => $paginator->perPage(),
            'summary' => $summary,
        ]);
    }

    /**
     * Seluruh invoice milik satu booking (urut terbit naik).
     *
     * GET /api/bookings/{booking}/invoices
     */
    public function byBooking(Booking $booking): JsonResponse
    {
        $invoices = $booking->invoices()
            ->with('booking.client', 'booking.package')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        return response()->json(InvoiceResource::collection($invoices)->resolve());
    }

    /**
     * Rincian satu invoice.
     *
     * GET /api/invoices/{invoice}
     */
    public function show(Invoice $invoice): JsonResponse
    {
        $invoice->load('booking.client', 'booking.package');

        return (new InvoiceResource($invoice))->response();
    }

    /**
     * Terbitkan invoice untuk satu booking.
     *
     * POST /api/bookings/{booking}/invoices
     */
    public function store(StoreInvoiceRequest $request, Booking $booking): JsonResponse
    {
        // Kuota trial sudah diperiksa middleware `invoice.trial`.
        $vendor = $booking->vendor;

        $validated = $request->validated();
        $issuedAt = Carbon::createFromFormat('Y-m-d', $validated['issued_at'])->startOfDay();

        $invoice = $this->numbers->withNumber(
            $validated['issued_at'],
            function (string $number) use ($booking, $validated, $issuedAt): Invoice {
                $invoice = new Invoice([
                    'booking_id' => $booking->id,
                    'invoice_number' => $number,
                    'public_token' => Str::random(48),
                    'type' => $validated['type'],
                    'amount' => $validated['amount'],
                    'paid_amount' => 0,
                    'status' => Invoice::STATUS_UNPAID,
                    'due_date' => $validated['due_at'],
                    'note' => $validated['note'] ?? null,
                    'link_active' => true,
                ]);

                // Tanggal terbit mengikuti input vendor, bukan waktu insert.
                $invoice->created_at = $issuedAt;
                $invoice->updated_at = $issuedAt;
                $invoice->save();

                return $invoice;
            },
        );

        $this->quota->recordInvoiceUsage($vendor);

        $invoice->load('booking.client', 'booking.package');

        return (new InvoiceResource($invoice))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Ubah invoice (nominal, jenis, jatuh tempo, catatan, status link).
     *
     * PUT/PATCH /api/invoices/{invoice}
     */
    public function update(UpdateInvoiceRequest $request, Invoice $invoice): JsonResponse
    {
        $validated = $request->validated();

        if (array_key_exists('amount', $validated)) {
            $invoice->amount = $validated['amount'];

            // Status mengikuti nominal vs pembayaran yang sudah tercatat.
            $invoice->status = app(InvoiceCalculator::class)->statusAfterPayment(
                (float) $invoice->amount,
                (float) $invoice->paid_amount,
                0,
                $invoice->status,
            );
        }

        if (array_key_exists('type', $validated)) {
            $invoice->type = $validated['type'];
        }

        if (array_key_exists('due_at', $validated)) {
            $invoice->due_date = $validated['due_at'];
        }

        if (array_key_exists('note', $validated)) {
            $invoice->note = $validated['note'];
        }

        if (array_key_exists('link_active', $validated)) {
            $invoice->link_active = (bool) $validated['link_active'];
        }

        $invoice->save();
        $invoice->load('booking.client', 'booking.package');

        return (new InvoiceResource($invoice))->response();
    }

    /**
     * Batalkan invoice.
     *
     * DELETE /api/invoices/{invoice}
     *
     * Baris tidak dihapus permanen: nomor invoice tidak boleh dipakai ulang dan
     * pembayaran yang sudah tercatat harus tetap terlacak. Invoice yang punya
     * pembayaran tidak bisa dibatalkan (uang sudah masuk).
     */
    public function destroy(Invoice $invoice): JsonResponse
    {
        if ((float) $invoice->paid_amount > 0) {
            return response()->json([
                'message' => 'Invoice yang sudah menerima pembayaran tidak bisa dibatalkan.',
            ], 422);
        }

        if ($invoice->status === Invoice::STATUS_CANCELLED) {
            return response()->json([
                'message' => 'Invoice ini sudah dibatalkan.',
            ], 422);
        }

        $invoice->status = Invoice::STATUS_CANCELLED;
        $invoice->link_active = false;
        $invoice->save();
        $invoice->load('booking.client', 'booking.package');

        return (new InvoiceResource($invoice))->response();
    }

    /** Ringkasan nominal dari kumpulan invoice (mengabaikan yang dibatalkan). */
    private function summarize($invoices): array
    {
        $billed = 0.0;
        $paid = 0.0;
        $overdue = 0;
        $today = now()->startOfDay();

        foreach ($invoices as $invoice) {
            if ($invoice->status === Invoice::STATUS_CANCELLED) {
                continue;
            }

            $billed += (float) $invoice->amount;
            $paid += (float) $invoice->paid_amount;

            if ($invoice->isCollectible()
                && $invoice->due_date !== null
                && $invoice->due_date->lt($today)
                && $invoice->remainingAmount() > 0) {
                $overdue++;
            }
        }

        return [
            'billed' => round($billed, 2),
            'paid' => round($paid, 2),
            'outstanding' => round(max($billed - $paid, 0), 2),
            'overdueCount' => $overdue,
        ];
    }

}
