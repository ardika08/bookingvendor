<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateVendorProfileRequest;
use App\Http\Resources\VendorProfileResource;
use App\Models\Vendor;
use App\Services\CategoryResolver;
use App\Services\OnboardingStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD profil vendor (`/settings`) sekaligus status onboarding.
 *
 * Profil adalah sumber identitas usaha yang tercetak di invoice dan link
 * jadwal publik. `show` membaca, `update` menyimpan; tidak ada create/delete
 * terpisah karena profil dibuat bersama akun dan dihapus bersama akun.
 *
 * `slug` sengaja tidak bisa diubah lewat endpoint ini: itu tautan publik yang
 * sudah tersebar ke klien.
 */
class VendorProfileController extends Controller
{
    use ResolvesVendor;

    public function __construct(private readonly OnboardingStatus $onboarding)
    {
    }

    /**
     * GET /api/vendor/profile
     */
    public function show(): JsonResponse
    {
        $vendor = $this->resolveVendor();
        $vendor->load('user', 'category');

        return (new VendorProfileResource($vendor))->response();
    }

    /**
     * GET /api/vendor/onboarding
     *
     * Status kelengkapan per langkah. Dipisah dari `/api/me` supaya data
     * rekening tidak ikut terkirim pada setiap muat halaman.
     */
    public function onboarding(): JsonResponse
    {
        return response()->json($this->onboarding->resolve($this->resolveVendor()));
    }

    /**
     * PUT|PATCH /api/vendor/profile
     *
     * Endpoint ini melayani dua kebutuhan yang berbeda:
     *
     * 1. **PUT dari halaman Pengaturan** — form mengirim seluruh profil, jadi
     *    field yang tidak dikirim memang berarti "kosongkan".
     * 2. **PATCH dari onboarding** — tiap langkah hanya mengirim field langkah
     *    itu. Kalau diperlakukan seperti PUT, menyimpan langkah rekening akan
     *    menghapus kontak dan deskripsi yang sudah diisi di langkah sebelumnya.
     *
     * Karena itu hanya `PATCH` yang bersifat menambal; `PUT` tetap menimpa.
     * Membedakan lewat method HTTP membuat perilaku form lama tidak berubah.
     */
    public function update(UpdateVendorProfileRequest $request): JsonResponse
    {
        $vendor = $this->resolveVendor();
        $validated = $request->validated();
        $partial = $request->isMethod('PATCH');

        if (! $partial || $request->has('business_name')) {
            $vendor->name = $validated['business_name'];
        }

        if (! $partial || $request->has('description')) {
            $vendor->description = $validated['description'] ?? null;
        }

        if (! $partial || $request->has('contact_phone')) {
            $vendor->contact = $validated['contact_phone'] ?? null;
        }

        if (! $partial || $request->has('contact_email')) {
            $vendor->contact_email = $validated['contact_email'] ?? null;
        }

        if (! $partial || $request->has('city')) {
            $vendor->location = $validated['city'] ?? null;
        }

        if (! $partial || $request->has('bank')) {
            $this->applyBank($vendor, (array) ($validated['bank'] ?? []));
        }

        if (! $partial || $request->has('category')) {
            $vendor->category_id = app(CategoryResolver::class)
                ->resolveId($validated['category'] ?? null);
        }

        $vendor->save();

        $vendor->load('user', 'category');

        return (new VendorProfileResource($vendor))->response();
    }

    /**
     * Terapkan rekening dengan aturan "lengkap semua atau kosong semua".
     *
     * Rekening setengah jadi tidak boleh tersimpan karena akan tercetak di
     * invoice klien sebagai tujuan transfer yang tidak bisa dipakai.
     *
     * @param  array<string, mixed>  $bank
     */
    private function applyBank(Vendor $vendor, array $bank): void
    {
        $complete = collect($bank)->filter(fn ($value) => filled($value))->count() === 3;

        $vendor->bank_name = $complete ? $bank['name'] : null;
        $vendor->bank_account_number = $complete ? $bank['account_number'] : null;
        $vendor->bank_account_name = $complete ? $bank['account_holder'] : null;
    }
}
