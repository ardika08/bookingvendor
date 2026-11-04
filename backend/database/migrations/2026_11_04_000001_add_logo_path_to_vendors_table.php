<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Logo usaha vendor.
 *
 * Sengaja hanya menyimpan PATH berkas (mis. `vendor-logos/7/a1b2c3.png`),
 * bukan URL penuh: URL bergantung pada `APP_URL`, yang bisa berubah ketika
 * domain berpindah, sedangkan path relatif tetap berlaku. URL dibentuk saat
 * data dikirim ke frontend (`VendorProfileResource`, `PublicInvoiceResource`).
 *
 * `null` berarti vendor belum memasang logo — invoice menampilkan inisial
 * nama usaha seperti sebelumnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->string('logo_path')->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropColumn('logo_path');
        });
    }
};
