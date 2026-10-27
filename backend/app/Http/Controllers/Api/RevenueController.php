<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\RevenueSeries;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Seri pendapatan bulanan untuk grafik dashboard vendor.
 *
 * GET /api/revenue/series?months=6
 *
 * Rentang dibatasi maksimal 12 bulan supaya satu vendor tidak bisa meminta
 * seri sepanjang riwayat usahanya dan membebani database.
 *
 * Pembayaran diringkas per bulan lewat agregasi SQL, bukan dengan menarik
 * seluruh baris lalu menjumlahkannya di PHP: jumlah pembayaran bertambah
 * seiring waktu, sedangkan jumlah titik grafik tidak pernah lebih dari 12.
 */
class RevenueController extends Controller
{
    use ResolvesVendor;

    public function __construct(private readonly RevenueSeries $series)
    {
    }

    public function series(Request $request): JsonResponse
    {
        $vendor = $this->resolveVendor();

        $request->validate([
            'months' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);

        $months = (int) $request->query('months', 6);
        $endMonthKey = now()->format('Y-m');

        $fromMonth = $this->firstMonthOf($endMonthKey, $months);
        $since = $fromMonth.'-01';

        /*
         * Nilai kontrak dihitung dari booking. `status` ikut di-select karena
         * `RevenueSeries` memisahkan sendiri mana yang batal: booking batal
         * tetap dihitung sebagai acara tercatat, tapi tidak menambah nilai
         * kontrak. Kalau status tidak diambil di sini, `contractValue` akan
         * selalu nol tanpa error — persis bug yang sempat terjadi.
         */
        $bookings = $vendor->bookings()
            ->whereDate('event_date', '>=', $since)
            ->get(['event_date', 'total_price', 'status']);

        /*
         * Uang masuk dihitung dari tabel `payments`, bukan dari
         * `invoices.paid_amount`. Kolom itu hanya akumulasi terakhir; kalau
         * suatu invoice lunas lalu dikoreksi, riwayat pembayaran tetap
         * mencatat kapan uangnya benar-benar masuk.
         */
        $paidByMonth = Payment::query()
            ->join('invoices', 'invoices.id', '=', 'payments.invoice_id')
            ->join('bookings', 'bookings.id', '=', 'invoices.booking_id')
            ->where('bookings.vendor_id', $vendor->id)
            ->whereDate('payments.paid_at', '>=', $since)
            ->selectRaw("strftime('%Y-%m', payments.paid_at) as month, SUM(payments.amount) as total")
            ->groupBy('month')
            ->pluck('total', 'month');

        $payments = $paidByMonth
            ->map(fn ($total, string $month): Payment => new Payment([
                'amount' => (float) $total,
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

    /** Bulan pertama dari jendela `months` yang berakhir di `endMonthKey`. */
    private function firstMonthOf(string $endMonthKey, int $months): string
    {
        $cursor = \Illuminate\Support\Carbon::createFromFormat('Y-m', $endMonthKey)->startOfMonth();

        return $cursor->subMonthsNoOverflow($months - 1)->format('Y-m');
    }
}
