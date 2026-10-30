<?php

namespace App\Mail;

use App\Models\Vendor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email selamat datang untuk vendor yang baru mendaftar.
 *
 * Dikirim lewat queue supaya pendaftaran tidak menunggu SMTP: kalau server
 * email lambat atau menolak koneksi, vendor tetap langsung bisa memakai
 * aplikasi. Kegagalan pengiriman tercatat di log queue, bukan di respons HTTP.
 *
 * Gaya HTML sengaja memakai tabel + inline style: klien email (Gmail, Outlook)
 * tidak mendukung stylesheet eksternal maupun Tailwind.
 */
class VendorWelcomeMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly Vendor $vendor,
        public readonly int $trialDays,
        public readonly ?string $trialEndsAt,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Selamat datang di Booking Vendor — masa uji '.$this->trialDays.' hari dimulai',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.vendor-welcome',
            with: [
                'vendorName' => $this->vendor->name,
                'ownerEmail' => $this->vendor->contact_email,
                'trialDays' => $this->trialDays,
                'trialEndsAt' => $this->trialEndsAt,
                'dashboardUrl' => rtrim((string) config('app.frontend_url', config('app.url')), '/').'/dashboard',
            ],
        );
    }
}
