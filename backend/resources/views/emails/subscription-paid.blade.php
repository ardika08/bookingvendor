@php
    $rupiah = 'Rp '.number_format($amount, 0, ',', '.');
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Pembayaran diterima</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e8ec;">

                    <tr>
                        <td style="padding:28px 28px 0 28px;">
                            <span style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;border-radius:10px;background:#e7c874;color:#1a1e24;font-weight:700;font-size:15px;">BV</span>
                            <p style="margin:18px 0 0 0;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#1d7a54;font-weight:600;">Pembayaran diterima</p>
                            <h1 style="margin:6px 0 0 0;font-size:22px;line-height:1.3;color:#1a1e24;font-weight:700;">Langganan kamu sudah aktif</h1>
                            <p style="margin:6px 0 0 0;font-size:14px;line-height:1.6;color:#4a5058;">
                                Terima kasih, {{ $vendorName }}. Pembayaran sudah kami terima dan masa aktif
                                paket bertambah otomatis.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:20px 28px 0 28px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e8ec;border-radius:12px;">
                                <tr>
                                    <td style="padding:14px 16px 10px 16px;">
                                        <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#8a9099;font-weight:600;">Rincian pembayaran</p>

                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#4a5058;">
                                            <tr>
                                                <td style="padding:5px 0;">Paket</td>
                                                <td align="right" style="padding:5px 0;color:#1a1e24;font-weight:600;">{{ $planName }}</td>
                                            </tr>
                                            @if ($durationMonths !== null)
                                            <tr>
                                                <td style="padding:5px 0;">Durasi</td>
                                                <td align="right" style="padding:5px 0;color:#1a1e24;">{{ $durationMonths }} bulan</td>
                                            </tr>
                                            @endif
                                            @if ($paidAt !== null)
                                            <tr>
                                                <td style="padding:5px 0;">Tanggal bayar</td>
                                                <td align="right" style="padding:5px 0;color:#1a1e24;">{{ $paidAt }}</td>
                                            </tr>
                                            @endif
                                            <tr>
                                                <td style="padding:5px 0;">No. referensi</td>
                                                <td align="right" style="padding:5px 0;color:#1a1e24;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;">{{ $reference }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding:10px 0 0 0;border-top:1px solid #eceef1;font-weight:600;color:#1a1e24;">Total dibayar</td>
                                                <td align="right" style="padding:10px 0 0 0;border-top:1px solid #eceef1;font-weight:700;color:#1a1e24;font-size:15px;">{{ $rupiah }}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    @if ($activeUntil !== null)
                    <tr>
                        <td style="padding:16px 28px 0 28px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef7f2;border:1px solid #cfe8dc;border-radius:12px;">
                                <tr>
                                    <td style="padding:12px 16px;">
                                        <p style="margin:0;font-size:13px;line-height:1.6;color:#1d5c43;">
                                            Masa aktif paket berlangsung sampai
                                            <strong>{{ $activeUntil }}</strong>.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    @endif

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
                                Simpan email ini sebagai bukti pembayaran. Butuh invoice atas nama usaha?
                                Balas email ini dan sertakan nama serta alamat usaha kamu.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
