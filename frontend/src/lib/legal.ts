import { COMPANY } from '@/lib/company'

/**
 * Isi Syarat & Ketentuan dan Kebijakan Privasi.
 *
 * DISUSUN DARI INVENTARIS NYATA APLIKASI, bukan template generik. Setiap
 * pernyataan di sini harus bisa dibuktikan di kode:
 *
 * - Data yang dikumpulkan  → kolom tabel `users`, `vendors`, `clients`,
 *   `bookings`, `invoices`, `payments`
 * - Kata sandi ter-hash     → `bcrypt()` di RegisterController, cast `hashed`
 * - Pihak ketiga            → Duitku (pembayaran), Mailketing (email)
 * - Tanpa analytics          → tidak ada gtag/pixel/hotjar di frontend
 * - Halaman publik          → /jadwal/:slug dan /invoice/:token, tanpa akun
 * - Hapus vendor = nonaktif → AdminVendorController memakai `is_active`
 *
 * Kalau salah satu berubah di kode, berkas ini WAJIB ikut diperbarui —
 * dokumen legal yang tidak cocok dengan kenyataan lebih berbahaya daripada
 * tidak ada dokumen sama sekali, terutama untuk verifikasi payment gateway.
 */

export const LEGAL_UPDATED_AT = '31 Oktober 2026'

export interface LegalSection {
  heading: string
  /** Paragraf biasa. */
  paragraphs?: string[]
  /** Daftar berbutir, bila bagian ini lebih enak dibaca sebagai poin. */
  bullets?: string[]
}

export interface LegalDocument {
  slug: string
  title: string
  /** Ringkasan satu paragraf di atas dokumen. */
  intro: string
  sections: LegalSection[]
}

const CONTACT_LINE = `Pertanyaan tentang dokumen ini dapat dikirim ke ${COMPANY.email} atau WhatsApp ${COMPANY.phoneDisplay}.`

