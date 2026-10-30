<?php

namespace Tests\Feature;

use App\Models\Plan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji katalog paket publik untuk halaman promosi.
 *
 * Halaman promosi sebelumnya memakai data mock dengan harga `null` untuk paket
 * 3 Bulan & Tahunan, sehingga kartunya menampilkan "Segera" beserta tombol mati
 * padahal admin sudah menetapkan harga. Endpoint ini menggantikannya; berkas ini
 * mengunci bentuk responsnya supaya halaman jualan tidak pernah menampilkan
 * harga yang salah.
 */
class PublicPlanTest extends TestCase
{
    use RefreshDatabase;

    private function plan(array $attributes = []): Plan
    {
        return Plan::create(array_merge([
            'code' => 'monthly',
            'name' => 'Bulanan',
            'duration_months' => 1,
            'price' => 50000,
            'is_active' => true,
        ], $attributes));
    }

    /** Halaman promosi dibaca tanpa login — endpoint tidak boleh butuh sesi. */
    public function test_katalog_publik_tanpa_login(): void
    {
        $this->plan();

        $this->getJson('/api/public/plans')->assertOk()->assertJsonCount(1);
    }

    public function test_harga_ketiga_paket_dikirim(): void
    {
        $this->plan(['code' => 'monthly', 'name' => 'Bulanan', 'duration_months' => 1, 'price' => 50000]);
        $this->plan(['code' => 'quarterly', 'name' => '3 Bulan', 'duration_months' => 3, 'price' => 135000]);
        $this->plan(['code' => 'yearly', 'name' => 'Tahunan', 'duration_months' => 12, 'price' => 480000]);

        $response = $this->getJson('/api/public/plans')->assertOk()->assertJsonCount(3);

        $prices = collect($response->json())->pluck('price')->all();
        $this->assertSame([50000, 135000, 480000], $prices);
    }

    /** Urut dari paket terpendek supaya katalog terbaca naik. */
    public function test_urut_dari_durasi_terpendek(): void
    {
        $this->plan(['code' => 'yearly', 'name' => 'Tahunan', 'duration_months' => 12, 'price' => 480000]);
        $this->plan(['code' => 'monthly', 'name' => 'Bulanan', 'duration_months' => 1, 'price' => 50000]);

        $names = collect($this->getJson('/api/public/plans')->json())->pluck('name')->all();

        $this->assertSame(['Bulanan', 'Tahunan'], $names);
    }

    /** Paket nonaktif tidak boleh muncul di halaman jualan. */
    public function test_paket_nonaktif_tidak_muncul(): void
    {
        $this->plan(['code' => 'monthly', 'is_active' => true]);
        $this->plan(['code' => 'yearly', 'name' => 'Tahunan', 'duration_months' => 12, 'is_active' => false]);

        $this->getJson('/api/public/plans')->assertOk()->assertJsonCount(1);
    }

    /** Paket tanpa harga tidak bisa dibeli, jadi tidak perlu ditampilkan. */
    public function test_paket_tanpa_harga_tidak_muncul(): void
    {
        $this->plan(['code' => 'monthly', 'price' => null]);

        $this->getJson('/api/public/plans')->assertOk()->assertJsonCount(0);
    }

    /**
     * Harga normal hanya dikirim bila lebih tinggi dari harga bayar. Kalau
     * sama, kartu akan mencoret angka yang identik — mengarang diskon.
     */
    public function test_harga_normal_hanya_bila_lebih_tinggi(): void
    {
        $this->plan(['code' => 'monthly', 'price' => 50000, 'normal_price' => 125000]);
        $this->plan(['code' => 'yearly', 'name' => 'Tahunan', 'duration_months' => 12, 'price' => 480000, 'normal_price' => 480000]);

        $plans = collect($this->getJson('/api/public/plans')->json());

        $this->assertSame(125000, $plans->firstWhere('code', 'monthly')['normalPrice']);
        $this->assertNull($plans->firstWhere('code', 'yearly')['normalPrice']);
    }

    /** Paket tahunan disorot sebagai pilihan paling hemat. */
    public function test_paket_tahunan_disorot(): void
    {
        $this->plan(['code' => 'monthly', 'price' => 50000]);
        $this->plan(['code' => 'yearly', 'name' => 'Tahunan', 'duration_months' => 12, 'price' => 480000]);

        $plans = collect($this->getJson('/api/public/plans')->json());

        $this->assertTrue($plans->firstWhere('code', 'yearly')['highlight']);
        $this->assertFalse($plans->firstWhere('code', 'monthly')['highlight']);
    }

    /**
     * Persentase hemat dihitung dari harga per bulan terhadap paket termurah.
     * Angka ini tampil di kartu, jadi harus benar — klaim diskon yang salah
     * membuat calon pembeli kehilangan kepercayaan.
     */
    public function test_persentase_hemat_dihitung_benar(): void
    {
        // Bulanan 50rb/bln; 3 Bulan 135rb = 45rb/bln → hemat 10%.
        $this->plan(['code' => 'monthly', 'name' => 'Bulanan', 'duration_months' => 1, 'price' => 50000]);
        $this->plan(['code' => 'quarterly', 'name' => '3 Bulan', 'duration_months' => 3, 'price' => 135000]);

        $plans = collect($this->getJson('/api/public/plans')->json());
        $benefits = $plans->firstWhere('code', 'quarterly')['benefits'];

        $this->assertContains('Hemat 10% dibanding paket bulanan', $benefits);
    }

    /** Paket bulanan sendiri tidak mengklaim hemat. */
    public function test_paket_bulanan_tidak_mengklaim_hemat(): void
    {
        $this->plan(['code' => 'monthly', 'name' => 'Bulanan', 'duration_months' => 1, 'price' => 50000]);

        $benefits = $this->getJson('/api/public/plans')->json()[0]['benefits'];

        foreach ($benefits as $benefit) {
            $this->assertStringNotContainsString('Hemat', $benefit);
        }
    }

    /**
     * Manfaat tidak boleh menyebut jumlah hari.
     *
     * Masa aktif dihitung dalam bulan kalender (`addMonthsNoOverflow`), jadi
     * paket tahunan sebenarnya 365–366 hari — bukan 360. Menyebut angka hari
     * juga bertabrakan dengan label "Aktif 12 bulan" di judul kartu.
     */
    public function test_manfaat_tidak_menyebut_jumlah_hari(): void
    {
        $this->plan(['code' => 'quarterly', 'name' => '3 Bulan', 'duration_months' => 3, 'price' => 135000]);

        $benefits = $this->getJson('/api/public/plans')->json()[0]['benefits'];

        foreach ($benefits as $benefit) {
            $this->assertStringNotContainsString('hari', $benefit);
        }

        $this->assertContains('Booking & invoice tanpa batas', $benefits);
        $this->assertContains('Link jadwal publik untuk klien', $benefits);
    }
}
