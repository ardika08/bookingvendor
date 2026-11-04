<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\Relations\BelongsTo; use Illuminate\Database\Eloquent\Relations\BelongsToMany;
class Addon extends Model { protected $fillable=['vendor_id','name','price','is_active']; protected function casts(): array{return ['price'=>'decimal:2','is_active'=>'boolean'];} public function vendor(): BelongsTo{return $this->belongsTo(Vendor::class);} public function packages(): BelongsToMany{return $this->belongsToMany(Package::class, 'package_addon')->withPivot('price');} }
