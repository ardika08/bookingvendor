<?php

/**
 * Titik masuk untuk cPanel shared hosting.
 *
 * Aplikasi Laravel berada di luar `public_html` (di `../bookingvendor`) agar
 * `.env`, `vendor/`, dan `database/` tidak dapat diakses lewat browser.
 * Berkas ini hanya meneruskan permintaan ke `public/index.php` milik Laravel.
 *
 * Cara pakai: salin berkas ini ke `public_html/index.php`, lalu sesuaikan
 * `$appPath` bila nama folder proyek berbeda.
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Path aplikasi: satu tingkat di atas public_html.
$appPath = dirname(__DIR__).'/bookingvendor';

if (file_exists($maintenance = $appPath.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $appPath.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once $appPath.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
