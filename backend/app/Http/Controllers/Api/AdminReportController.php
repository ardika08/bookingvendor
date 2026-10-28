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
 * Laporan tahunan platform untuk panel admin.
 *
 * CAKUPAN SAMA DENGAN DASHBOARD
 * Hanya pendapatan langganan (uang masuk ke platform) dan pertumbuhan akun
 * vendor. Data operasional vendor — booking, klien, invoice, pembayaran klien —
 * tidak disentuh sama sekali: itu bukan urusan admin.
 *
 * SATU ENDPOINT UNTUK SEMUA TAB
 * Halaman laporan punya tiga tab (pendapatan, vendor, perlu ditindak). Ketiganya
 * memakai satu tahun yang sama, jadi dikirim sekaligus dalam satu respons.
 * Memecahnya jadi tiga endpoint berarti tiga kali loading dan tiga kali
 * kemungkinan tahun yang tampil tidak sinkron antar tab.
 *
 * PENGELOMPOKAN BULAN DI PHP, BUKAN SQL
 * `strftime()` hanya ada di SQLite, `DATE_FORMAT()` hanya di MySQL. Satu query
 * lalu loop di PHP memberi hasil identik di kedua driver tanpa cabang kode —
 * pola yang sama dipakai `AdminDashboardController::revenueSeries()`.
 */
class AdminReportController extends Controller
{
    /**
     * Ambang "langganan segera habis", dalam hari.
     *
     * 7 hari dipilih pemilik produk: cukup mendesak untuk ditindak, tanpa
     * membanjiri daftar dengan vendor yang baru saja memperpanjang.
     */
    private const EXPIRING_SOON_DAYS = 7;

    /**
     * GET /api/admin/reports?year=2026
     *
     * `year` kosong = tahun berjalan. Tahun yang tidak ada datanya tetap
     * mengembalikan 12 bulan kosong, bukan error — admin boleh melihat tahun
     * apa pun untuk memastikan memang belum ada transaksi.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
        ]);

        $year = (int) ($request->query('year') ?? now()->year);
        $start = Carbon::create($year, 1, 1)->startOfDay();
        $end = Carbon::create($year, 12, 31)->endOfDay();

        return response()->json([
            'year' => $year,
            'availableYears' => $this->availableYears(),
            'revenue' => $this->revenue($start, $end),
            'vendors' => $this->vendors($start, $end),
            'expiring' => $this->expiringSoon(),
        ]);
    }

    /**
     * Tahun yang punya data transaksi, selalu termasuk tahun berjalan.
     *
     * Dipakai untuk mengisi pilihan tahun di UI. Tanpa tahun berjalan, admin
     * yang belum punya transaksi sama sekali akan melihat dropdown kosong.
     *
     * @return list<int>
     */
    private function availableYears(): array
    {
        $years = SubscriptionPayment::query()
            ->whereNotNull('paid_at')
            ->pluck('paid_at')
            ->map(fn ($date) => (int) Carbon::parse($date)->format('Y'))
            ->unique()
            ->values()
            ->all();

        $current = (int) now()->format('Y');
        if (! in_array($current, $years, true)) {
            $years[] = $current;
        }

        rsort($years);

        return array_values($years);
    }

    /**
     * Tab pendapatan: total, sebaran bulanan, per paket, dan per status.
     *
     * Hanya transaksi `paid` yang dihitung sebagai pendapatan. `pending` belum
     * tentu dibayar; `failed`/`expired` tidak pernah masuk. Ketiganya tetap
     * dilaporkan di `byStatus` supaya admin bisa melihat berapa yang gagal.
     *
     * @return array<string, mixed>
     */
    private function revenue(Carbon $start, Carbon $end): array
    {
        /*
         * DUA CAKUPAN BERBEDA, dan ini penting:
         *
         * - Pendapatan disaring dari `paid_at`, bukan `created_at`. Transaksi
         *   yang dibuat 31 Desember lalu dibayar 2 Januari adalah uang tahun
         *   berikutnya. Menyaring dari `created_at` membuat transaksi semacam
         *   ini hilang dari laporan tahun pembayarannya.
         * - Transaksi yang BELUM lunas (`pending`/`failed`) tidak punya
         *   `paid_at`, jadi disaring dari `created_at` — kapan transaksi itu
         *   dibuat adalah satu-satunya waktu yang masuk akal untuk melaporkannya.
         */
        $paidPayments = SubscriptionPayment::query()
            ->with('plan:id,name')
            ->where('status', 'paid')
            ->whereNotNull('paid_at')
            ->whereBetween('paid_at', [$start, $end])
            ->get(['id', 'plan_id', 'amount', 'status', 'paid_at', 'created_at']);

        $unpaidPayments = SubscriptionPayment::query()
            ->with('plan:id,name')
            ->where('status', '!=', 'paid')
            ->whereBetween('created_at', [$start, $end])
            ->get(['id', 'plan_id', 'amount', 'status', 'paid_at', 'created_at']);

        $monthlyRevenue = array_fill(1, 12, 0.0);
        $monthlyCount = array_fill(1, 12, 0);
        $byPlan = [];
        $byStatus = [];

        foreach ($paidPayments as $payment) {
            $month = (int) $payment->paid_at->format('n');
            $monthlyRevenue[$month] += (float) $payment->amount;
            $monthlyCount[$month]++;

            $planName = $payment->plan?->name ?? 'Paket terhapus';
            if (! isset($byPlan[$planName])) {
                $byPlan[$planName] = ['planName' => $planName, 'revenue' => 0.0, 'count' => 0];
            }
            $byPlan[$planName]['revenue'] += (float) $payment->amount;
            $byPlan[$planName]['count']++;
        }

        foreach ($paidPayments->concat($unpaidPayments) as $payment) {
            $status = $payment->status;
            if (! isset($byStatus[$status])) {
                $byStatus[$status] = ['status' => $status, 'count' => 0, 'amount' => 0.0];
            }
            $byStatus[$status]['count']++;
            $byStatus[$status]['amount'] += (float) $payment->amount;
        }

        // Urut dari pendapatan terbesar: paket terlaris langsung terbaca.
        $byPlan = array_values($byPlan);
        usort($byPlan, fn ($a, $b) => $b['revenue'] <=> $a['revenue']);

        $total = array_sum($monthlyRevenue);
        $paidCount = $paidPayments->count();

        $monthly = [];
        for ($month = 1; $month <= 12; $month++) {
            $monthly[] = [
                'month' => $month,
                'label' => $this->monthLabel($month),
                'revenue' => (float) $monthlyRevenue[$month],
                'count' => $monthlyCount[$month],
            ];
        }

        return [
            'total' => (float) $total,
            'paidCount' => $paidCount,
            // Rata-rata per transaksi; 0 bila belum ada transaksi lunas.
            'averagePerTransaction' => $paidCount > 0 ? $total / $paidCount : 0.0,
            'monthly' => $monthly,
            'byPlan' => $byPlan,
            'byStatus' => array_values($byStatus),
        ];
    }

