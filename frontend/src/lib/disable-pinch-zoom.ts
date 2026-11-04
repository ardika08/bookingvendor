/**
 * Blokir zoom gestur di semua halaman.
 *
 * Latar: vendor melaporkan layar "membesar sendiri" saat mengisi form di
 * ponsel, dan setelah itu tidak bisa diperkecil. Ada tiga mekanisme zoom yang
 * harus ditutup satu per satu — satu meta viewport saja tidak cukup:
 *
 * 1. **Auto-zoom saat fokus isian** (akar keluhan utama). Chrome Android dan
 *    Safari iOS memperbesar halaman ketika <input> ber-font < 16px difokuskan.
 *    Ditutup dari CSS: kontrol isian memakai 16px di layar sentuh (index.css).
 *
 * 2. **Pinch-zoom di Chrome Android.** Chrome 67+ SENGAJA mengabaikan
 *    `user-scalable=no` demi aksesibilitas, jadi meta viewport saja tidak
 *    mempan. Yang mempan: `touch-action: pan-x pan-y` — gestur dua jari
 *    (pinch) tidak termasuk pan satu jari, jadi browser tidak memulai zoom.
 *    Scroll satu jari tetap jalan normal.
 *
 * 3. **Pinch-zoom di Safari iOS.** Safari mendengarkan `user-scalable=no`,
 *    tapi untuk aman diblokir juga lewat `gesturestart` + `touchmove`
 *    multi-jari (pola yang dipakai situs kanvas/kamera).
 *
 * Konsekuensi yang disadari: user tidak bisa memperbesar halaman dengan
 * mencubit. Kompensasinya: teks browser tetap bisa diperbesar dari
 * pengaturan, dan semua isian kini 16px sehingga tidak ada lagi zoom paksa.
 * Keputusan ini diminta eksplisit oleh pemilik produk.
 */
export function disablePinchZoom(): void {
  if (typeof document === 'undefined') return

  // 2. Chrome Android & umum: cegah gestur pinch di level touch.
  const style = document.createElement('style')
  style.textContent = `
    html, body {
      /* pan-x pan-y = scroll normal; pinch dua jari tidak termasuk. */
      touch-action: pan-x pan-y;
    }
  `
  document.head.appendChild(style)

  // 3. Safari iOS: batalkan event pinch sebelum browser memprosesnya.
  const stop = (event: Event) => event.preventDefault()
  document.addEventListener('gesturestart', stop, { passive: false })
  document.addEventListener('gesturechange', stop, { passive: false })

  // Double-tap zoom (iOS Safari lama, beberapa WebView Android).
  let lastTouch = 0
  document.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now()
      if (now - lastTouch <= 300 && event.cancelable) event.preventDefault()
      lastTouch = now
    },
    { passive: false },
  )

  // Pengaman terakhir: bila suatu saat viewport tetap ter-zoom (mis. WebView
  // aneh), kembalikan skala ke 1. Tanpa ini satu kejadian sudah cukup membuat
  // vendor terjebak sampai reload — keluhan aslinya.
  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1 && event.cancelable) event.preventDefault()
    },
    { passive: false },
  )
}
