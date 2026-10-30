<?php
/**
 * Pemeriksa & perbaiki format .env untuk phpdotenv.
 *
 * phpdotenv menolak nilai tanpa tanda kutip yang mengandung spasi:
 *   APP_NAME=Booking Vendor      → GAGAL "unexpected whitespace"
 *   APP_NAME="Booking Vendor"    → benar
 *
 * Skrip ini mencari baris KEY=nilai-ada-spasi yang belum dikutip (termasuk
 * yang memakai tanda kutip melengkung dari editor/Word), membungkusnya dengan
 * kutip lurus, lalu memverifikasi hasilnya dengan parser phpdotenv yang sama
 * seperti yang dipakai Laravel.
 *
 * Jalankan dari direktori aplikasi:  php deploy/cpanel/fix-env.php
 */

$path = $argv[1] ?? '.env';

if (! is_file($path)) {
    fwrite(STDERR, "Berkas tidak ditemukan: {$path}\n");
    exit(1);
}

$lines = preg_split("/\r\n|\n|\r/", (string) file_get_contents($path));
$quotes = ['"', "'"];
// Tanda kutip melengkung sering masuk dari editor ponsel atau salin-tempel Word.
$curly = [
    "\u{201C}" => '"', "\u{201D}" => '"',
    "\u{2018}" => "'", "\u{2019}" => "'",
];

$fixed = [];

foreach ($lines as $i => $line) {
    if (! preg_match('/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/', $line, $m)) {
        continue;
    }

    [$whole, $key, $value] = $m;

    if ($value === '') {
        continue;
    }

    // Kutip melengkung: ganti jadi kutip lurus apa pun isinya.
    $hasCurly = false;
    foreach ($curly as $from => $to) {
        if (str_contains($value, $from)) {
            $value = str_replace($from, $to, $value);
            $hasCurly = true;
        }
    }

    $quoted = in_array($value[0], $quotes, true) && in_array(substr($value, -1), $quotes, true);
    $hasSpace = preg_match('/\s/', trim($value)) === 1;

    if ($quoted && ! $hasCurly) {
        continue;
    }

    if (! $hasSpace && ! $hasCurly) {
        continue;
    }

    // Sudah dikutip tapi ada kutip melengkung di dalamnya → rapikan saja.
    $clean = trim($value);
    if ($hasSpace && ! in_array($clean[0], $quotes, true)) {
        $clean = '"'.$clean.'"';
    }

    $lines[$i] = $key.'='.$clean;
    $fixed[] = "  {$key} → {$clean}";
}

if ($fixed === []) {
    echo "Tidak ada baris yang perlu diperbaiki.\n";
} else {
    file_put_contents($path, implode("\n", $lines));
    echo 'Diperbaiki '.count($fixed)." baris:\n".implode("\n", $fixed)."\n";
}

// Verifikasi dengan parser yang sama seperti Laravel.
// Direktori aplikasi bisa diberikan sebagai argumen kedua karena skrip ini
// biasanya dijalankan dari salinan repo (`bookingvendor-src`), sementara
// `vendor/` berada di salinan aplikasi (`bookingvendor`).
$appPath = $argv[2] ?? getcwd();
$autoload = rtrim($appPath, '/').'/vendor/autoload.php';

if (is_file($autoload)) {
    require $autoload;
    try {
        Dotenv\Dotenv::parse((string) file_get_contents($path));
        echo "Format .env: VALID\n";
        exit(0);
    } catch (Throwable $e) {
        echo 'MASIH ADA MASALAH: '.$e->getMessage()."\n";
        exit(1);
    }
}

echo "Format .env: tidak diverifikasi (vendor/ belum ada)\n";
exit(0);
