<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Link publik invoice (dibagikan vendor ke klien).
 *
 * Token adalah satu-satunya kunci akses halaman publik, jadi perlakuan
 * keamanannya:
 *
 *   - token dibuat acak 48 karakter, bukan berurutan atau berbasis ID;
 *   - `GET` tidak pernah membuat token (hanya melaporkan status), supaya
 *     membuka halaman detail tidak diam-diam mengaktifkan tautan;
 *   - `POST` bersifat idempoten: menekan tombol dua kali tidak mengganti token
 *     yang sudah dibagikan ke klien;
 *   - `reset` menghasilkan token baru dan MEMATIKAN yang lama — tautan yang
 *     sudah tersebar tidak boleh tetap hidup;
 *   - `DELETE` mematikan tautan tanpa menghapus invoice.
 *
 * Semua endpoint memakai `public_token` yang sudah ada di tabel `invoices`;
 * tidak ada tabel baru.
 */
class InvoiceShareLinkController extends Controller
{
    use ResolvesVendor;

    /** Panjang token; kolomnya 64 sehingga aman. */
    private const TOKEN_LENGTH = 48;

    /**
     * Panjang minimum token yang boleh dipakai ulang.
     *
     * Token dari data awal/seed lebih pendek dari ini dan harus diganti saat
     * tautan diaktifkan.
     */
    private const TOKEN_MIN_LENGTH = 32;

    /**
     * GET /api/invoices/{invoice}/share-link
     *
     * Status tautan saat ini, tanpa mengubah apa pun.
     */
    public function show(Invoice $invoice): JsonResponse
    {
        $this->authorizeInvoice($invoice);

        return response()->json([
            'token' => $invoice->link_active ? $invoice->public_token : null,
            'active' => (bool) $invoice->link_active,
        ]);
    }

    /**
     * POST /api/invoices/{invoice}/share-link
     *
     * Aktifkan tautan. Bila sudah aktif, token lama dikembalikan apa adanya
     * agar tautan yang sudah dikirim ke klien tidak mendadak mati.
     */
    public function store(Invoice $invoice): JsonResponse
    {
        $this->authorizeInvoice($invoice);

        if ($invoice->link_active && $this->hasUsableToken($invoice)) {
            return response()->json([
                'token' => $invoice->public_token,
                'active' => true,
            ]);
        }

        /*
         * Token lama yang terlalu pendek berasal dari data awal/seed dan mudah
         * ditebak, jadi tidak boleh dipakai ulang hanya karena kolomnya terisi.
         * Token yang sudah memenuhi panjang minimum dipertahankan supaya
         * tautan yang sudah beredar tetap hidup.
         */
        $token = $this->hasUsableToken($invoice)
            ? $invoice->public_token
            : $this->newToken();

        $invoice->forceFill([
            'public_token' => $token,
            'link_active' => true,
        ])->save();

        return response()->json(['token' => $token, 'active' => true]);
    }

    /**
     * POST /api/invoices/{invoice}/share-link/reset
     *
     * Terbitkan token baru dan matikan yang lama.
     */
    public function reset(Invoice $invoice): JsonResponse
    {
        $this->authorizeInvoice($invoice);

        // Tanpa tautan aktif, tidak ada yang perlu direset. Frontend
        // menampilkan pesan "buat link dulu" untuk kasus ini.
        if (! $this->hasToken($invoice)) {
            return response()->json([
                'message' => 'Buat link publik terlebih dahulu sebelum meresetnya.',
                'code' => 'share_link_missing',
            ], 404);
        }

        $token = $this->newToken();

        $invoice->forceFill([
            'public_token' => $token,
            'link_active' => true,
        ])->save();

        return response()->json(['token' => $token, 'active' => true]);
    }

    /**
     * DELETE /api/invoices/{invoice}/share-link
     *
     * Matikan tautan. Token dipertahankan di database agar riwayatnya jelas,
     * tetapi `link_active = false` membuat halaman publik menjawab 404.
     */
    public function destroy(Invoice $invoice): JsonResponse
    {
        $this->authorizeInvoice($invoice);

        $invoice->forceFill(['link_active' => false])->save();

        return response()->json(['token' => null, 'active' => false]);
    }

    // -----------------------------------------------------------------------

    private function hasToken(Invoice $invoice): bool
    {
        return is_string($invoice->public_token) && $invoice->public_token !== '';
    }

    /**
     * Token ada DAN cukup panjang untuk dianggap aman dipakai ulang.
     *
     * Data awal (seed) memakai token pendek yang mudah ditebak. Token seperti
     * itu harus diganti saat tautan diaktifkan, bukan dipertahankan.
     */
    private function hasUsableToken(Invoice $invoice): bool
    {
        return $this->hasToken($invoice)
            && strlen((string) $invoice->public_token) >= self::TOKEN_MIN_LENGTH;
    }

    /**
     * Token acak yang dijamin belum dipakai invoice lain.
     *
     * Kolomnya unik, jadi tabrakan akan memicu galat database. Peluangnya
     * sangat kecil, tetapi percobaan ulang jauh lebih murah daripada
     * menampilkan galat 500 kepada vendor.
     */
    private function newToken(): string
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $token = Str::random(self::TOKEN_LENGTH);

            $exists = Invoice::query()->where('public_token', $token)->exists();

            if (! $exists) {
                return $token;
            }
        }

        // Praktis tidak tercapai; tetap beri nilai unik berbasis waktu.
        return Str::random(self::TOKEN_LENGTH - 13).'-'.now()->format('YmdHis');
    }

    /** Invoice milik vendor lain diperlakukan tidak ada (404, bukan 403). */
    private function authorizeInvoice(Invoice $invoice): void
    {
        $invoice->loadMissing('booking');

        $vendorId = $invoice->booking?->vendor_id;

        if ($vendorId === null || $vendorId !== $this->resolveVendor()->id) {
            abort(404);
        }
    }
}
