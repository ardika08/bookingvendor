<?php

namespace App\Mail\Transport;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\RawMessage;

/**
 * Transport email lewat REST API Mailketing (`POST /api/v2/send`).
 *
 * KENAPA BUKAN SMTP
 * SMTP Mailketing memakai port 587/465 dan sertifikat TLS-nya hanya berlaku
 * untuk `smtp.mailketing.id`. Pada hosting yang membatasi koneksi keluar,
 * SMTP gagal dengan pesan yang membingungkan ("Peer certificate subjectAltName
 * did not match"). API memakai HTTPS 443 — port yang selalu terbuka — dan
 * mengembalikan kode error yang jelas (401 token salah, 402 kredit habis,
 * 403 domain belum terverifikasi).
 *
 * YANG DIKIRIM
 * API menerima HTML jadi, bukan MIME mentah. Karena itu body diambil dari
 * bagian `text/html` (fallback ke `text/plain`), dan lampiran diabaikan —
 * notifikasi aplikasi ini tidak memakai lampiran. Bila suatu saat perlu
 * lampiran, transport ini harus diperluas: API menerima lampiran sebagai URL,
 * bukan berkas yang diunggah.
 */
class MailketingTransport implements TransportInterface
{
    public function __construct(
        private readonly string $token,
        private readonly string $endpoint,
        private readonly string $fromEmail,
        private readonly string $fromName,
        private readonly int $timeout = 20,
    ) {
    }

    /**
     * Kirim satu pesan.
     *
     * @throws TransportException
     */
    public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
    {
        if ($this->token === '') {
            throw new TransportException('MAILKETING_API_TOKEN belum diisi.');
        }

        $envelope ??= Envelope::create($message);
        $recipients = $this->recipients($envelope);

        if ($recipients === []) {
            throw new TransportException('Email tidak punya penerima.');
        }

        $sent = new SentMessage($message, $envelope);
        $html = $this->htmlBody($message, $sent);

        /*
         * Satu request per penerima. API hanya menerima satu alamat di field
         * `recipient`, dan mengirim terpisah juga mencegah penerima saling
         * melihat alamat satu sama lain.
         */
        foreach ($recipients as $recipient) {
            $this->deliver($recipient, $this->subject($message, $sent), $html);
        }

        return $sent;
    }

    /**
     * @return array<int, string>
     */
    private function recipients(Envelope $envelope): array
    {
        $addresses = [];

        foreach ($envelope->getRecipients() as $address) {
            $addresses[] = $address->getAddress();
        }

        return array_values(array_unique($addresses));
    }

    private function subject(RawMessage $message, SentMessage $sent): string
    {
        $headers = $message instanceof \Symfony\Component\Mime\Message
            ? $message->getHeaders()
            : $sent->getOriginalMessage()->getHeaders();

        $subject = $headers->get('Subject')?->getBodyAsString();

        return $subject !== null && $subject !== '' ? $subject : '(tanpa subjek)';
    }

    /**
     * Ambil isi HTML dari pesan.
     *
     * `RawMessage` tidak menyediakan body terstruktur, jadi body MIME dipecah
     * per bagian. Bagian `text/html` dipakai bila ada; kalau tidak, `text/plain`
     * dibungkus `<pre>` supaya baris barunya tidak hilang saat dirender klien
     * email.
     */
    private function htmlBody(RawMessage $message, SentMessage $sent): string
    {
        $raw = $message instanceof \Symfony\Component\Mime\Message
            ? $message->toString()
            : $sent->toString();

        $html = $this->part($raw, 'text/html');
        if ($html !== null) {
            return $html;
        }

        $text = $this->part($raw, 'text/plain');

        if ($text !== null) {
            return '<pre style="font-family:inherit;white-space:pre-wrap;margin:0">'
                .htmlspecialchars($text, ENT_QUOTES, 'UTF-8')
                .'</pre>';
        }

        // Body tidak terbaca: kirim apa adanya daripada mengirim kosong.
        return '<pre>'.htmlspecialchars($raw, ENT_QUOTES, 'UTF-8').'</pre>';
    }

    /** Isi bagian MIME dengan Content-Type tertentu, sudah di-decode. */
    private function part(string $raw, string $contentType): ?string
    {
        $pattern = '/Content-Type:\s*'.preg_quote($contentType, '/').'[^\r\n]*\r?\n'
            .'(?:[^\r\n]+\r?\n)*?\r?\n(.*?)(?=\r?\n--|\z)/is';

        if (preg_match($pattern, $raw, $matches) !== 1) {
            return null;
        }

        $body = trim($matches[1]);
        if ($body === '') {
            return null;
        }

        $decoded = quoted_printable_decode($body);

        return $decoded !== '' ? $decoded : $body;
    }

    /**
     * Kirim ke API Mailketing untuk satu penerima.
     *
     * @throws TransportException
     */
    private function deliver(string $recipient, string $subject, string $html): void
    {
        try {
            $response = Http::withHeaders([
                'X-Api-Token' => $this->token,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ])
                ->timeout($this->timeout)
                ->post($this->endpoint, [
                    'from_name' => $this->fromName,
                    'from_email' => $this->fromEmail,
                    'subject' => $subject,
                    'recipient' => $recipient,
                    'content' => $html,
                ]);
        } catch (\Throwable $exception) {
            throw new TransportException(
                'Tidak dapat menghubungi API Mailketing: '.$exception->getMessage(),
                0,
                $exception,
            );
        }

        if ($response->successful() && $response->json('success') === true) {
            Log::info('Email terkirim lewat Mailketing', [
                'to' => $recipient,
                'message_id' => $response->json('data.message_id'),
            ]);

            return;
        }

        throw new TransportException($this->errorMessage($response->status(), $response->json()));
    }

    /**
     * Terjemahkan kode error API menjadi pesan yang bisa ditindaklanjuti.
     *
     * Pesan mentah Mailketing ("Unknown sender domain") tidak memberi tahu apa
     * yang harus diperbaiki; pesan di bawah menyebutkan tindakannya.
     *
     * @param  array<string, mixed>|null  $payload
     */
    private function errorMessage(int $status, ?array $payload): string
    {
        $detail = is_array($payload) ? (string) ($payload['message'] ?? '') : '';

        return match ($status) {
            401 => 'Token API Mailketing salah atau tidak ditemukan (401). Periksa MAILKETING_API_TOKEN.',
            402 => 'Kredit Mailketing habis (402). Top-up di dashboard Mailketing.',
            403 => 'Domain pengirim belum terverifikasi di Mailketing (403). '
                .'Pastikan MAIL_FROM_ADDRESS memakai domain yang sudah APPROVED.',
            422 => 'Data email ditolak Mailketing (422). '.$detail,
            429 => 'Terlalu banyak percobaan gagal ke Mailketing (429). Coba lagi beberapa saat.',
            default => 'Mailketing menolak pengiriman (HTTP '.$status.'). '.$detail,
        };
    }

    public function __toString(): string
    {
        return 'mailketing://'.parse_url($this->endpoint, PHP_URL_HOST);
    }

    /** Alamat pengirim yang dipakai transport ini (untuk diagnostik). */
    public function from(): Address
    {
        return new Address($this->fromEmail, $this->fromName);
    }
}
