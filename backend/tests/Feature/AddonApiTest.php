<?php

namespace Tests\Feature;

use App\Models\Package;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AddonApiTest extends TestCase
{
    use RefreshDatabase;

    private Vendor $vendor;

    protected function setUp(): void
    {
        parent::setUp();
        $user = User::create(['name' => 'Vendor', 'email' => 'vendor@example.test', 'password' => 'password']);
        $this->vendor = Vendor::create(['user_id' => $user->id, 'name' => 'Vendor', 'slug' => 'vendor']);
        $this->loginAsVendorOf($this->vendor);
    }

    public function test_vendor_can_crud_addon_and_override_its_package_price(): void
    {
        $addon = $this->postJson('/api/addons', ['name' => 'Album', 'price' => 1200000])
            ->assertCreated()->assertJsonPath('name', 'Album')->assertJsonPath('active', true);
        $id = $addon->json('id');

        $this->putJson("/api/addons/{$id}", ['price' => 1500000, 'active' => false])
            ->assertOk()->assertJsonPath('price', 1500000)->assertJsonPath('active', false);

        $package = Package::create(['vendor_id' => $this->vendor->id, 'name' => 'Gold', 'price' => 100]);
        $this->putJson("/api/packages/{$package->id}/addons", ['addons' => [['addon_id' => $id, 'price' => 1300000]]])
            ->assertOk()->assertJsonPath('0.price', 1300000);

        $this->getJson('/api/packages')->assertOk()->assertJsonPath('0.addons.0.id', (string) $id);
        $this->deleteJson("/api/addons/{$id}")->assertNoContent();
    }

    public function test_vendor_cannot_map_another_vendor_addon(): void
    {
        $otherUser = User::create(['name' => 'Other', 'email' => 'other@example.test', 'password' => 'password']);
        $other = Vendor::create(['user_id' => $otherUser->id, 'name' => 'Other', 'slug' => 'other']);
        $addonId = $other->addons()->create(['name' => 'Other addon', 'price' => 100])->id;
        $package = Package::create(['vendor_id' => $this->vendor->id, 'name' => 'Gold', 'price' => 100]);

        $this->putJson("/api/packages/{$package->id}/addons", ['addons' => [['addon_id' => $addonId, 'price' => 100]]])->assertStatus(422);
    }
}
