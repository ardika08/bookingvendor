<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAdminVendorRequest;
use App\Http\Requests\UpdateAdminVendorRequest;
use App\Http\Resources\AdminVendorResource;
use App\Models\User;
use App\Models\Vendor;
use App\Services\CategoryResolver;
use App\Services\SubscriptionStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Daftar & tambah vendor untuk panel admin.
 *
 * Admin mengelola **akun**: menambah vendor baru (akun Google ditentukan admin),
 * mencari, dan menyaring berdasarkan status akun/langganan. Tidak ada endpoint
 * yang membuka isi booking/invoice vendor — hanya angka pemakaian.
 *
 * Fase ini belum ada middleware auth admin; begitu fitur login selesai, grup
 * route `/api/admin` dilindungi middleware peran admin.
 */
class AdminVendorController extends Controller
{
    public function __construct(private readonly CategoryResolver $categories)
    {
    }

    /**
     * GET /api/admin/vendors?q=&account=&subscription=
     */
    public function index(Request $request): JsonResponse
    {
        $query = Vendor::query()
            ->with('user', 'category')
            ->withCount(['bookings', 'invoices']);

        if (($keyword = trim((string) $request->query('q', ''))) !== '') {
            $query->where(function ($builder) use ($keyword) {
                $builder->where('name', 'like', "%{$keyword}%")
                    ->orWhere('location', 'like', "%{$keyword}%")
                    ->orWhereHas('user', function ($user) use ($keyword) {
                        $user->where('name', 'like', "%{$keyword}%")
                            ->orWhere('email', 'like', "%{$keyword}%");
                    });
            });
        }

        $account = $request->query('account');
        if ($account === 'active') {
            $query->where('is_active', true);
        } elseif ($account === 'inactive') {
            $query->where('is_active', false);
        }

        $vendors = $query
            ->orderByDesc('is_active')
            ->orderByDesc('created_at')
            ->get();

        // Filter langganan memakai status hasil turunan (trial/active/grace/
        // expired), jadi tidak bisa diterjemahkan langsung ke satu kolom.
        $subscription = $request->query('subscription');
        if ($subscription !== null && $subscription !== '' && $subscription !== 'all') {
            $statuses = app(SubscriptionStatus::class);
            $vendors = $vendors
                ->filter(fn (Vendor $vendor) => $statuses->resolve($vendor)['status'] === $subscription)
                ->values();
        }

        return response()->json(AdminVendorResource::collection($vendors)->resolve());
    }

    /**
     * GET /api/admin/vendors/{vendor}
     */
    public function show(Vendor $vendor): JsonResponse
    {
        $vendor->load('user', 'category')->loadCount(['bookings', 'invoices']);

        return (new AdminVendorResource($vendor))->response();
    }

    /**
     * PUT/PATCH /api/admin/vendors/{vendor}
     *
     * Mengubah profil usaha & nama pemilik. Email login tidak bisa diubah;
     * `slug` juga dibiarkan karena itu tautan publik yang sudah tersebar.
     */
    public function update(UpdateAdminVendorRequest $request, Vendor $vendor): JsonResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($vendor, $validated): void {
            $vendor->name = $validated['name'];
            $vendor->category_id = $this->categories->resolveId($validated['category']);
            $vendor->location = $validated['city'] ?? null;
            $vendor->description = $validated['description'] ?? null;
            $vendor->contact = $validated['contact'] ?? null;
            $vendor->save();

            $vendor->user?->update(['name' => $validated['owner_name']]);
        });

        $vendor->load('user', 'category')->loadCount(['bookings', 'invoices']);

        return (new AdminVendorResource($vendor))->response();
    }

    /**
     * PATCH /api/admin/vendors/{vendor}/status
     *
     * Menonaktifkan/mengaktifkan akun. Data vendor tidak dihapus: booking,
     * invoice, dan langganan tetap utuh.
     */
    public function updateStatus(Request $request, Vendor $vendor): JsonResponse
    {
        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $vendor->is_active = (bool) $validated['is_active'];
        $vendor->save();

        $vendor->load('user', 'category')->loadCount(['bookings', 'invoices']);

        return (new AdminVendorResource($vendor))->response();
    }

    /**
     * POST /api/admin/vendors
     */
    public function store(StoreAdminVendorRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $vendor = DB::transaction(function () use ($validated): Vendor {
            $user = User::create([
                'name' => $validated['owner_name'],
                'email' => $validated['email'],
                // Akun masuk lewat Google — tanpa kata sandi.
                'password' => null,
            ]);

            $vendor = Vendor::create([
                'user_id' => $user->id,
                'category_id' => $this->categories->resolveId($validated['category']),
                'name' => $validated['name'],
                'slug' => $this->uniqueSlug($validated['name']),
                'location' => $validated['city'] ?? null,
                'is_active' => true,
            ]);

            app(\App\Services\TrialStarter::class)->start($vendor);

            return $vendor;
        });

        $vendor->load('user', 'category')->loadCount(['bookings', 'invoices']);

        return (new AdminVendorResource($vendor))
            ->response()
            ->setStatusCode(201);
    }

    /** Slug unik dari nama usaha (`lumen-wedding-story`, `…-2`, dst.). */
    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'vendor';
        $slug = $base;
        $suffix = 2;

        while (Vendor::query()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }

}
