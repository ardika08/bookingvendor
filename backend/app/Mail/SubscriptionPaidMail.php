<?php

namespace App\Mail;

use App\Models\SubscriptionPayment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email tanda terima saat langganan aktif.
 *
 * Berfungsi sebagai invoice sederhana: vendor menerima bukti paket yang dibeli,
 * nominal, nomor referensi, dan sampai kapan masa aktifnya. Tanpa ini vendor
 * hanya melihat perubahan status di aplikasi tanpa bukti tertulis — padahal
 * pembayaran langganan sering perlu dilaporkan ke bagian keuangan mereka.
 *
 * Dikirim lewat queue agar aktivasi langganan (dipicu webhook Duitku) tidak
 * bergantung pada kecepatan SMTP.
 */
class SubscriptionPaidMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly SubscriptionPayment $payment,
        public readonly string $vendorName,
        public readonly ?string $activeUntil,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Pembayaran langganan diterima — '.($this->payment->plan?->name ?? 'Paket'),
        );
    }

    public function content(): Content
    {
        $plan = $this->payment->plan;

        return new Content(
            view: 'emails.subscription-paid',
            with: [
                'vendorName' => $this->vendorName,
                'planName' => $plan?->name ?? 'Paket',
                'durationMonths' => $plan?->duration_months,
                'amount' => (int) round((float) $this->payment->amount),
                'reference' => $this->payment->order_id,
                'paidAt' => optional($this->payment->paid_at)->translatedFormat('j F Y'),
                'activeUntil' => $this->activeUntil !== null
                    ? \Illuminate\Support\Carbon::parse($this->activeUntil)->translatedFormat('j F Y')
                    : null,
                'dashboardUrl' => rtrim((string) config('app.frontend_url', config('app.url')), '/').'/dashboard',
            ],
        );
    }
}
