import { useEffect, useState, type ReactNode } from 'react'
import { logoUrlFromPath } from '@/lib/api/vendor-logo'

/**
 * Logo usaha vendor yang aman dipakai di mana pun.
 *
 * Dua hal yang ditangani di sini, keduanya pernah jadi masalah nyata:
 *
 * 1. Path dari API masih relatif (`vendor-logos/abc.png`), bukan URL. URL
 *    disusun lewat `logoUrlFromPath()` supaya benar walau origin API berbeda
 *    dari domain frontend.
 * 2. Berkas bisa gagal dimuat — mis. symlink `public/storage` belum dibuat di
 *    server. Tanpa penanganan, browser menampilkan ikon gambar rusak, dan itu
 *    terlihat oleh KLIEN di halaman invoice publik. Di sini kegagalan muat
 *    dikembalikan ke `fallback` (ikon gedung atau inisial), jadi yang tampil
 *    tetap rapi walau berkasnya hilang.
 */
export function VendorLogo({
  path,
  fallback,
  className,
  alt = '',
}: {
  /** Path relatif dari API; `null` langsung memakai `fallback`. */
  path: string | null
  /** Tampilan pengganti bila logo belum ada atau gagal dimuat. */
  fallback: ReactNode
  className?: string
  alt?: string
}) {
  const url = logoUrlFromPath(path)
  const [broken, setBroken] = useState(false)

  // Path berubah (unggah/ganti/hapus) → kesempatan baru untuk memuat gambar.
  // Tanpa reset ini, logo yang sempat gagal akan tetap dianggap rusak walau
  // berkasnya sudah diperbaiki.
  useEffect(() => setBroken(false), [url])

  if (!url || broken) return <>{fallback}</>

  return <img src={url} alt={alt} className={className} onError={() => setBroken(true)} />
}
