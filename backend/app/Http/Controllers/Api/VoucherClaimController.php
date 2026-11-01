<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Models\VoucherRedemption;
use App\Services\VoucherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Klaim voucher oleh vendor (`/api/subscription/voucher`).
 *
 * Hanya voucher tipe `free_months` yang bisa diklaim di sini, karena klaim
 * langsung mengubah masa aktif. Voucher `discount` dipakai saat checkout —
 * potongannya harus menempel pada transaksi tertentu, bukan diberikan diam-diam.
 */
class VoucherClaimController extends Controller
{
    use ResolvesVendor;

    public function __construct(private readonly VoucherService $vouchers) {}

    /**
     * POST /api/subscription/voucher
     *
     * Body: { code: string }
     */
    public function claim(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:40'],
        ], [
            'code.required' => 'Masukkan kode voucher dulu.',
        ]);

        $vendor = $this->resolveVendor();

        try {
            $redemption = $this->vouchers->redeemFreeMonths($vendor, $validated['code']);
        } catch (ValidationException $e) {
            // Kode salah / kedaluwarsa / sudah dipakai bukan kegagalan server.
            // 422 membuat frontend menampilkan pesan di kolom input, bukan
            // halaman error.
            return response()->json([
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        }

        $redemption->load('voucher');

        return response()->json([
            'code' => $redemption->voucher->code,
            'granted_months' => $redemption->granted_months,
            'redeemed_at' => $redemption->redeemed_at?->toIso8601String(),
        ]);
    }

    /**
     * GET /api/subscription/voucher
     *
     * Riwayat klaim vendor yang sedang login, untuk ditampilkan di halaman
     * Langganan supaya vendor tahu kode apa saja yang sudah pernah dipakai.
     */
    public function history(): JsonResponse
    {
        $vendor = $this->resolveVendor();

        $items = VoucherRedemption::query()
            ->with('voucher')
            ->where('vendor_id', $vendor->id)
            ->orderByDesc('redeemed_at')
            ->get()
            ->map(fn (VoucherRedemption $r) => [
                'code' => $r->voucher?->code,
                'description' => $r->voucher?->description,
                'granted_months' => $r->granted_months,
                'discount_applied' => $r->discount_applied,
                'redeemed_at' => $r->redeemed_at?->toIso8601String(),
            ]);

        return response()->json($items);
    }
}
