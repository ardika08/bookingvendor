<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Ringkasan langganan satu vendor untuk panel admin.
 *
 * Status yang dikirim adalah status tersimpan (`trial/active/expired/
 * cancelled`); UI admin menampilkan `grace` dari perhitungan terpisah bila
 * perlu. Tanggal memakai `YYYY-MM-DD`.
 *
 * @mixin \App\Models\Subscription
 */
class SubscriptionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $plan = $this->whenLoaded('plan', fn () => $this->plan);

        return [
            'id' => (string) $this->id,
            'status' => $this->status,
            'planName' => $plan?->name,
            'startsAt' => optional($this->starts_at)->toDateString(),
            'endsAt' => optional($this->ends_at)->toDateString(),
            'amountPaid' => (float) $this->amount_paid,
            'trialBookingsUsed' => (int) $this->trial_bookings_used,
            'trialInvoicesUsed' => (int) $this->trial_invoices_used,
        ];
    }
}
