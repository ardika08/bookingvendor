<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\SubscriptionPayment;
use App\Models\Vendor;
use App\Services\RevenueSeries;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Dashboard admin: ringkasan angka platform + grafik pendapatan agregat.
 *
 * Berbeda dari `RevenueController` vendor yang hanya melihat datanya sendiri,
 * controller ini menggabungkan seluruh vendor. Dipakai di halaman utama panel
 * admin untuk memberi gambaran kesehatan platform secara cepat.
 */
class AdminDashboardController extends Controller
{
    public function __construct(private readonly RevenueSeries $series)
    {
    }

    /**
     * GET /api/admin/dashboard/summary
     *
     * Angka ringkas: total vendor, vendor aktif, total booking, total
     * pembayaran tercatat, total uang masuk, dan total pendapatan langganan.
     */
    public function summary(): JsonResponse
    {
        $totalVendors = Vendor::count();
        $activeVendors = Vendor::where('is_active', true)->count();
        $totalBookings = Booking::count();
        $totalPayments = Payment::count();
        $totalPaidIn = (float) Payment::sum('amount');
        $totalSubscriptionRevenue = (float) SubscriptionPayment::where('status', 'paid')->sum('amount');

        // Vendor baru bulan ini.
        $monthStart = now()->startOfMonth()->toDateString();
        $newVendorsThisMonth = Vendor::whereDate('created_at', '>=', $monthStart)->count();

        // Booking baru bulan ini.
        $newBookingsThisMonth = Booking::whereDate('created_at', '>=', $monthStart)->count();

        return response()->json([
            'vendors' => [
                'total' => $totalVendors,
                'active' => $activeVendors,
                'newThisMonth' => $newVendorsThisMonth,
            ],
            'bookings' => [
                'total' => $totalBookings,
                'newThisMonth' => $newBookingsThisMonth,
            ],
            'payments' => [
                'total' => $totalPayments,
                'paidIn' => $totalPaidIn,
            ],
            'subscription' => [
                'revenue' => $totalSubscriptionRevenue,
            ],
        ]);
    }

    /**
     * GET /api/admin/dashboard/revenue-series?months=6
     *
     * Grafik pendapatan platform agregat — gabungan semua vendor.
     * Memakai `RevenueSeries` yang sama dengan dashboard vendor, tetapi
     * data booking & payment diambil tanpa filter `vendor_id`.
     */
    public function revenueSeries(Request $request): JsonResponse
    {
        $request->validate([
            'months' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);

        $months = (int) $request->query('months', 6);
        $endMonthKey = now()->format('Y-m');
        $fromMonth = $this->firstMonthOf($endMonthKey, $months);
        $since = $fromMonth.'-01';

        $bookings = Booking::query()
            ->whereDate('event_date', '>=', $since)
            ->get(['event_date', 'total_price', 'status']);

        $paidRows = Payment::query()
            ->join('invoices', 'invoices.id', '=', 'payments.invoice_id')
            ->join('bookings', 'bookings.id', '=', 'invoices.booking_id')
            ->whereDate('payments.paid_at', '>=', $since)
            ->get(['payments.amount', 'payments.paid_at']);

        $paidByMonth = [];
        foreach ($paidRows as $row) {
            $month = $row->paid_at?->format('Y-m');
            if ($month === null) {
                continue;
            }
            $paidByMonth[$month] = ($paidByMonth[$month] ?? 0.0) + (float) $row->amount;
        }

        $payments = collect($paidByMonth)
            ->map(fn (float $total, string $month): Payment => new Payment([
                'amount' => $total,
                'paid_at' => $month.'-01',
            ]))
            ->values()
            ->all();

        $series = $this->series->build(
            $bookings,
            $payments,
            $endMonthKey,
            $months,
        );

        return response()->json([
            'series' => $series,
            'totals' => [
                'contractValue' => $this->series->totalContractValue($series),
                'paid' => $this->series->totalPaid($series),
            ],
            'months' => $months,
        ]);
    }

    /** Bulan pertama dari jendela `months` mundur dari `endMonthKey`. */
    private function firstMonthOf(string $endMonthKey, int $months): string
    {
        [$year, $month] = array_map('intval', explode('-', $endMonthKey));
        $totalMonths = $year * 12 + $month - 1;
        $startTotal = $totalMonths - ($months - 1);
        $startYear = intdiv($startTotal, 12);
        $startMonth = ($startTotal % 12) + 1;

        return sprintf('%04d-%02d', $startYear, $startMonth);
    }
}
