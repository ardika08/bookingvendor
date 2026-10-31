@php
    /*
     * Email selamat datang. Gaya ditulis inline karena klien email tidak
     * mendukung stylesheet eksternal. Palet mengikuti aplikasi: gold #e7c874
     * dengan teks gelap, aksen gelap untuk judul.
     */
    $endsAt = $trialEndsAt !== null
        ? \Illuminate\Support\Carbon::parse($trialEndsAt)->translatedFormat('j F Y')
        : null;
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Selamat datang</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e8ec;">

                    <tr>
                        <td style="padding:28px 28px 0 28px;">
                            <span style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;border-radius:10px;background:#e7c874;color:#1a1e24;font-weight:700;font-size:15px;">BV</span>
                            <p style="margin:18px 0 0 0;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#8a9099;font-weight:600;">Pendaftaran berhasil</p>
                            <h1 style="margin:6px 0 0 0;font-size:22px;line-height:1.3;color:#1a1e24;font-weight:700;">Selamat datang, {{ $vendorName }}</h1>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:16px 28px 0 28px;">
                            <p style="margin:0;font-size:14px;line-height:1.6;color:#4a5058;">
                                Akun vendor kamu sudah aktif. Semua fitur terbuka selama
                                <strong style="color:#1a1e24;">{{ $trialDays }} hari</strong> ke depan{{ $endsAt !== null ? ', sampai '.$endsAt : '' }}. Tanpa kartu kredit, tanpa biaya di awal.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:18px 28px 0 28px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf6e7;border:1px solid #f0e2bc;border-radius:12px;">
                                <tr>
                                    <td style="padding:14px 16px;">
                                        <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#1a1e24;">Yang bisa kamu pakai sekarang</p>
                                        <p style="margin:0;font-size:13px;line-height:1.7;color:#4a5058;">
                                            &bull; Booking &amp; kalender acara tanpa batas<br>
                                            &bull; Invoice klien dengan link pembayaran<br>
                                            &bull; Catat DP dan pelunasan per termin<br>
                                            &bull; Link jadwal publik untuk dibagikan
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:20px 28px 0 28px;">
                            <p style="margin:0;font-size:13px;line-height:1.6;color:#4a5058;">
                                Langkah pertama: lengkapi <strong style="color:#1a1e24;">rekening bank</strong> di
                                pengaturan. Rekening ini tercetak di invoice supaya klien tahu ke mana
                                harus transfer.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:22px 28px 0 28px;">
                            <a href="{{ $dashboardUrl }}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#e7c874;color:#1a1e24;font-size:14px;font-weight:600;text-decoration:none;">
                                Buka dashboard
                            </a>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:24px 28px 0 28px;">
                            <hr style="border:none;border-top:1px solid #eceef1;margin:0;">
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:16px 28px 28px 28px;">
                            <p style="margin:0;font-size:12px;line-height:1.6;color:#8a9099;">
                                Email ini dikirim ke {{ $ownerEmail }} karena kamu mendaftar di Booking Vendor.
                                Ada pertanyaan? Balas email ini atau hubungi kami lewat grup support di dashboard.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
