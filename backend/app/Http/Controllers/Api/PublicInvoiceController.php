<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicInvoiceResource;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;

/**
 * Halaman invoice publik untuk klien (tanpa akun).
 *
 * Klien membuka link yang dibagikan vendor; token pada URL adalah satu-satunya
 * kunci akses. Token yang dinonaktifkan (`link_active = false`) atau tidak
 * dikenal dijawab 404 — sengaja tidak membedakan "tidak ada" dan "dimatikan"
 * agar tidak membocorkan keberadaan invoice.
 */
class PublicInvoiceController extends Controller
{
    /**
     * GET /api/public/invoices/{token}
     */
    public function show(string $token): JsonResponse
    {
        $invoice = Invoice::query()
            ->where('public_token', $token)
            ->where('link_active', true)
            ->with(['booking.vendor', 'booking.client', 'booking.package'])
            ->first();

        if ($invoice === null) {
            return response()->json([
                'message' => 'Invoice tidak ditemukan atau tautannya sudah tidak aktif.',
            ], 404);
        }

        return (new PublicInvoiceResource($invoice))->response();
    }
}
