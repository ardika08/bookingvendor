<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Dashboard admin: jumlah vendor + pendapatan langganan aplikasi.
 *
 * CAKUPAN SENGAJA DIBATASI
 * Admin hanya perlu tahu berapa vendor yang aktif dan berapa uang yang masuk
 * dari langganan aplikasi. Data operasional vendor — booking, klien, invoice,
 * dan pembayaran klien — **tidak** dihitung di sini. Itu urusan masing-masing
 * vendor dan tidak diperlukan untuk mengelola platform.
 *
 * Karena itu endpoint ini tidak menyentuh tabel `bookings`, `invoices`, atau
 * `payments` sama sekali. Satu-satunya sumber uang adalah
 * `subscription_payments` (status `paid`), yaitu pembayaran paket langganan
 * vendor ke platform.
 */
class AdminDashboardController extends Controller
{
    /**
     * GET /api/admin/dashboard/summary
     *
     * Angka ringkas: jumlah vendor (total/aktif/nonaktif) dan pendapatan
     * langganan aplikasi (total, bulan ini, jumlah transaksi lunas).
     */
    public function summary(): JsonResponse
    {
        $totalVendors = Vendor::count();
        $activeVendors = Vendor::where('is_active', true)->count();

        $monthStart = now()->startOfMonth();

        // Hanya transaksi berstatus `paid` yang dihitung sebagai pendapatan.
        // `pending` belum tentu dibayar, `failed`/`expired` tidak pernah masuk.
        $paid = SubscriptionPayment::query()->where('status', 'paid');

        $revenueTotal = (float) (clone $paid)->sum('amount');
        $revenueThisMonth = (float) (clone $paid)
            ->where('paid_at', '>=', $monthStart)
            ->sum('amount');
        $paidCount = (clone $paid)->count();

        // Sebaran langganan dipakai sebagai konteks: berapa yang berbayar,
        // berapa yang masih trial. Angka ini soal status akun, bukan uang.
        $activeSubscriptions = Subscription::query()->where('status', 'active')->count();
        $trialSubscriptions = Subscription::query()->where('status', 'trial')->count();

        return response()->json([
            'vendors' => [
                'total' => $totalVendors,
                'active' => $activeVendors,
                'inactive' => $totalVendors - $activeVendors,
            ],
            'subscription' => [
                'revenueTotal' => $revenueTotal,
                'revenueThisMonth' => $revenueThisMonth,
                'paidCount' => $paidCount,
                'activeCount' => $activeSubscriptions,
                'trialCount' => $trialSubscriptions,
            ],
        ]);
    }

    /**
     * GET /api/admin/dashboard/revenue-series?months=6
     *
     * Pendapatan langganan aplikasi per bulan — hanya dari
     * `subscription_payments` berstatus `paid`.
     *
     * Pengelompokan bulan dilakukan di PHP, bukan SQL: `strftime()` hanya ada
     * di SQLite dan `DATE_FORMAT()` hanya di MySQL. Satu query + loop membuat
     * hasilnya sama di kedua driver tanpa cabang kode.
     */
    public function revenueSeries(Request $request): JsonResponse
    {
        $request->validate([
            'months' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);

        $months = (int) $request->query('months', 6);
        $endMonth = now()->copy()->startOfMonth();
        $startMonth = $endMonth->copy()->subMonths($months - 1);

        $rows = SubscriptionPayment::query()
            ->where('status', 'paid')
            ->where('paid_at', '>=', $startMonth)
            ->get(['amount', 'paid_at']);

        $byMonth = [];
        foreach ($rows as $row) {
            $key = $row->paid_at?->format('Y-m');
            if ($key === null) {
                continue;
            }
            $byMonth[$key] = ($byMonth[$key] ?? 0.0) + (float) $row->amount;
        }

        // Kerangka bulan dibuat lengkap agar grafik tidak bolong saat ada
        // bulan tanpa transaksi.
        $series = [];
        for ($i = 0; $i < $months; $i++) {
            $month = $startMonth->copy()->addMonths($i);
            $key = $month->format('Y-m');
            $series[] = [
                'month' => $key,
                'label' => $this->monthLabel($month),
                'revenue' => $byMonth[$key] ?? 0.0,
                'paymentCount' => 0,
            ];
        }

        // Hitung jumlah transaksi per bulan untuk tooltip.
        foreach ($rows as $row) {
            $key = $row->paid_at?->format('Y-m');
            if ($key === null) {
                continue;
            }
            foreach ($series as $index => $point) {
                if ($point['month'] === $key) {
                    $series[$index]['paymentCount'] += 1;
                    break;
                }
            }
        }

        $total = array_sum(array_column($series, 'revenue'));

        return response()->json([
            'series' => $series,
            'totals' => ['revenue' => (float) $total],
            'months' => $months,
        ]);
    }

    /** Label pendek bulan untuk sumbu X, mis. "Okt". */
    private function monthLabel(Carbon $month): string
    {
        $labels = [
            1 => 'Jan', 2 => 'Feb', 3 => 'Mar', 4 => 'Apr', 5 => 'Mei', 6 => 'Jun',
            7 => 'Jul', 8 => 'Agu', 9 => 'Sep', 10 => 'Okt', 11 => 'Nov', 12 => 'Des',
        ];

        return $labels[(int) $month->format('n')] ?? $month->format('M');
    }

    /**
     * GET /api/admin/dashboard/transactions?page=1
     *
     * Riwayat transaksi langganan, 10 per halaman.
     *
     * Semua status ikut ditampilkan — bukan hanya yang lunas — supaya admin
     * bisa melihat transaksi yang masih pending atau gagal. Tetapi angka
     * pendapatan di kartu dan grafik tetap hanya menghitung `paid`.
     *
     * Urutan: yang paling baru dibayar lebih dulu; transaksi yang belum lunas
     * (paid_at null) diurutkan menurut waktu dibuat agar tidak hilang di
     * bawah.
     */
    public function transactions(Request $request): JsonResponse
    {
        $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', 'in:pending,paid,failed,expired,refunded,all'],
        ]);

        $query = SubscriptionPayment::query()->with(['vendor:id,name', 'plan:id,name']);

        $status = $request->query('status', 'all');
        if ($status !== 'all' && $status !== null) {
            $query->where('status', $status);
        }

        $paginator = $query
            ->orderByRaw('COALESCE(paid_at, created_at) DESC')
            ->orderByDesc('id')
            ->paginate(10);

        $items = collect($paginator->items())->map(fn (SubscriptionPayment $payment) => [
            'id' => $payment->id,
            'orderId' => $payment->order_id,
            'vendorName' => $payment->vendor?->name ?? 'Vendor terhapus',
            'planName' => $payment->plan?->name ?? '—',
            'amount' => (float) $payment->amount,
            'status' => $payment->status,
            'method' => $payment->payment_method,
            'paidAt' => $payment->paid_at?->toIso8601String(),
            'createdAt' => $payment->created_at?->toIso8601String(),
        ])->all();

        return response()->json([
            'items' => $items,
            'total' => $paginator->total(),
            'page' => $paginator->currentPage(),
            'perPage' => $paginator->perPage(),
            'totalPages' => $paginator->lastPage(),
        ]);
    }
}