    /**
     * Tab vendor: jumlah akun, vendor baru per bulan, dan sebaran kategori.
     *
     * `active`/`inactive` adalah keadaan SEKARANG, bukan keadaan pada tahun yang
     * dipilih — tabel vendor tidak menyimpan riwayat perubahan status. Yang
     * dibatasi tahun hanya "vendor baru" dan sebaran kategori pendaftarannya.
     * Perbedaan ini disebutkan di UI supaya angka tidak salah dibaca.
     *
     * @return array<string, mixed>
     */
    private function vendors(Carbon $start, Carbon $end): array
    {
        $total = Vendor::count();
        $active = Vendor::where('is_active', true)->count();

        $registered = Vendor::query()
            ->with('category:id,name')
            ->whereBetween('created_at', [$start, $end])
            ->get(['id', 'category_id', 'created_at']);

        $monthlyNew = array_fill(1, 12, 0);
        $byCategory = [];

        foreach ($registered as $vendor) {
            $monthlyNew[(int) $vendor->created_at->format('n')]++;

            $categoryName = $vendor->category?->name ?? 'Belum berkategori';
            $byCategory[$categoryName] = ($byCategory[$categoryName] ?? 0) + 1;
        }

        $monthly = [];
        for ($month = 1; $month <= 12; $month++) {
            $monthly[] = [
                'month' => $month,
                'label' => $this->monthLabel($month),
                'count' => $monthlyNew[$month],
            ];
        }

        // Kategori diurutkan dari yang terbanyak.
        $categories = [];
        foreach ($byCategory as $name => $count) {
            $categories[] = ['category' => $name, 'count' => $count];
        }
        usort($categories, fn ($a, $b) => $b['count'] <=> $a['count']);

        return [
            'total' => $total,
            'active' => $active,
            'inactive' => $total - $active,
            'newThisYear' => $registered->count(),
            'monthlyNew' => $monthly,
            'byCategory' => $categories,
        ];
    }

    /**
     * Tab "perlu ditindak": langganan aktif yang habis dalam 7 hari.
     *
     * Hanya langganan berstatus `active` — yang sudah lewat tenggang tidak
     * masuk di sini karena tidak bisa "diperpanjang sebelum habis" lagi.
     * Diurutkan dari yang paling mendesak.
     *
     * @return list<array<string, mixed>>
     */
    private function expiringSoon(): array
    {
        $today = Carbon::today();
        $limit = $today->copy()->addDays(self::EXPIRING_SOON_DAYS);

        $subscriptions = Subscription::query()
            ->with(['vendor:id,name,is_active', 'plan:id,name'])
            ->where('status', Subscription::STATUS_ACTIVE)
            ->whereNotNull('ends_at')
            ->whereBetween('ends_at', [$today->copy()->startOfDay(), $limit->copy()->endOfDay()])
            ->orderBy('ends_at')
            ->get();

        return $subscriptions->map(function (Subscription $subscription) use ($today) {
            $endsAt = Carbon::parse($subscription->ends_at)->startOfDay();

            return [
                'subscriptionId' => (string) $subscription->id,
                'vendorId' => (string) $subscription->vendor_id,
                'vendorName' => $subscription->vendor?->name ?? 'Vendor terhapus',
                'vendorActive' => (bool) ($subscription->vendor?->is_active ?? false),
                'planName' => $subscription->plan?->name ?? 'Paket terhapus',
                'endsAt' => $endsAt->toDateString(),
                // 0 = berakhir hari ini.
                'daysLeft' => (int) $today->diffInDays($endsAt, false),
            ];
        })->values()->all();
    }

    /** Label pendek bulan, mis. "Okt". Sama dengan dashboard admin. */
    private function monthLabel(int $month): string
    {
        $labels = [
            1 => 'Jan', 2 => 'Feb', 3 => 'Mar', 4 => 'Apr', 5 => 'Mei', 6 => 'Jun',
            7 => 'Jul', 8 => 'Agu', 9 => 'Sep', 10 => 'Okt', 11 => 'Nov', 12 => 'Des',
        ];

        return $labels[$month] ?? (string) $month;
    }
}
