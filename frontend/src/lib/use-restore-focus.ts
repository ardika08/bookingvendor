import { useCallback, useEffect, useRef } from 'react'

/**
 * Mengembalikan fokus ke elemen pemicu saat dialog ditutup.
 *
 * Kenapa perlu: saat dialog dibuka, fokus berpindah ke dalam dialog. Ketika
 * dialog hilang dari DOM, browser memindahkan fokus ke `<body>` — bukan
 * kembali ke tombol yang tadi ditekan. Pengguna keyboard lalu harus menekan
 * Tab dari awal halaman, dan pengguna pembaca layar kehilangan konteks
 * (WCAG 2.4.3, Urutan Fokus).
 *
 * Kenapa pemicu dicatat saat klik, bukan saat efek berjalan: efek komponen
 * anak berjalan lebih dulu daripada efek induk, jadi saat efek induk jalan
 * fokus sudah dipindahkan ke tombol di dalam dialog (mis. "Batal") oleh
 * `data-autofocus`. Satu-satunya saat fokus masih berada di tombol pemicu
 * adalah ketika handler klik dijalankan.
 *
 * Pemulihan dipicu oleh `open` yang berubah menjadi `false`, bukan oleh
 * cleanup efek: cleanup efek di komponen induk hanya berjalan saat halaman
 * ditinggalkan, sedangkan dialog bisa dibuka-tutup berkali-kali.
 *
 * Cara pakai:
 *
 * ```tsx
 * const captureFocus = useRestoreFocus(confirming)
 * <Button onClick={captureFocus(() => setConfirming(true))}>Simpan</Button>
 * ```
 */
export function useRestoreFocus(open: boolean) {
  const triggerRef = useRef<HTMLElement | null>(null)

  const captureFocus = useCallback(
    (action: () => void) =>
      () => {
        const active = document.activeElement
        triggerRef.current = active instanceof HTMLElement ? active : null
        action()
      },
    [],
  )

  useEffect(() => {
    if (open) return

    const trigger = triggerRef.current
    triggerRef.current = null

    // Pemicu bisa sudah tidak ada (baris dihapus, halaman berganti);
    // `isConnected` mencegah fokus dilempar ke elemen yatim.
    if (trigger !== null && trigger.isConnected) trigger.focus()
  }, [open])

  return captureFocus
}
