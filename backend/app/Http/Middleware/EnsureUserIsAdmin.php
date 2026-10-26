<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Batasi grup route `/api/admin` hanya untuk pengguna berperan admin.
 *
 * Dipasang SETELAH `auth:sanctum`, jadi `$request->user()` dijamin ada. Kalau
 * urutannya terbalik, middleware ini akan menerima null dan setiap request
 * admin berakhir 401 padahal seharusnya 403 — karena itu keduanya selalu
 * dipasang berpasangan di routes/api.php.
 */
class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || ! $user->isAdmin()) {
            return response()->json([
                'message' => 'Halaman ini hanya untuk admin platform.',
                'code' => 'admin_only',
            ], 403);
        }

        return $next($request);
    }
}
