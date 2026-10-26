<?php

use App\Http\Controllers\Api\AdminPlanController;
use App\Http\Controllers\Api\AdminSubscriptionController;
use App\Http\Controllers\Api\AdminSubscriptionPaymentController;
use App\Http\Controllers\Api\AdminVendorController;
use App\Http\Controllers\Api\BlockedDateController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\InvoicePaymentController;
use App\Http\Controllers\Api\PackageController;
use App\Http\Controllers\Api\PublicInvoiceController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\UserProfileController;
use App\Http\Controllers\Api\VendorProfileController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Seluruh endpoint dashboard vendor. Autentikasi (Google OAuth + sesi Sanctum)
| ditambahkan pada task autentikasi; sampai saat itu route di sini belum
| dilindungi middleware auth.
|
*/

Route::prefix('admin')->group(function () {
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
    Route::match(['put', 'patch'], 'plans/{plan}', [AdminPlanController::class, 'update'])
        ->name('admin.plans.update');
});

Route::middleware('vendor.active')->group(function () {
    Route::get('bookings/incoming', [BookingController::class, 'incoming'])->name('bookings.incoming');

    Route::prefix('bookings/{booking}')->group(function () {
        Route::get('invoices', [InvoiceController::class, 'byBooking'])->name('bookings.invoices.index');
        Route::post('invoices', [InvoiceController::class, 'store'])
            ->middleware('invoice.trial')
            ->name('bookings.invoices.store');
    });

    Route::prefix('invoices')->group(function () {
        Route::get('/', [InvoiceController::class, 'index'])->name('invoices.index');
        Route::get('{invoice}', [InvoiceController::class, 'show'])->name('invoices.show');
        Route::match(['put', 'patch'], '{invoice}', [InvoiceController::class, 'update'])->name('invoices.update');
        Route::delete('{invoice}', [InvoiceController::class, 'destroy'])->name('invoices.destroy');

        Route::post('{invoice}/payments', [InvoicePaymentController::class, 'store'])
            ->name('invoices.payments.store');
    });

    Route::prefix('vendor')->group(function () {
        Route::get('profile', [VendorProfileController::class, 'show'])->name('vendor.profile.show');
        Route::match(['put', 'patch'], 'profile', [VendorProfileController::class, 'update'])
            ->name('vendor.profile.update');
    });

    Route::prefix('user')->group(function () {
        Route::get('profile', [UserProfileController::class, 'show'])->name('user.profile.show');
        Route::match(['put', 'patch'], 'profile', [UserProfileController::class, 'update'])
            ->name('user.profile.update');
    });

    Route::get('subscription', [SubscriptionController::class, 'show'])->name('subscription.show');

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
});
