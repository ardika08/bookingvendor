<?php

namespace App\Http\Requests;

use App\Models\Invoice;
use App\Services\InvoiceCalculator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Validasi perubahan invoice.
 *
 * Invoice yang sudah punya pembayaran tidak boleh diturunkan nominalnya di
 * bawah `paid_amount`, dan nominal baru tetap tidak boleh melebihi sisa kontrak
 * booking (dihitung tanpa invoice ini sendiri).
 */
class UpdateInvoiceRequest extends FormRequest
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
            'type' => ['sometimes', 'string', 'in:dp,pelunasan,full'],
            'amount' => ['sometimes', 'numeric', 'min:0.01'],
            'due_at' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'note' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'link_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.in' => 'Jenis tagihan tidak dikenal.',
            'amount.min' => 'Nominal harus lebih besar dari nol.',
            'due_at.date_format' => 'Format jatuh tempo tidak valid.',
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                /** @var Invoice|null $invoice */
                $invoice = $this->route('invoice');
                if (! $invoice instanceof Invoice) {
                    return;
                }

                if ($invoice->status === Invoice::STATUS_CANCELLED) {
                    $validator->errors()->add('status', 'Invoice yang dibatalkan tidak bisa diubah.');

                    return;
                }

                if (! $this->has('amount')) {
                    return;
                }

                $amount = (float) $this->input('amount');
                $paid = (float) $invoice->paid_amount;

                if ($amount < $paid) {
                    $validator->errors()->add(
                        'amount',
                        'Nominal tidak boleh lebih kecil dari yang sudah dibayar.',
                    );
                }

                // Batas dihitung tanpa invoice ini, karena nominalnya sedang diganti.
                $limit = app(InvoiceCalculator::class)
                    ->billableLimit($invoice->booking, $invoice->id);

                if ($amount > $limit) {
                    $validator->errors()->add(
                        'amount',
                        'Nominal melebihi sisa kontrak yang belum ditagihkan.',
                    );
                }
            },
        ];
    }
}
