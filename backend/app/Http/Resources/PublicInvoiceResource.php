<?php

namespace App\Http\Resources;

use App\Models\Invoice;
use App\Services\InvoiceStatusResolver;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Invoice untuk **halaman publik klien** (akses lewat token, tanpa login).
 *
 * Hanya memuat data yang memang boleh dilihat klien: identitas tagihan, acara,
 * nominal, status, dan instruksi transfer milik vendor pemilik invoice. Data
 * internal (id database, id booking, catatan internal, invoice lain) tidak
 * pernah ikut dikirim.
 *
 * @mixin Invoice
 */
class PublicInvoiceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var InvoiceStatusResolver $statuses */
        $statuses = app(InvoiceStatusResolver::class);

        /** @var Invoice $invoice */
        $invoice = $this->resource;

        $booking = $this->whenLoaded('booking', fn () => $this->booking);
        $vendor = $booking?->vendor;
        $client = $booking?->client;
        $package = $booking?->package;

        $status = $statuses->toFrontendStatus($invoice);
        $isVoid = $status === 'void';

        return [
            'number' => $this->invoice_number,
            'type' => $this->type,
            'status' => $status,
            'statusLabel' => $this->statusLabel($status),
            'isOverdue' => $statuses->isOverdue($invoice),

            'issuedAt' => optional($this->created_at)->toDateString(),
            'dueAt' => optional($this->due_date)->toDateString(),

            'amount' => (float) $this->amount,
            'paidAmount' => (float) $this->paid_amount,
            'remaining' => $isVoid ? 0.0 : $statuses->remaining($invoice),
            'paidPercent' => $isVoid ? 0 : $statuses->paidPercent($invoice),

            'note' => $this->note,

            'booking' => [
                'clientName' => $client?->name,
                'eventDate' => optional($booking?->event_date)->toDateString(),
                'eventTime' => $booking?->event_time,
                'eventLocation' => $booking?->event_location,
                'packageName' => $package?->name,
            ],

            'vendor' => [
                'name' => $vendor?->name,
                'contact' => $vendor?->contact,
                'location' => $vendor?->location,
                'bank' => [
                    'name' => $vendor?->bank_name,
                    'accountNumber' => $vendor?->bank_account_number,
                    'accountName' => $vendor?->bank_account_name,
                ],
            ],
        ];
    }

    /** Label status dalam bahasa Indonesia untuk ditampilkan di halaman klien. */
    private function statusLabel(string $status): string
    {
        return match ($status) {
            'paid' => 'Lunas',
            'partial' => 'Dibayar sebagian',
            'void' => 'Dibatalkan',
            default => 'Belum dibayar',
        };
    }
}
