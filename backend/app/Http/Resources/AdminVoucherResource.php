<?php

namespace App\Http\Resources;

use App\Models\Voucher;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Bentuk voucher untuk panel admin.
 *
 * Menyertakan hasil turunan (`status`, `remaining_uses`, `discount_label`)
 * karena admin perlu melihat keadaan kode sekilas tanpa menghitung sendiri.
 *
 * @mixin Voucher
 */
class AdminVoucherResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'description' => $this->description,
            'type' => $this->type,
            'free_months' => $this->free_months,
            'plan_id' => $this->plan_id,
            'plan_name' => $this->relationLoaded('plan') ? $this->plan?->name : null,
            'discount_kind' => $this->discount_kind,
            'discount_amount' => $this->discount_amount,
            'discount_percent' => $this->discount_percent,
            'max_uses' => $this->max_uses,
            'used_count' => $this->used_count,
            'remaining_uses' => $this->max_uses === null ? null : max(0, $this->max_uses - $this->used_count),
            'starts_at' => $this->starts_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'is_active' => $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
            'discount_label' => $this->discountLabel(),
            'status' => $this->statusKey(),
        ];
    }
}
