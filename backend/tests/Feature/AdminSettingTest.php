<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Vendor;
use App\Services\PlatformSettings;
use App\Services\SubscriptionStatus;
use App\Services\TrialQuota;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Pengaturan platform (`/api/admin/settings`).
 *
 * Yang diuji bukan hanya bentuk respons, tetapi apakah nilai yang disimpan
 * BENAR-BENAR mengubah perilaku aplikasi: masa tenggang yang dipakai
 * `SubscriptionStatus` dan kuota yang dipakai `TrialQuota`. Pengaturan yang
 * tersimpan rapi tetapi tidak dibaca kode adalah bug yang tidak kelihatan.
 */
class AdminSettingTest extends TestCase
{
    use RefreshDatabase;

    private string $adminName = '';

    protected function setUp(): void
    {
        parent::setUp();
        $this->loginAsAdmin();
        // Nama pelaku di riwayat harus berasal dari akun yang dipakai tes ini,
        // bukan nama yang ditebak (fixture bisa memakai admin yang sudah ada.
        $this->adminName = auth()->user()->name;
    }

    private function makeVendor(): Vendor
    {
        static $sequence = 0;
        $sequence++;

        $user = User::create([
            'name' => "Pemilik {$sequence}",
            'email' => "pengaturan{$sequence}@example.test",
            'password' => 'password',
        ]);

        return Vendor::create([
            'user_id' => $user->id,
            'name' => "Vendor Pengaturan {$sequence}",
            'slug' => "vendor-pengaturan-{$sequence}",
            'is_active' => true,
        ]);
    }

    private function makeActiveSubscription(Vendor $vendor, Carbon $endsAt): Subscription
    {
        $plan = Plan::create([
            'code' => 'plan-'.uniqid(),
            'name' => 'Bulanan',
            'duration_months' => 1,
            'price' => 50000,
            'is_active' => true,
        ]);

        return Subscription::create([
            'vendor_id' => $vendor->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'starts_at' => $endsAt->copy()->subMonth()->toDateString(),
            'ends_at' => $endsAt->toDateString(),
        ]);
    }

    public function test_nilai_awal_diambil_dari_config(): void
    {
        $response = $this->getJson('/api/admin/settings')->assertOk();

        $this->assertSame(7, $response->json('settings.graceDays'));
        $this->assertSame(30, $response->json('settings.trialDays'));

        // Batas nilai ikut dikirim agar UI tidak menebak sendiri.
        $this->assertSame(1, $response->json('rules.graceDays.min'));
        $this->assertSame(30, $response->json('rules.graceDays.max'));
    }

    /**
     * Respons PUT harus berbentuk sama dengan GET — termasuk `rules`.
     *
     * Regresi: versi pertama hanya mengirim `rules` di GET, sehingga halaman
     * kehilangan batas min/max input tepat setelah admin menyimpan dan
     * langsung crash.
     */
    public function test_respons_simpan_menyertakan_batas_nilai(): void
    {
        $this->putJson('/api/admin/settings', ['graceDays' => 5])
            ->assertOk()
            ->assertJsonPath('rules.graceDays.min', 1)
            ->assertJsonPath('rules.graceDays.max', 30)
            ->assertJsonStructure(['settings', 'rules', 'changed', 'history', 'impact']);
    }

    public function test_admin_bisa_mengubah_aturan(): void
    {
        $this->putJson('/api/admin/settings', [
            'graceDays' => 14,
            'trialDays' => 45,
        ])
            ->assertOk()
            ->assertJsonPath('settings.graceDays', 14)
            ->assertJsonPath('settings.trialDays', 45);

        $this->assertDatabaseHas('platform_settings', [
            'key' => 'subscription.grace_days',
            'value' => '14',
        ]);
    }

