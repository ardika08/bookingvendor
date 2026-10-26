<?php

namespace App\Http\Requests;

use App\Models\Invoice;
use App\Services\InvoiceCalculator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Validasi pencatatan pembayaran invoice.
 *
 * Aturan sama dengan form frontend: nominal > 0 dan tidak melebihi sisa
 * tagihan, tanggal bayar wajib dan tidak di masa depan, metode wajib.
 * Invoice yang dibatalkan atau sudah lunas tidak bisa menerima pembayaran.
 */
class StorePaymentRequest extends FormRequest
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
            'amount' => ['required', 'numeric', 'min:0.01'],
            'paid_at' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'method' => ['required', 'string', 'in:transfer,qris,cash,other'],
            'reference_number' => ['nullable', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'amount.required' => 'Nominal pembayaran wajib diisi.',
            'amount.min' => 'Nominal harus lebih besar dari nol.',
            'paid_at.required' => 'Tanggal bayar wajib diisi.',
            'paid_at.date_format' => 'Format tanggal tidak valid.',
            'paid_at.before_or_equal' => 'Tanggal bayar tidak boleh di masa depan.',
            'method.required' => 'Pilih metode pembayaran.',
            'method.in' => 'Metode pembayaran tidak dikenal.',
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
                    $validator->errors()->add('amount', 'Invoice dibatalkan — pembayaran tidak bisa dicatat.');

                    return;
                }

                $calculator = app(InvoiceCalculator::class);
                $remaining = $calculator->remainingOf($invoice);

                if ($remaining <= 0) {
                    $validator->errors()->add('amount', 'Invoice sudah lunas.');

                    return;
                }

                $amount = (float) $this->input('amount', 0);
                if ($amount > $remaining) {
                    $validator->errors()->add(
                        'amount',
                        'Nominal melebihi sisa tagihan (Rp' . number_format($remaining, 0, ',', '.') . ').',
                    );
                }
            },
        ];
    }
}
