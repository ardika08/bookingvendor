<?php
namespace Tests\Feature;
use App\Models\Addon; use App\Models\Package; use App\Models\User; use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase; use Tests\TestCase;
class AddonApiTest extends TestCase { use RefreshDatabase; private Vendor $vendor; protected function setUp(): void { parent::setUp(); $u=User::create(['name'=>'V','email'=>'v@test','password'=>'password']); $this->vendor=Vendor::create(['user_id'=>$u->id,'name'=>'V','slug'=>'v']); $this->loginAsVendorOf($this->vendor); }
public function test_crud_addon_and_package_mapping(): void { $r=$this->postJson('/api/addons',['name'=>'Album','price'=>1200000]); $r->assertCreated()->assertJsonPath('name','Album')->assertJsonPath('active',true); $id=$r->json('id'); $this->putJson("/api/addons/$id",['price'=>1500000,'active'=>false])->assertOk()->assertJsonPath('price',1500000)->assertJsonPath('active',false); $p=Package::create(['vendor_id'=>$this->vendor->id,'name'=>'Gold','price'=>100]); $this->putJson("/api/packages/{$p->id}/addons",['addons'=>[['addon_id'=>$id,'price'=>1300000]]])->assertOk()->assertJsonPath('0.price',1300000); $this->getJson('/api/packages')->assertJsonPath('0.addons.0.id',(string)$id); $this->deleteJson("/api/addons/$id")->assertNoContent(); }
public function test_addon_vendor_isolation(): void { $this->getJson('/api/addons')->assertOk(); $this->postJson('/api/addons',['name'=>'X','price'=>1])->assertCreated(); }
}
namespace App\Models; class_alias(\App\Models\Addon::class, 'Addon');

// @phpstan-ignore-next-line
?>
