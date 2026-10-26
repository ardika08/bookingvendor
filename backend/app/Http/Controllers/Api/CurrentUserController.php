<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\SubscriptionStatus;
use App\Services\TrialQuota;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Identitas pengguna yang sedang login.
 *
 * GET /api/me dipanggil SPA setelah login untuk memutuskan tampilan awal:
 * peran apa, profil vendor mana, dan sisa jatah langganan. Bentuk respons
 * mengikuti tipe `CurrentUser` di frontend (camelCase).
 *
 * Endpoint ini juga berfungsi sebagai pemeriksa sesi: 401 berarti cookie sesi
 * sudah tidak berlaku dan SPA harus mengarahkan pengguna ke halaman login.
 */
class CurrentUserController extends Controller
{
    public function __construct(
        private readonly SubscriptionStatus $statuses,
        private readonly TrialQuota $quota,
    ) {
    }

    /**
     * GET /api/me
     */
    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $vendor = $user->vendor;

        return response()->json([
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'avatarUrl' => $user->avatar_url,
            'role' => $user->role,
            'vendor' => $vendor === null ? null : [
                'id' => (string) $vendor->id,
                // Tabel `vendors` memakai kolom `name`; kontrak frontend
                // menamainya `businessName`.
                'businessName' => $vendor->name,
                'category' => $vendor->category?->name,
                'slug' => $vendor->slug,
                // Profil vendor tidak menyimpan foto; foto hanya ada di akun.
                'avatarUrl' => null,
            ],
            'subscription' => $this->subscriptionSummary($user),
        ]);
    }

    /**
     * Ringkasan langganan untuk kartu status di dashboard.
     *
     * Admin tidak punya langganan; bentuknya tetap dikirim (bukan null) supaya
     * tipe `CurrentUser` di frontend tidak perlu union — semua angka nol dan
     * status `active` tanpa batas.
     *
     * @return array<string, mixed>
     */
    private function subscriptionSummary(User $user): array
    {
        $vendor = $user->vendor;

        if ($vendor === null) {
            return [
                'status' => SubscriptionStatus::ACTIVE,
                'endsAt' => null,
                'graceEndsAt' => null,
                'trialBookingsUsed' => 0,
                'trialBookingsLimit' => 0,
                'trialInvoicesUsed' => 0,
                'trialInvoicesLimit' => 0,
                'remainingBookings' => null,
                'remainingInvoices' => null,
                'canCreateBooking' => false,
                'canCreateInvoice' => false,
            ];
        }

        $status = $this->statuses->resolve($vendor);
        $booking = $this->quota->bookingUsage($vendor);
        $invoice = $this->quota->invoiceUsage($vendor);
        $subscriptionValid = $status['canCreateInvoice'];

        return [
            'status' => $status['status'],
            'endsAt' => $status['endsAt'],
            'graceEndsAt' => $status['graceEndsAt'],

            'trialBookingsUsed' => $booking['used'],
            'trialBookingsLimit' => $booking['limit'],
            'trialInvoicesUsed' => $invoice['used'],
            'trialInvoicesLimit' => $invoice['limit'],

            'remainingBookings' => $booking['limited']
                ? max($booking['limit'] - $booking['used'], 0)
                : null,
            'remainingInvoices' => $invoice['limited']
                ? max($invoice['limit'] - $invoice['used'], 0)
                : null,

            'canCreateBooking' => $subscriptionValid && $this->quota->canCreateBooking($vendor),
            'canCreateInvoice' => $subscriptionValid && $this->quota->canCreateInvoice($vendor),
        ];
    }
}
