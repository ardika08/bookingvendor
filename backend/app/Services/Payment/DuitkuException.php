<?php

namespace App\Services\Payment;

use RuntimeException;

/**
 * Kegagalan saat berkomunikasi dengan payment gateway.
 *
 * Dipisahkan dari exception umum agar controller bisa membedakan gangguan
 * gateway (502 ke pengguna, dicatat ke log) dari kesalahan validasi (422).
 */
class DuitkuException extends RuntimeException
{
    /**
     * @param  array<string, mixed>  $payload  Respons mentah gateway, untuk log.
     */
    public function __construct(
        string $message,
        public readonly array $payload = [],
        int $code = 0,
    ) {
        parent::__construct($message, $code);
    }
}
