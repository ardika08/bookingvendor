<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use App\Models\Plan;

/**
 * Validasi aktivasi/perpanjangan langganan manual oleh admin.
 *
 * Hanya paket aktif yang bisa dipakai. Harga boleh `null` — aktivasi manual
 * sering dipakai justru untuk paket yang belum dipasang harganya (mis. vendor
 * membayar di luar gateway).
 */
class RenewSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'plan_id.required' => 'Pilih paket langganan.',
            'plan_id.exists' => 'Paket langganan tidak ditemukan.',
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $plan = Plan::query()->find($this->input('plan_id'));

                if ($plan !== null && ! $plan->is_active) {
                    $validator->errors()->add('plan_id', 'Paket ini sedang tidak aktif.');
                }
            },
        ];
    }
}