export const TERMS: LegalDocument = {
  slug: 'syarat-ketentuan',
  title: 'Syarat & Ketentuan',
  intro: `Dokumen ini mengatur penggunaan ${COMPANY.brand}, layanan pencatatan booking, jadwal, dan invoice untuk vendor pernikahan yang dioperasikan oleh ${COMPANY.legalName}. Dengan mendaftar atau memakai layanan, kamu dianggap telah membaca dan menyetujui ketentuan di bawah ini.`,
  sections: [
    {
      heading: '1. Definisi',
      bullets: [
        `"Layanan" adalah ${COMPANY.brand}, aplikasi berbasis web untuk mengelola booking, jadwal acara, klien, dan invoice.`,
        '"Vendor" adalah usaha jasa pernikahan yang mendaftar dan memakai Layanan.',
        '"Klien" adalah pelanggan Vendor yang datanya dicatat di Layanan. Klien tidak membuat akun.',
        `"Kami" adalah ${COMPANY.legalName} sebagai pengelola Layanan.`,
      ],
    },
    {
      heading: '2. Akun dan pendaftaran',
      paragraphs: [
        'Pendaftaran dilakukan sendiri melalui halaman pendaftaran dengan mengisi nama, nama usaha, kategori, nomor telepon, email, dan kata sandi. Akun langsung aktif setelah pendaftaran berhasil, tanpa menunggu persetujuan.',
      ],
      bullets: [
        'Kamu wajib memberikan data yang benar dan terkini.',
        'Satu akun mewakili satu usaha. Kamu bertanggung jawab menjaga kerahasiaan email dan kata sandi.',
        'Kami tidak pernah meminta kata sandi melalui email, telepon, atau pesan apa pun.',
        'Kami dapat menonaktifkan akun yang terbukti dipakai untuk penipuan, penyalahgunaan, atau pelanggaran ketentuan ini.',
      ],
    },
    {
      heading: '3. Masa uji dan langganan',
      bullets: [
        `Vendor baru mendapat masa uji 30 hari dengan seluruh fitur terbuka, tanpa batas jumlah booking maupun invoice, dan tanpa kartu kredit.`,
        'Setelah masa uji berakhir, pembuatan booking dan invoice baru dihentikan sampai kamu berlangganan. Data lama tetap bisa dibuka dan diunduh.',
        'Langganan dibeli sebagai paket prabayar untuk jangka waktu tertentu (1, 3, atau 12 bulan) dan tidak diperpanjang otomatis.',
        'Harga yang berlaku adalah harga yang tampil di halaman Harga pada saat pembelian.',
      ],
    },
    {
      heading: '4. Pembayaran langganan',
      paragraphs: [
        'Pembayaran langganan Vendor ke Kami diproses melalui penyedia pembayaran pihak ketiga, yaitu Duitku. Kami tidak menyimpan data kartu, nomor rekening, atau kredensial pembayaran apa pun.',
      ],
      bullets: [
        'Langganan aktif otomatis setelah pembayaran terverifikasi oleh penyedia pembayaran.',
        'Bila status belum berubah setelah pembayaran, tersedia tombol "Cek status pembayaran" pada halaman checkout untuk memeriksa ulang secara langsung.',
        'Biaya layanan atau biaya transaksi dari penyedia pembayaran, bila ada, ditanggung sesuai ketentuan penyedia tersebut.',
      ],
    },
    {
      heading: '5. Pembayaran klien ke Vendor',
      paragraphs: [
        'Layanan ini mencatat pembayaran yang diterima Vendor dari Klien. Layanan TIDAK memproses, menahan, atau meneruskan uang dari Klien ke Vendor.',
      ],
      bullets: [
        'Transfer dari Klien dilakukan langsung ke rekening bank Vendor yang tercantum di invoice.',
        'Vendor bertanggung jawab penuh atas kebenaran nomor rekening yang dicantumkan.',
        'Pencatatan pembayaran di Layanan bersifat administratif dan bukan bukti transfer yang sah di mata hukum.',
        'Sengketa pembayaran antara Vendor dan Klien diselesaikan oleh kedua pihak di luar Layanan.',
      ],
    },
    {
      heading: '6. Tautan publik',
      paragraphs: [
        'Layanan dapat membuat tautan publik yang bisa dibuka tanpa login, yaitu tautan jadwal ketersediaan vendor dan tautan invoice untuk klien.',
      ],
      bullets: [
        'Tautan jadwal hanya menampilkan tanggal yang sudah terisi, tanpa nama, kontak, atau detail acara klien.',
        'Tautan invoice menampilkan nama klien, tanggal acara, dan nominal tagihan kepada siapa pun yang memiliki tautan tersebut.',
        'Vendor dapat menonaktifkan tautan kapan saja dari dalam aplikasi.',
        'Siapa pun yang memiliki tautan dapat membukanya, jadi Vendor bertanggung jawab membagikannya hanya kepada pihak yang berhak.',
      ],
    },
    {
      heading: '7. Kewajiban Vendor',
      bullets: [
        'Memastikan data Klien dicatat atas dasar kewenangan yang sah, misalnya karena Klien memang memesan jasa Vendor.',
        'Menjaga kerahasiaan data Klien dan tidak membagikannya kepada pihak yang tidak berkepentingan.',
        'Tidak memakai Layanan untuk menyimpan data yang tidak berkaitan dengan kegiatan usaha.',
        'Mematuhi peraturan perundang-undangan yang berlaku, termasuk ketentuan perlindungan data pribadi.',
      ],
    },
    {
      heading: '8. Ketersediaan layanan',
      paragraphs: [
        'Kami berupaya menjaga Layanan tetap tersedia, tetapi tidak menjamin akses tanpa gangguan. Pemeliharaan, gangguan jaringan, atau kegagalan penyedia hosting dapat menyebabkan Layanan tidak dapat diakses sementara.',
        'Kami tidak bertanggung jawab atas kerugian tidak langsung, termasuk kehilangan keuntungan atau kehilangan data akibat gangguan tersebut. Kami menyarankan Vendor menyimpan salinan data penting secara mandiri.',
      ],
    },
    {
      heading: '9. Penghentian penggunaan',
      bullets: [
        'Kamu dapat berhenti memakai Layanan kapan saja. Penonaktifan akun dilakukan oleh Kami atas permintaanmu.',
        'Penonaktifan akun tidak menghapus data secara otomatis; data tetap tersimpan agar bisa diaktifkan kembali atau diunduh.',
        'Permintaan penghapusan data permanen dapat dikirim ke alamat kontak di bawah dan akan diproses sesuai Kebijakan Privasi.',
      ],
    },
    {
      heading: '10. Perubahan ketentuan',
      paragraphs: [
        'Kami dapat memperbarui dokumen ini bila ada perubahan fitur, ketentuan pembayaran, atau peraturan yang berlaku. Tanggal pembaruan tercantum di bagian atas halaman. Perubahan penting akan diberitahukan melalui email terdaftar atau pemberitahuan di dalam aplikasi.',
      ],
    },
    {
      heading: '11. Hukum yang berlaku',
      paragraphs: [
        'Dokumen ini tunduk pada hukum Republik Indonesia. Perselisihan diupayakan diselesaikan secara musyawarah terlebih dahulu.',
      ],
    },
    {
      heading: '12. Kontak',
      paragraphs: [
        CONTACT_LINE,
        `Alamat: ${COMPANY.address.street}, ${COMPANY.address.village}, ${COMPANY.address.city}.`,
      ],
    },
  ],
}

