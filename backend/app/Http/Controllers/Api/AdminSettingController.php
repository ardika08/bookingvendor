<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PlatformSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Pengaturan platform untuk panel admin.
 *
 * Yang diatur di sini adalah ATURAN yang berlaku untuk semua vendor — masa
 * tenggang langganan dan kuota masa trial. Profil pribadi admin ada di
 * `/api/profile`, bukan di sini.
 *
 * Setiap perubahan dicatat di riwayat beserta admin yang melakukannya, karena
 * nilainya berdampak ke seluruh vendor sekaligus.
 *
 * NAMA FIELD DI API TIDAK MEMAKAI TITIK
 * Kunci internal (`subscription.grace_days`) adalah nama config Laravel, dan
 * titik di dalamnya bermakna "notasi bersarang" — baik bagi validator maupun
 * bagi pembaca JSON di frontend. Karena itu API memakai nama datar
 * (`graceDays`) dan pemetaannya dilakukan di sini.
 */
class AdminSettingController extends Controller
{
    /**
     * Nama field API → kunci internal.
     *
     * @var array<string, string>
     */
    private const FIELD_TO_KEY = [
        'graceDays' => 'subscription.grace_days',
        'trialDays' => 'trial.days',
    ];

    public function __construct(private readonly PlatformSettings $settings) {}

    /**
     * GET /api/admin/settings
     *
     * Menyertakan `impact` — jumlah vendor yang sedang dalam masa tenggang —
     * supaya UI bisa memperingatkan sebelum admin memperpendek tenggang dan
     * tanpa sengaja memutus akses mereka.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'settings' => $this->fields(),
            'rules' => $this->ruleBounds(),
            'impact' => [
                'vendorsInGrace' => $this->settings->vendorsInGrace(),
            ],
            'history' => $this->history(),
        ]);
    }

    /**
     * PUT /api/admin/settings
     *
     * Hanya field yang dikirim yang diubah; field lain dibiarkan. Nilai yang
     * sama dengan sebelumnya tidak menghasilkan entri riwayat.
     */
    public function update(Request $request): JsonResponse
    {
        $rules = [];
        foreach (self::FIELD_TO_KEY as $field => $key) {
            $rule = PlatformSettings::RULES[$key];
            $rules[$field] = ['sometimes', 'integer', 'min:'.$rule['min'], 'max:'.$rule['max']];
        }

        $validated = $request->validate($rules);

        // Terjemahkan nama field API kembali ke kunci internal.
        $changes = [];
        foreach ($validated as $field => $value) {
            $changes[self::FIELD_TO_KEY[$field]] = (int) $value;
        }

        $changedKeys = $this->settings->update($changes, $request->user());

        // Laporkan kunci yang berubah dalam nama field API, bukan nama internal.
        $changedFields = array_keys(array_filter(
            self::FIELD_TO_KEY,
            fn (string $key) => in_array($key, $changedKeys, true),
        ));

        return response()->json([
            'settings' => $this->fields(),
            // `rules` wajib ikut di sini juga: frontend memakai batas min/max
            // dari respons untuk merender input. Bila hanya ada di GET,
            // halaman kehilangan batasnya begitu admin menyimpan.
            'rules' => $this->ruleBounds(),
            'changed' => array_values($changedFields),
            'history' => $this->history(),
            'impact' => [
                'vendorsInGrace' => $this->settings->vendorsInGrace(),
            ],
        ]);
    }

    /**
     * Nilai aturan dalam nama field API.
     *
     * @return array<string, int>
     */
    private function fields(): array
    {
        $all = $this->settings->all();

        $fields = [];
        foreach (self::FIELD_TO_KEY as $field => $key) {
            $fields[$field] = $all[$key];
        }

        return $fields;
    }

    /**
     * Batas nilai yang diterima, dikirim ke UI agar input bisa memakai
     * `min`/`max` yang sama dengan validasi server — bukan angka duplikat
     * yang cepat atau lambat akan berbeda.
     *
     * @return array<string, array{min: int, max: int, default: int}>
     */
    private function ruleBounds(): array
    {
        $bounds = [];
        foreach (self::FIELD_TO_KEY as $field => $key) {
            $rule = PlatformSettings::RULES[$key];
            $bounds[$field] = [
                'min' => $rule['min'],
                'max' => $rule['max'],
                'default' => $rule['default'],
            ];
        }

        return $bounds;
    }

    /**
     * Riwayat perubahan dengan nama field API, sehingga frontend tidak perlu
     * tahu nama config internal.
     *
     * @return list<array<string, mixed>>
     */
    private function history(): array
    {
        $keyToField = array_flip(self::FIELD_TO_KEY);

        return array_map(function (array $row) use ($keyToField) {
            $row['field'] = $keyToField[$row['key']] ?? $row['key'];
            unset($row['key']);

            return $row;
        }, $this->settings->history());
    }
}
