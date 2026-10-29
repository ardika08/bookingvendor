<?php

use App\Http\Controllers\Api\AdminDashboardController;
use App\Http\Controllers\Api\AdminPlanController;
use App\Http\Controllers\Api\AdminReportController;
use App\Http\Controllers\Api\AdminSettingController;
use App\Http\Controllers\Api\AdminSubscriptionController;
use App\Http\Controllers\Api\AdminSubscriptionPaymentController;
use App\Http\Controllers\Api\AdminVendorController;
use App\Http\Controllers\Api\BlockedDateController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\CurrentUserController;
use App\Http\Controllers\Api\DuitkuCallbackController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\InvoicePaymentController;
use App\Http\Controllers\Api\InvoiceShareLinkController;
use App\Http\Controllers\Api\PackageController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PlanController;
use App\Http\Controllers\Api\PublicInvoiceController;
use App\Http\Controllers\Api\PublicScheduleController;
use App\Http\Controllers\Api\RevenueController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\UserProfileController;
use App\Http\Controllers\Api\VendorProfileController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Autentikasi memakai Sanctum dengan jembatan sesi SPA (`statefulApi()` di
| bootstrap/app.php): login Google menulis cookie sesi pada guard `web`, lalu
| SPA memanggil endpoint di bawah dengan `credentials: 'include'`.
|
| Setiap grup di bawah WAJIB dibungkus `auth:sanctum`. Middleware peran
| (`admin.only`) dan aturan bisnis (`vendor.active`, `invoice.trial`) dipasang
| SETELAH auth karena semuanya membaca `$request->user()`.
|
*/

// Identitas pengguna yang sedang login. Dipakai SPA sebagai pemeriksa sesi.
Route::middleware('auth:sanctum')->get('me', [CurrentUserController::class, 'show'])
    ->name('me.show');

/*
| Callback payment gateway.
|
| Publik — dipanggil server Duitku, bukan browser vendor, sehingga tidak boleh
| memakai `auth:sanctum`. Keamanan dijaga oleh verifikasi signature dan
| pengecekan ulang status ke gateway di dalam controller.
|
| Didaftarkan tanpa middleware `api` tambahan agar tidak terkena rate limit
| berbasis IP: Duitku dapat mengirim beberapa callback berurutan.
*/
Route::post('webhooks/duitku', DuitkuCallbackController::class)
    ->name('webhooks.duitku');

/*
| Panel admin platform. Hanya pengguna berperan `admin`.
*/
Route::middleware(['auth:sanctum', 'admin.only'])->prefix('admin')->group(function () {
    Route::get('vendors', [AdminVendorController::class, 'index'])->name('admin.vendors.index');
    Route::post('vendors', [AdminVendorController::class, 'store'])->name('admin.vendors.store');
    Route::get('vendors/{vendor}', [AdminVendorController::class, 'show'])->name('admin.vendors.show');
    Route::match(['put', 'patch'], 'vendors/{vendor}', [AdminVendorController::class, 'update'])
        ->name('admin.vendors.update');
    Route::patch('vendors/{vendor}/status', [AdminVendorController::class, 'updateStatus'])
        ->name('admin.vendors.status');
    Route::get('vendors/{vendor}/payments', [AdminSubscriptionPaymentController::class, 'index'])
        ->name('admin.vendors.payments.index');
    Route::post('vendors/{vendor}/subscriptions/renew', [AdminSubscriptionController::class, 'renew'])
        ->name('admin.vendors.subscriptions.renew');

    Route::get('plans', [AdminPlanController::class, 'index'])->name('admin.plans.index');
    Route::post('plans', [AdminPlanController::class, 'store'])->name('admin.plans.store');
    Route::match(['put', 'patch'], 'plans/{plan}', [AdminPlanController::class, 'update'])
        ->name('admin.plans.update');
    Route::delete('plans/{plan}', [AdminPlanController::class, 'destroy'])
        ->name('admin.plans.destroy');

    // Dashboard admin: ringkasan angka platform + grafik pendapatan agregat.
    Route::get('dashboard/summary', [AdminDashboardController::class, 'summary'])
        ->name('admin.dashboard.summary');
    Route::get('dashboard/revenue-series', [AdminDashboardController::class, 'revenueSeries'])
        ->name('admin.dashboard.revenue-series');
    Route::get('dashboard/transactions', [AdminDashboardController::class, 'transactions'])
        ->name('admin.dashboard.transactions');

    // Laporan tahunan: pendapatan, pertumbuhan vendor, dan langganan yang
    // segera habis — satu respons untuk ketiga tab.
    Route::get('reports', [AdminReportController::class, 'index'])
        ->name('admin.reports.index');

    // Aturan platform: masa tenggang langganan & kuota trial. Perubahan
    // dicatat di riwayat karena berdampak ke seluruh vendor.
    Route::get('settings', [AdminSettingController::class, 'index'])
        ->name('admin.settings.index');
    Route::put('settings', [AdminSettingController::class, 'update'])
        ->name('admin.settings.update');
});