export const PRIVACY: LegalDocument = {
  slug: 'kebijakan-privasi',
  title: 'Kebijakan Privasi',
  intro: `Kebijakan ini menjelaskan data pribadi apa yang dikumpulkan ${COMPANY.brand}, untuk apa data itu dipakai, siapa yang dapat mengaksesnya, dan bagaimana kamu dapat mengendalikannya. Kami hanya mengumpulkan data yang benar-benar diperlukan untuk menjalankan Layanan.`,
  sections: [
    {
      heading: '1. Data yang kami kumpulkan',
      paragraphs: ['Data berikut diisi langsung oleh Vendor saat mendaftar dan memakai Layanan.'],
      bullets: [
        'Data akun: nama, email, nomor HP, dan kata sandi. Kata sandi disimpan dalam bentuk ter-hash (bcrypt) dan tidak dapat dibaca oleh Kami.',
        'Data usaha: nama usaha, kategori, kota, deskripsi singkat, nomor WhatsApp, dan email kontak.',
        'Data rekening: nama bank, nomor rekening, dan nama pemilik rekening. Data ini dicetak di invoice agar Klien tahu ke mana harus mentransfer.',
        'Data Klien: nama, nomor telepon, email (opsional), alamat (opsional), dan catatan (opsional).',
        'Data acara: tanggal, jam, lokasi, detail acara, paket, dan nilai kontrak.',
        'Data tagihan: nomor invoice, jenis (DP atau pelunasan), nominal, jumlah terbayar, jatuh tempo, dan catatan.',
        'Data pembayaran yang dicatat Vendor: nominal, metode, nomor referensi, tanggal bayar, dan catatan.',
      ],
    },
    {
      heading: '2. Data teknis',
      bullets: [
        'Cookie sesi untuk menjaga kamu tetap masuk setelah login. Cookie ini diperlukan agar Layanan berfungsi dan tidak dipakai untuk periklanan.',
        'Catatan teknis (log) berisi waktu akses dan pesan kesalahan, dipakai untuk menelusuri gangguan.',
        'Kami TIDAK memakai alat analitik, pelacak iklan, atau pixel pihak ketiga apa pun di Layanan.',
      ],
    },
    {
      heading: '3. Tujuan penggunaan data',
      bullets: [
        'Menjalankan fungsi utama: menyimpan booking, menampilkan kalender, menerbitkan invoice, dan mencatat pembayaran.',
        'Mengirim email terkait akun dan langganan, seperti email selamat datang dan tanda terima pembayaran.',
        'Memproses pembayaran langganan melalui penyedia pembayaran.',
        'Menjawab pertanyaan dan menangani masalah yang kamu laporkan.',
        'Memenuhi kewajiban hukum yang berlaku.',
      ],
    },
    {
      heading: '4. Pihak ketiga yang menerima data',
      paragraphs: ['Kami tidak menjual atau menyewakan data pribadi kepada siapa pun. Data hanya dibagikan kepada pihak yang diperlukan untuk menjalankan Layanan.'],
      bullets: [
        'Duitku (penyedia pembayaran) — menerima nama, email, nomor telepon, dan nominal saat kamu membeli langganan. Data ini diperlukan untuk memproses pembayaran.',
        'Mailketing (penyedia pengiriman email) — menerima alamat email dan isi pesan untuk mengirim notifikasi terkait akun.',
        'Penyedia hosting dan server — menyimpan basis data Layanan atas nama Kami.',
      ],
    },
    {
      heading: '5. Data Klien dan peran Vendor',
      paragraphs: [
        'Data Klien dimasukkan oleh Vendor, bukan oleh Kami. Dalam hal ini Vendor bertindak sebagai pihak yang menentukan data apa yang dicatat dan untuk tujuan apa, sedangkan Kami menyediakan sarana penyimpanannya.',
      ],
      bullets: [
        'Vendor wajib memastikan data Klien dicatat atas dasar kewenangan yang sah.',
        'Vendor bertanggung jawab memenuhi permintaan Klien terkait datanya, misalnya permintaan salinan atau penghapusan.',
        'Kami hanya memproses data Klien sesuai instruksi Vendor dan tidak memakainya untuk tujuan lain.',
      ],
    },
    {
      heading: '6. Tautan publik dan siapa yang dapat melihat',
      bullets: [
        'Tautan jadwal publik hanya menampilkan tanggal yang sudah terisi. Nama, kontak, dan detail acara Klien tidak ditampilkan.',
        'Tautan invoice publik menampilkan nama Klien, tanggal acara, nama paket, lokasi acara, dan nominal tagihan kepada siapa pun yang memegang tautan tersebut.',
        'Kedua tautan dapat dinonaktifkan Vendor kapan saja. Setelah dinonaktifkan, tautan tidak dapat dibuka lagi.',
      ],
    },
    {
      heading: '7. Penyimpanan dan pengamanan',
      bullets: [
        'Kata sandi disimpan ter-hash dengan bcrypt dan tidak pernah ditampilkan kembali.',
        'Koneksi ke Layanan memakai HTTPS sehingga data terenkripsi saat dikirim.',
        'Akses ke basis data dibatasi pada sistem Layanan; setiap Vendor hanya dapat melihat datanya sendiri.',
        'Meskipun demikian, tidak ada sistem yang sepenuhnya bebas risiko. Kami menyarankan pemakaian kata sandi yang kuat dan unik.',
      ],
    },
    {
      heading: '8. Lama penyimpanan',
      paragraphs: [
        'Data disimpan selama akun masih aktif. Bila akun dinonaktifkan, data tetap tersimpan agar dapat diaktifkan kembali atau diunduh oleh Vendor. Penghapusan permanen dilakukan atas permintaan Vendor melalui alamat kontak di bawah.',
      ],
    },
    {
      heading: '9. Hak kamu',
      bullets: [
        'Melihat dan memperbarui data akun serta data usaha langsung dari halaman pengaturan.',
        'Meminta salinan data yang tersimpan.',
        'Meminta perbaikan data yang tidak akurat.',
        'Meminta penghapusan data secara permanen.',
        'Menarik persetujuan dan berhenti memakai Layanan.',
      ],
    },
    {
      heading: '10. Anak di bawah umur',
      paragraphs: [
        'Layanan ditujukan untuk pelaku usaha dan tidak dirancang untuk dipakai oleh anak di bawah 18 tahun. Kami tidak dengan sengaja mengumpulkan data anak di bawah umur.',
      ],
    },
    {
      heading: '11. Perubahan kebijakan',
      paragraphs: [
        'Kebijakan ini dapat diperbarui bila ada perubahan fitur atau kewajiban hukum. Tanggal pembaruan tercantum di bagian atas halaman. Perubahan penting akan diberitahukan melalui email terdaftar.',
      ],
    },
    {
      heading: '12. Kontak',
      paragraphs: [
        CONTACT_LINE,
        `Alamat: ${COMPANY.address.street}, ${COMPANY.address.village}, ${COMPANY.address.city}.`,
      ],
    },
  ],
}

export const LEGAL_DOCUMENTS: LegalDocument[] = [TERMS, PRIVACY]
