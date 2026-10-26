<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateVendorProfileRequest;
use App\Http\Resources\VendorProfileResource;
use App\Services\CategoryResolver;
use Illuminate\Http\JsonResponse;

/**
 * CRUD profil vendor (`/settings`).
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
     * PUT /api/vendor/profile
     */
    public function update(UpdateVendorProfileRequest $request): JsonResponse
    {
        $vendor = $this->resolveVendor();
        $validated = $request->validated();

        $vendor->name = $validated['business_name'];
        $vendor->description = $validated['description'] ?? null;
        $vendor->contact = $validated['contact_phone'] ?? null;
        $vendor->contact_email = $validated['contact_email'] ?? null;
        $vendor->location = $validated['city'] ?? null;

        $bank = (array) ($validated['bank'] ?? []);
        $bankComplete = collect($bank)->filter(fn ($value) => filled($value))->count() === 3;

        $vendor->bank_name = $bankComplete ? $bank['name'] : null;
        $vendor->bank_account_number = $bankComplete ? $bank['account_number'] : null;
        $vendor->bank_account_name = $bankComplete ? $bank['account_holder'] : null;

        $vendor->category_id = app(CategoryResolver::class)
            ->resolveId($validated['category'] ?? null);
        $vendor->save();

        $vendor->load('user', 'category');

        return (new VendorProfileResource($vendor))->response();
    }
}