/*
| Dashboard vendor. Login wajib; akun yang dinonaktifkan admin ditolak 403.
*/
Route::middleware(['auth:sanctum', 'vendor.active'])->group(function () {
    // Daftar pesanan masuk (status tentative) untuk kartu dashboard.
    Route::get('bookings/summary', [BookingController::class, 'summary'])->name('bookings.summary');
    Route::get('bookings/incoming', [BookingController::class, 'incoming'])->name('bookings.incoming');

    // Daftar booking berhalaman + daftar lengkap (untuk agregat dashboard).
    Route::get('bookings', [BookingController::class, 'index'])->name('bookings.index');

    // Tanggal yang sudah terpakai (booking aktif + blokir manual).
    Route::get('bookings/taken-dates', [BookingController::class, 'takenDates'])->name('bookings.taken-dates');

    // Rincian satu booking.
    Route::get('bookings/{booking}', [BookingController::class, 'show'])->name('bookings.show');

    // Buat booking baru. Pembatas langganan & kuota trial diperiksa di
    // controller (bukan middleware) karena payload tidak membawa id vendor.
    Route::post('bookings', [BookingController::class, 'store'])->name('bookings.store');

    // Ubah booking.
    Route::match(['put', 'patch'], 'bookings/{booking}', [BookingController::class, 'update'])->name('bookings.update');

    // Ubah status booking (transisi yang sah saja).
    Route::patch('bookings/{booking}/status', [BookingController::class, 'updateStatus'])->name('bookings.status');

    Route::prefix('bookings/{booking}')->group(function () {
        Route::get('invoices', [InvoiceController::class, 'byBooking'])->name('bookings.invoices.index');
        Route::post('invoices', [InvoiceController::class, 'store'])
            ->middleware(['invoice.trial', 'onboarding.complete'])
            ->name('bookings.invoices.store');
        Route::patch('invoices/reorder', [InvoiceController::class, 'reorderTerms'])
            ->name('bookings.invoices.reorder');
    });

    /*
     * Klien dibuat otomatis dari form booking, jadi hanya ada endpoint baca.
     * `{client}` memakai route-model binding; controller memastikan klien itu
     * milik vendor yang login.
     */
    Route::get('clients', [ClientController::class, 'index'])->name('clients.index');
    Route::get('clients/{client}', [ClientController::class, 'show'])->name('clients.show');

    /*
     * Seri pendapatan bulanan untuk grafik dashboard.
     *
     * Rentang dibatasi 12 bulan agar satu vendor tidak bisa meminta seluruh
     * riwayat usahanya sekaligus.
     */
    Route::get('revenue/series', [RevenueController::class, 'series'])->name('revenue.series');

    Route::prefix('invoices')->group(function () {
        Route::get('/', [InvoiceController::class, 'index'])->name('invoices.index');
        Route::get('{invoice}', [InvoiceController::class, 'show'])->name('invoices.show');
        Route::match(['put', 'patch'], '{invoice}', [InvoiceController::class, 'update'])->name('invoices.update');
        Route::delete('{invoice}', [InvoiceController::class, 'destroy'])->name('invoices.destroy');

        /*
         * Link publik invoice. Token adalah satu-satunya kunci akses halaman
         * publik, jadi reset & nonaktifkan dipisah tegas dari pembuatan.
         */
        Route::prefix('{invoice}/share-link')->group(function () {
            Route::get('/', [InvoiceShareLinkController::class, 'show'])
                ->name('invoices.share-link.show');
            Route::post('/', [InvoiceShareLinkController::class, 'store'])
                ->name('invoices.share-link.store');
            Route::post('reset', [InvoiceShareLinkController::class, 'reset'])
                ->name('invoices.share-link.reset');
            Route::delete('/', [InvoiceShareLinkController::class, 'destroy'])
                ->name('invoices.share-link.destroy');
        });

        Route::get('{invoice}/payments', [InvoicePaymentController::class, 'index'])
            ->name('invoices.payments.index');
        Route::post('{invoice}/payments', [InvoicePaymentController::class, 'store'])
            ->name('invoices.payments.store');
    });

    Route::prefix('vendor')->group(function () {
        Route::get('profile', [VendorProfileController::class, 'show'])->name('vendor.profile.show');
        Route::match(['put', 'patch'], 'profile', [VendorProfileController::class, 'update'])
            ->name('vendor.profile.update');

        /*
         * Status kelengkapan onboarding. Dipisah dari `/api/me` supaya data
         * rekening tidak ikut terkirim pada setiap muat halaman.
         */
        Route::get('onboarding', [VendorProfileController::class, 'onboarding'])
            ->name('vendor.onboarding.show');
    });

    Route::prefix('user')->group(function () {
        Route::get('profile', [UserProfileController::class, 'show'])->name('user.profile.show');
        Route::match(['put', 'patch'], 'profile', [UserProfileController::class, 'update'])
            ->name('user.profile.update');
    });

    Route::get('subscription', [SubscriptionController::class, 'show'])->name('subscription.show');

    /*
     * Katalog paket & pembayaran langganan.
     *
     * `plans` butuh login karena harganya khusus vendor terdaftar. `payments`
     * hanya menampilkan transaksi milik vendor yang sedang login.
     */
    Route::get('plans', [PlanController::class, 'index'])->name('plans.index');

    Route::get('payments', [PaymentController::class, 'index'])->name('payments.index');

    Route::prefix('subscription/checkout')->group(function () {
        // Ringkasan sebelum transaksi dibuat (tidak memanggil gateway).
        Route::get('/', [CheckoutController::class, 'show'])->name('subscription.checkout.show');

        // Membuat transaksi Duitku; mengembalikan QR untuk dipindai.
        Route::post('/', [CheckoutController::class, 'store'])->name('subscription.checkout.store');

        // Metode yang tersedia (QRIS saja).
        Route::get('methods', [CheckoutController::class, 'methods'])
            ->name('subscription.checkout.methods');
    });

    Route::prefix('payments/{payment}')->group(function () {
        // Pilih metode → kembalikan instruksi bayar (QRIS: QR + URL bayar).
        Route::post('method', [CheckoutController::class, 'selectMethod'])->name('payments.method');

        // Lanjutkan transaksi pending dari riwayat pembayaran.
        Route::get('checkout', [CheckoutController::class, 'resume'])->name('payments.checkout');

        // Polling status selama vendor menunggu pembayaran.
        Route::get('status', [CheckoutController::class, 'status'])->name('payments.status');

        // Tandai kedaluwarsa saat countdown di UI habis.
        Route::post('expire', [CheckoutController::class, 'expire'])->name('payments.expire');
    });

    Route::prefix('packages')->group(function () {
        Route::get('/', [PackageController::class, 'index'])->name('packages.index');
        Route::post('/', [PackageController::class, 'store'])->name('packages.store');
        Route::match(['put', 'patch'], '{package}', [PackageController::class, 'update'])
            ->name('packages.update');
        Route::delete('{package}', [PackageController::class, 'destroy'])->name('packages.destroy');
    });

    Route::prefix('blocked-dates')->group(function () {
        Route::get('/', [BlockedDateController::class, 'index'])->name('blocked-dates.index');
        Route::post('/', [BlockedDateController::class, 'store'])->name('blocked-dates.store');
        Route::delete('{blockedDate}', [BlockedDateController::class, 'destroy'])
            ->name('blocked-dates.destroy');
    });
});

/*
|--------------------------------------------------------------------------
| Rute Publik (tanpa login)
|--------------------------------------------------------------------------
|
| Diakses klien lewat link yang dibagikan vendor. Token pada URL adalah satu-
| satunya kunci akses; token yang dinonaktifkan menghasilkan 404.
|
*/
Route::prefix('public')->group(function () {
    Route::get('invoices/{token}', [PublicInvoiceController::class, 'show'])
        ->name('public.invoices.show');

    /*
     * Jadwal ketersediaan vendor. Publik karena dibagikan ke calon klien;
     * isinya sengaja hanya tanggal terpakai + paket aktif, tanpa data klien.
     */
    Route::get('schedules/{slug}', [PublicScheduleController::class, 'show'])
        ->name('public.schedules.show');
});
