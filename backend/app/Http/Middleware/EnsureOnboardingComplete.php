<?php

namespace App\Http\Middleware;

use App\Models\Booking;
use App\Services\OnboardingStatus;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Menolak penerbitan invoice bila rekening vendor belum lengkap.
 *
 * Kenapa hanya invoice: invoice yang terbit tanpa rekening akan dikirim ke klien
 * sebagai halaman yang menyatakan "Informasi rekening belum tersedia", sehingga
 * klien tidak punya tujuan transfer. Kerusakan itu tidak terlihat oleh vendor,
 * jadi harus dicegah di sumbernya.
 *
 * Booking, profil, dan seluruh endpoint baca sengaja TIDAK dibatasi: vendor
 * harus tetap bisa mencatat pesanan dan melengkapi profilnya.
 *
 * Vendor diturunkan dari booking pada route (sama seperti
 * `EnsureInvoiceTrialQuota`), bukan dari sesi, supaya booking milik vendor lain
 * tidak bisa dipakai untuk melewati pemeriksaan.
 */
class EnsureOnboardingComplete
{
    public function __construct(private readonly OnboardingStatus $onboarding)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $booking = $request->route('booking');

        if (! $booking instanceof Booking) {
            return $next($request);
        }

        $vendor = $booking->vendor;

        /*
         * Kepemilikan diperiksa lebih dulu, sebelum kelengkapan rekening.
         *
         * Tanpa ini, booking milik vendor lain menjawab 422 `onboarding_incomplete`
         * sementara controller menjawab 404 — perbedaan itu membocorkan bahwa
         * booking tersebut ada, dan bahwa vendor pemiliknya belum melengkapi
         * rekening. 404 dipakai agar konsisten dengan `authorizeBooking()`.
         */
        if ($vendor === null || $vendor->id !== $request->user()?->vendor?->id) {
            abort(404);
        }

        if ($this->onboarding->canIssueInvoice($vendor)) {
            return $next($request);
        }

        return response()->json([
            'message' => 'Lengkapi rekening bank terlebih dahulu sebelum menerbitkan invoice.',
            'code' => 'onboarding_incomplete',
            'step' => 'bank',
        ], 422);
    }
}
