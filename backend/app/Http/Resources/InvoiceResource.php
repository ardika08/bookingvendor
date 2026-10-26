<?php

namespace App\Http\Resources;

use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Bentuk invoice untuk konsumen frontend (camelCase).
 *
 * Frontend memakai istilah `void` untuk invoice yang digugurkan, sedangkan
 * database mengikuti PRD (`cancelled`). Pemetaan dilakukan di sini supaya
 * skema database tetap sesuai PRD dan UI tidak perlu berubah.
 *
 * @mixin Invoice
 */
class InvoiceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $booking = $this->whenLoaded('booking', fn () => $this->booking);
        $client = $booking?->client;
        $package = $booking?->package;

        return [
            'id' => (string) $this->id,
            'number' => $this->invoice_number,
            'bookingId' => (string) $this->booking_id,
            'clientName' => $client?->name ?? '',
            'clientPhone' => $client?->phone ?? '',
            'packageName' => $package?->name,
            'type' => $this->type,
            'status' => $this->status === Invoice::STATUS_CANCELLED ? 'void' : $this->status,
            'issuedAt' => optional($this->created_at)->toDateString() ?? now()->toDateString(),
            'dueAt' => optional($this->due_date)->toDateString(),
            'bookingTotal' => (float) ($booking?->total_price ?? 0),
            'amount' => (float) $this->amount,
            'paidAmount' => (float) $this->paid_amount,
            'eventDate' => optional($booking?->event_date)->toDateString(),
        ];
    }
}
