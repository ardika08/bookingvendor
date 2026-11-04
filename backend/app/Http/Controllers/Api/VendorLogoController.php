<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Logo usaha vendor (`/api/vendor/logo`).
 *
 * Endpoint terpisah dari profil karena logo dikirim sebagai multipart/form-data,
 * sedangkan PUT profil memakai JSON — mencampur keduanya memaksa semua klien
 * mengirim multipart padahal hanya butuh mengubah teks.
 *
 * Berkas disimpan di disk `public` dengan path relatif (`vendor-logos/…`); URL
 * lengkap dibentuk resource saat membaca. Ukuran dibatasi 2 MB dan tipe dibatasi
 * png/jpg/webp agar muat dipakai sebagai kepala invoice, bukan galeri.
 */
class VendorLogoController extends Controller
{
    use ResolvesVendor;

    /** Ukuran maksimum berkas logo, dalam kilobyte. */
    private const MAX_KB = 2048;

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:'.self::MAX_KB],
        ]);

        $vendor = $this->resolveVendor();

        // Hapus logo lama supaya disk tidak menumpuk berkas tak bertuan.
        if ($vendor->logo_path) {
            Storage::disk('public')->delete($vendor->logo_path);
        }

        $path = $request->file('logo')->store('vendor-logos', 'public');

        $vendor->logo_path = $path;
        $vendor->save();

        // Path relatif, bukan URL absolut: origin backend bisa berbeda dari
        // domain frontend (dev `:8082` vs `:4173`, produksi `api.` vs utama).
        // Frontend menyusun URL lengkap lewat `backendUrl()`.
        return response()->json([
            'logoPath' => $path,
        ]);
    }

    public function destroy(): JsonResponse
    {
        $vendor = $this->resolveVendor();

        if ($vendor->logo_path) {
            Storage::disk('public')->delete($vendor->logo_path);
            $vendor->logo_path = null;
            $vendor->save();
        }

        return response()->json(['logoPath' => null]);
    }
}
