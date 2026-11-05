<?php

namespace Tests\Feature;

use App\Models\Addon;
use App\Models\Package;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Paket pada jadwal publik kini membawa deskripsi lengkap dan daftar addon
 * (harga khusus paket). Hanya paket aktif dan addon aktif yang boleh tampil.
 */
class PublicSchedulePackagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_jadwal_publik_menampilkan_deskripsi_dan_addon_paket_aktif(): void
    {
        $vendor = $this->vendor();

        $addon = Addon::query()->create([
            'vendor_id' => $vendor->id,
            'name' => 'Extra time 5 jam',
            'price' => 500000,
            'is_active' => true,
        ]);
        $addonOff = Addon::query()->create([
            'vendor_id' => $vendor->id,
            'name' => 'Album nonaktif',
            'price' => 700000,
            'is_active' => false,
        ]);

        $package = Package::query()->create([
            'vendor_id' => $vendor->id,
            'name' => 'Paket Basic',
            'price' => 12000000,
            'duration_hours' => 6,
            'description' => 'Dokumentasi foto dan video.',
            'is_active' => true,
        ]);
        // Harga khusus paket menggantikan harga dasar addon.
        $this->attach($package->id, $addon->id, 650000);
        $this->attach($package->id, $addonOff->id, 700000);

        $inactive = Package::query()->create([
            'vendor_id' => $vendor->id,
            'name' => 'Paket Nonaktif',
            'price' => 9000000,
            'is_active' => false,
        ]);
        $this->attach($inactive->id, $addon->id, 500000);

        $this->getJson('/api/public/schedules/'.$vendor->slug.'?month=2027-03')
            ->assertOk()
            ->assertJsonCount(1, 'vendor.packages')
            ->assertJsonPath('vendor.packages.0.name', 'Paket Basic')
            ->assertJsonPath('vendor.packages.0.description', 'Dokumentasi foto dan video.')
            ->assertJsonCount(1, 'vendor.packages.0.addons')
            ->assertJsonPath('vendor.packages.0.addons.0.id', (string) $addon->id)
            ->assertJsonPath('vendor.packages.0.addons.0.name', 'Extra time 5 jam')
            // Harga yang tampil adalah harga khusus paket.
            ->assertJsonPath('vendor.packages.0.addons.0.price', 650000);
    }

    private function vendor(): Vendor
    {
        $user = User::query()->create([
            'name' => 'Vendor Uji',
            'email' => 'vendor-jadwal-paket@example.com',
            'role' => User::ROLE_VENDOR,
        ]);

        return Vendor::query()->create([
            'user_id' => $user->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
            'location' => 'Bandung',
        ]);
    }

    private function attach(string $packageId, string $addonId, int $price): void
    {
        DB::table('package_addon')->insert([
            'package_id' => $packageId,
            'addon_id' => $addonId,
            'price' => $price,
        ]);
    }
}
