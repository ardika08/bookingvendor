<?php

namespace App\Services;

use App\Models\Vendor;

/**
 * Kelengkapan data vendor untuk onboarding.
 *
 * Status **tidak disimpan** di kolom mana pun: selalu diturunkan dari isi tabel
 * `vendors`. Konsekuensinya menguntungkan — kalau vendor mengosongkan rekening
 * lewat halaman Pengaturan, status otomatis kembali "belum lengkap" tanpa perlu
 * ada kode yang memperbarui penanda.
 *
 * Hanya langkah **rekening** yang wajib. Alasannya bukan selera: halaman invoice
 * publik mencetak nomor rekening vendor, dan tanpa rekening klien tidak punya
 * tujuan transfer sama sekali (`PublicInvoicePage` menampilkan "Informasi
 * rekening belum tersedia"). Langkah lain hanya menambah kualitas data, jadi
 * tidak boleh menghalangi vendor yang sedang buru-buru.
 */
class OnboardingStatus
{
    /** Urutan langkah; `done` bukan langkah yang diperiksa. */
    public const STEPS = ['business', 'contact', 'bank'];

    /**
     * Kolom yang diperiksa per langkah.
     *
     * `business` sengaja tidak mewajibkan kategori: admin sudah mengisinya saat
     * membuat vendor, tetapi `UpdateVendorProfileRequest` mengizinkan vendor
     * mengosongkannya. Kalau kategori dijadikan wajib di sini tanpa mengubah
     * aturan itu, vendor bisa terjebak dalam langkah yang tidak bisa
     * diselesaikannya dari halaman Pengaturan.
     *
     * @var array<string, list<string>>
     */
    private const FIELDS = [
        'business' => ['name', 'location'],
        'contact' => ['contact'],
        'bank' => ['bank_name', 'bank_account_number', 'bank_account_name'],
    ];

    /** Label yang dipakai UI; dikirim server supaya frontend dan backend tidak berbeda. */
    private const LABELS = [
        'business' => 'Usaha',
        'contact' => 'Kontak',
        'bank' => 'Rekening',
    ];

    /** Langkah yang wajib diselesaikan sebelum boleh menerbitkan invoice. */
    private const REQUIRED = ['bank'];

    /**
     * Status lengkap untuk satu vendor.
     *
     * @return array{
     *     steps: list<array{key: string, label: string, complete: bool, required: bool, missing: list<string>}>,
     *     complete: bool,
     *     blockingStep: ?string,
     *     nextStep: ?string
     * }
     */
    public function resolve(Vendor $vendor): array
    {
        $steps = [];

        foreach (self::STEPS as $key) {
            $missing = array_values(array_filter(
                self::FIELDS[$key],
                fn (string $field): bool => blank($vendor->{$field}),
            ));

            $steps[] = [
                'key' => $key,
                'label' => self::LABELS[$key],
                'complete' => $missing === [],
                'required' => in_array($key, self::REQUIRED, true),
                'missing' => $missing,
            ];
        }

        $blocking = $this->firstIncomplete($steps, requiredOnly: true);
        $next = $this->firstIncomplete($steps, requiredOnly: false);

        return [
            'steps' => $steps,
            'complete' => $blocking === null,
            'blockingStep' => $blocking,
            'nextStep' => $next,
        ];
    }

    /**
     * Apakah vendor boleh menerbitkan invoice.
     *
     * Dipakai middleware; sengaja tidak memakai `complete` karena langkah
     * opsional yang kosong tidak boleh menghalangi.
     */
    public function canIssueInvoice(Vendor $vendor): bool
    {
        return $this->firstIncomplete(
            $this->resolve($vendor)['steps'],
            requiredOnly: true,
        ) === null;
    }

    /**
     * Langkah wajib pertama yang belum lengkap.
     *
     * @param  list<array{key: string, complete: bool, required: bool}>  $steps
     */
    private function firstIncomplete(array $steps, bool $requiredOnly): ?string
    {
        foreach ($steps as $step) {
            if ($requiredOnly && ! $step['required']) {
                continue;
            }

            if (! $step['complete']) {
                return $step['key'];
            }
        }

        return null;
    }
}
