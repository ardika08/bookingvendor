<?php

namespace Tests\Feature;

use App\Mail\Transport\MailketingTransport;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

/**
 * Transport email lewat REST API Mailketing.
 *
 * Transport ini dipakai karena SMTP Mailketing gagal di hosting produksi:
 * sertifikat TLS-nya hanya berlaku untuk `smtp.mailketing.id`, sementara
 * koneksi keluar port 587/465 juga bisa dibatasi. API memakai HTTPS 443.
 */
class MailketingTransportTest extends TestCase
{
    private function transport(string $token = 'token-uji'): MailketingTransport
    {
        return new MailketingTransport(
            token: $token,
            endpoint: 'https://api.mailketing.test/api/v2/send',
            fromEmail: 'info@vendorkit.my.id',
            fromName: 'VendorKit',
        );
    }

    private function email(): Email
    {
        return (new Email())
            ->from(new Address('info@vendorkit.my.id', 'VendorKit'))
            ->to('vendor@test.com')
            ->subject('Selamat datang')
            ->html('<html><body><h1>Halo</h1></body></html>');
    }

    public function test_mengirim_lewat_api_dengan_payload_benar(): void
    {
        Http::fake([
            'api.mailketing.test/*' => Http::response([
                'success' => true,
                'data' => ['message_id' => '<api.abc@vendorkit.my.id>'],
                'message' => 'Email queued successfully',
            ], 200),
        ]);

        $this->transport()->send($this->email());

        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.mailketing.test/api/v2/send'
                && $request->hasHeader('X-Api-Token', 'token-uji')
                && $request['from_email'] === 'info@vendorkit.my.id'
                && $request['from_name'] === 'VendorKit'
                && $request['recipient'] === 'vendor@test.com'
                && $request['subject'] === 'Selamat datang'
                && str_contains((string) $request['content'], 'Halo');
        });
    }

    /** Isi HTML harus diteruskan, bukan MIME mentah dengan header. */
    public function test_konten_berisi_html_bukan_mime_mentah(): void
    {
        Http::fake(['*' => Http::response(['success' => true, 'data' => ['message_id' => '<x@y>']], 200)]);

        $this->transport()->send($this->email());

        Http::assertSent(function ($request) {
            $content = (string) $request['content'];

            return str_contains($content, '<h1>Halo</h1>')
                && ! str_contains($content, 'Content-Type:')
                && ! str_contains($content, 'MIME-Version:');
        });
    }

    /** Satu request per penerima — API hanya menerima satu `recipient`. */
    public function test_mengirim_terpisah_untuk_setiap_penerima(): void
    {
        Http::fake(['*' => Http::response(['success' => true, 'data' => ['message_id' => '<x@y>']], 200)]);

        $email = $this->email()->to('a@test.com', 'b@test.com');
        $this->transport()->send($email);

        Http::assertSentCount(2);

        $recipients = [];
        Http::assertSent(function ($request) use (&$recipients) {
            $recipients[] = $request['recipient'];

            return true;
        });

        sort($recipients);
        $this->assertSame(['a@test.com', 'b@test.com'], $recipients);
    }

    public function test_token_kosong_ditolak_sebelum_request(): void
    {
        Http::fake();

        $this->expectException(TransportException::class);
        $this->expectExceptionMessage('MAILKETING_API_TOKEN belum diisi');

        $this->transport('')->send($this->email());
    }

    /**
     * Setiap kode error API harus jadi pesan yang menyebutkan tindakannya —
     * pesan mentah "Unknown sender domain" tidak memberi tahu apa yang harus
     * diperbaiki.
     *
     * Tiap kasus memakai tes terpisah karena `Http::fake()` menumpuk stub:
     * memanggilnya berulang dalam satu tes membuat stub pertama yang menang
     * untuk semua status.
     */
    public function test_error_401_diterjemahkan(): void
    {
        $this->assertErrorMessage(401, 'Token API Mailketing salah');
    }

    public function test_error_402_diterjemahkan(): void
    {
        $this->assertErrorMessage(402, 'Kredit Mailketing habis');
    }

    public function test_error_403_diterjemahkan(): void
    {
        $this->assertErrorMessage(403, 'Domain pengirim belum terverifikasi');
    }

    public function test_error_429_diterjemahkan(): void
    {
        $this->assertErrorMessage(429, 'Terlalu banyak percobaan gagal');
    }

    private function assertErrorMessage(int $status, string $expected): void
    {
        Http::fake(['*' => Http::response(['success' => false, 'message' => 'nope'], $status)]);

        try {
            $this->transport()->send($this->email());
            $this->fail("Status {$status} seharusnya melempar TransportException");
        } catch (TransportException $exception) {
            $this->assertStringContainsString($expected, $exception->getMessage());
        }
    }

    /** Respons 200 tanpa `success: true` tetap dianggap gagal. */
    public function test_sukses_palsu_ditolak(): void
    {
        Http::fake(['*' => Http::response(['success' => false, 'message' => 'queued?'], 200)]);

        $this->expectException(TransportException::class);

        $this->transport()->send($this->email());
    }

    public function test_kegagalan_jaringan_jadi_transport_exception(): void
    {
        Http::fake(function () {
            throw new \Illuminate\Http\Client\ConnectionException('timeout');
        });

        $this->expectException(TransportException::class);
        $this->expectExceptionMessage('Tidak dapat menghubungi API Mailketing');

        $this->transport()->send($this->email());
    }

    /** Pesan tanpa HTML (teks saja) tetap terkirim sebagai HTML aman. */
    public function test_email_teks_saja_dibungkus_html_aman(): void
    {
        Http::fake(['*' => Http::response(['success' => true, 'data' => ['message_id' => '<x@y>']], 200)]);

        $email = (new Email())
            ->from(new Address('info@vendorkit.my.id', 'VendorKit'))
            ->to('vendor@test.com')
            ->subject('Tes')
            ->text("Baris satu\nBaris dua <script>");

        $this->transport()->send($email);

        Http::assertSent(function ($request) {
            $content = (string) $request['content'];

            // Karakter berbahaya harus di-escape, bukan dikirim mentah.
            return str_contains($content, '&lt;script&gt;')
                && ! str_contains($content, '<script>');
        });
    }

    public function test_string_representation_menyebut_host(): void
    {
        $this->assertStringContainsString('api.mailketing.test', (string) $this->transport());
    }

    /** Envelope eksplisit dipakai bila diberikan. */
    public function test_envelope_eksplisit_dihormati(): void
    {
        Http::fake(['*' => Http::response(['success' => true, 'data' => ['message_id' => '<x@y>']], 200)]);

        $email = $this->email();
        $envelope = new Envelope(
            new Address('info@vendorkit.my.id'),
            [new Address('lain@test.com')],
        );

        $this->transport()->send($email, $envelope);

        Http::assertSent(fn ($request) => $request['recipient'] === 'lain@test.com');
    }
}