    /**
     * Inti dari fitur ini: nilai dari database harus mengubah perilaku nyata.
     * Masa tenggang 3 hari berarti langganan yang habis 5 hari lalu sudah
     * dianggap kedaluwarsa, bukan masih dalam tenggang.
     */
    public function test_masa_tenggang_dari_database_dipakai_status_langganan(): void
    {
        $vendor = $this->makeVendor();
        $this->makeActiveSubscription($vendor, Carbon::today()->subDays(5));

        // Tenggang 7 hari (default): masih dalam masa tenggang.
        $status = app(SubscriptionStatus::class);
        $this->assertTrue($status->isInGrace($vendor), 'default 7 hari seharusnya masih tenggang');

        // Admin memperpendek menjadi 3 hari.
        $this->putJson('/api/admin/settings', ['graceDays' => 3])->assertOk();

        $this->assertSame(3, config('subscription.grace_days'));
        $this->assertTrue(
            app(SubscriptionStatus::class)->isExpired($vendor),
            'dengan tenggang 3 hari, langganan yang habis 5 hari lalu harus kedaluwarsa',
        );
    }

    /**
     * Durasi masa uji dari database harus berlaku di config aplikasi.
     *
     * Menggantikan tes kuota trial: masa uji kini berbasis waktu, jadi yang
     * diatur admin adalah berapa hari akses penuh diberikan.
     */
    public function test_durasi_masa_uji_dari_database_dipakai_config(): void
    {
        $this->putJson('/api/admin/settings', [
            'trialDays' => 45,
        ])->assertOk();

        $this->assertSame(45, config('trial.days'));
    }

    public function test_perubahan_dicatat_di_riwayat_beserta_pelakunya(): void
    {
        $this->putJson('/api/admin/settings', ['graceDays' => 10])->assertOk();

        $history = $this->getJson('/api/admin/settings')->assertOk()->json('history');

        $this->assertNotEmpty($history);
        $this->assertSame('graceDays', $history[0]['field']);
        $this->assertSame('7', $history[0]['oldValue']);
        $this->assertSame('10', $history[0]['newValue']);
        $this->assertSame($this->adminName, $history[0]['actorName']);
    }

    /** Menyimpan nilai yang sama tidak boleh membanjiri riwayat. */
    public function test_menyimpan_nilai_sama_tidak_menambah_riwayat(): void
    {
        $this->putJson('/api/admin/settings', ['graceDays' => 7])
            ->assertOk()
            ->assertJsonPath('changed', []);

        $this->assertSame(0, DB::table('platform_setting_changes')->count());
    }

    public function test_nilai_di_luar_batas_ditolak(): void
    {
        $this->putJson('/api/admin/settings', ['graceDays' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['graceDays']);

        $this->putJson('/api/admin/settings', ['graceDays' => 999])
            ->assertStatus(422);

        $this->putJson('/api/admin/settings', ['trialDays' => -3])
            ->assertStatus(422);

        // Nilai tetap seperti semula setelah penolakan.
        $this->assertSame(7, app(PlatformSettings::class)->get('subscription.grace_days'));
    }

    /** Kunci yang tidak dikenal diabaikan, bukan membuat error 500. */
    public function test_kunci_tidak_dikenal_diabaikan(): void
    {
        $this->putJson('/api/admin/settings', [
            'graceDays' => 9,
            'bukanAturan' => 123,
        ])
            ->assertOk()
            ->assertJsonPath('settings.graceDays', 9);

        $this->assertDatabaseMissing('platform_settings', ['key' => 'bukanAturan']);
    }

    /**
     * Peringatan dampak: jumlah vendor yang sedang dalam masa tenggang
     * dihitung agar admin tahu siapa yang terpengaruh sebelum menyimpan.
     */
    public function test_dampak_menghitung_vendor_yang_sedang_tenggang(): void
    {
        $tenggang = $this->makeVendor();
        $this->makeActiveSubscription($tenggang, Carbon::today()->subDays(2));

        $masihAktif = $this->makeVendor();
        $this->makeActiveSubscription($masihAktif, Carbon::today()->addDays(5));

        $impact = $this->getJson('/api/admin/settings')->assertOk()->json('impact.vendorsInGrace');

        $this->assertSame(1, $impact);
    }

    public function test_vendor_biasa_tidak_boleh_membaca_atau_mengubah(): void
    {
        $vendor = $this->makeVendor();

        $this->actingAs($vendor->user)->getJson('/api/admin/settings')->assertForbidden();
        $this->actingAs($vendor->user)
            ->putJson('/api/admin/settings', ['graceDays' => 20])
            ->assertForbidden();
    }

    public function test_tamu_ditolak(): void
    {
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/admin/settings')->assertUnauthorized();
    }
}
