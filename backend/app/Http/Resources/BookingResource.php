<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Booking untuk daftar dashboard vendor (bentuk camelCase).
 *
 * `client` bersarang sesuai tipe `Booking` di frontend; paket dikirim sebagai
 * `packageId`/`packageName` agar tabel tidak perlu join manual. `notes`
 * dipetakan dari kolom `event_details`.
 *
 * @mixin \App\Models\Booking
 */
class BookingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $client = $this->whenLoaded('client', fn () => $this->client);
        $package = $this->whenLoaded('package', fn () => $this->package);

        return [
            'id' => (string) $this->id,
            'client' => [
                'id' => $client ? (string) $client->id : null,
                'name' => $client?->name,
                'phone' => $client?->phone,
                'email' => $client?->email,
            ],
            'packageId' => $package ? (string) $package->id : null,
            'packageName' => $package?->name,
            'eventDate' => optional($this->event_date)->toDateString(),
            'eventTime' => optional($this->event_time)?->format('H:i'),
            'eventLocation' => $this->event_location,
            'status' => $this->status,
            'totalPrice' => (float) $this->total_price,
            'notes' => $this->event_details,
            'invoiceCount' => (int) ($this->invoices_count ?? 0),
            'createdAt' => optional($this->created_at)->toDateString(),
        ];
    }
}
