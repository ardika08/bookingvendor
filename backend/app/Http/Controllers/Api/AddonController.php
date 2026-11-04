<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesVendor;
use App\Http\Controllers\Controller;
use App\Models\Addon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AddonController extends Controller
{
    use ResolvesVendor;

    public function index(): JsonResponse
    {
        return response()->json($this->resolveVendor()->addons()->orderBy('name')->get()->map(fn (Addon $addon) => $this->present($addon))->values());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required','string','max:100'], 'price' => ['required','numeric','min:0'], 'active' => ['sometimes','boolean']]);
        $addon = $this->resolveVendor()->addons()->create(['name' => trim($data['name']), 'price' => $data['price'], 'is_active' => $data['active'] ?? true]);
        return response()->json($this->present($addon), 201);
    }

    public function update(Request $request, Addon $addon): JsonResponse
    {
        $this->authorizeAddon($addon);
        $data = $request->validate(['name' => ['sometimes','required','string','max:100'], 'price' => ['sometimes','numeric','min:0'], 'active' => ['sometimes','boolean']]);
        if (array_key_exists('name',$data)) $addon->name = trim($data['name']);
        if (array_key_exists('price',$data)) $addon->price = $data['price'];
        if (array_key_exists('active',$data)) $addon->is_active = (bool) $data['active'];
        $addon->save();
        return response()->json($this->present($addon));
    }

    public function destroy(Addon $addon): JsonResponse
    {
        $this->authorizeAddon($addon);
        $addon->delete();
        return response()->json(null, 204);
    }

    private function authorizeAddon(Addon $addon): void
    {
        abort_unless($addon->vendor_id === $this->resolveVendor()->id, 404);
    }

    private function present(Addon $addon): array
    {
        return ['id' => (string) $addon->id, 'name' => $addon->name, 'price' => (float) $addon->price, 'active' => (bool) $addon->is_active];
    }
}
