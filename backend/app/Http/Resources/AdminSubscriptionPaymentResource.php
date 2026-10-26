<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Riwayat transaksi langganan untuk panel admin.
 *
 * Bentuk camelCase sesuai UI admin: `reference` = `order_id` gateway,
 * `method` = channel pembayaran (fallback ke nama gateway), tanggal dikirim
 * sebagai `YYYY-MM-DD` karena UI hanya menampilkan tanggal.
 *
 * @mixin \App\Models\SubscriptionPayment
 */
class AdminSubscriptionPaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $plan = $this->whenLoaded('plan', fn () => $this->plan);

        return [
            'id' => (string) $this->id,
            'reference' => $this->order_id,
            'vendorId' => (string) $this->vendor_id,
            'planName' => $plan?->name ?? '-',
            'amount' => (float) $this->amount,
            'status' => $this->status,
            'method' => $this->payment_method ?? $this->gateway,
            'createdAt' => optional($this->created_at)->toDateString(),
            'paidAt' => optional($this->paid_at)->toDateString(),
        ];
    }
}
