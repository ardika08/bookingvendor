import type { AdminReport } from '@/lib/api/admin-reports'
import { formatCurrency, formatLongDate } from '@/lib/format'

/**
 * Dokumen laporan untuk dicetak / disimpan sebagai PDF.
 *
 * Hanya elemen ini yang terlihat saat mencetak (lihat `@media print` di
 * `index.css`), jadi isinya harus lengkap sendiri: judul, periode, ringkasan,
 * rincian bulanan, paket, dan daftar vendor yang perlu ditindak. Tanpa ini,
 * hasil cetak hanya menampilkan potongan halaman yang sedang aktif.
 *
 * Tabel, bukan kartu: kertas tidak punya tab dan tidak bisa di-scroll.
 */
export function ReportPrintDocument({ report }: { report: AdminReport }) {
  const { revenue, vendors, expiring, year } = report
  const printedAt = formatLongDate(new Date().toISOString().slice(0, 10))

  return (
    <article className="report-print-document">
      <header className="report-print-header">
        <div>
          <h1 className="report-print-title">Laporan Tahunan Platform</h1>
          <p className="report-print-subtitle">VendorKit — tahun {year}</p>
        </div>
        <div className="report-print-meta">
          <p>Dicetak {printedAt}</p>
        </div>
      </header>

      <section className="report-print-section">
        <h2>Ringkasan</h2>
        <table className="report-print-table">
          <tbody>
            <tr>
              <th scope="row">Total pendapatan langganan</th>
              <td>{formatCurrency(revenue.total)}</td>
            </tr>
            <tr>
              <th scope="row">Transaksi lunas</th>
              <td>{revenue.paidCount}</td>
            </tr>
            <tr>
              <th scope="row">Rata-rata per transaksi</th>
              <td>{formatCurrency(revenue.averagePerTransaction)}</td>
            </tr>
            <tr>
              <th scope="row">Vendor terdaftar (semua tahun)</th>
              <td>
                {vendors.total} — {vendors.active} aktif, {vendors.inactive} nonaktif
              </td>
            </tr>
            <tr>
              <th scope="row">Vendor baru tahun {year}</th>
              <td>{vendors.newThisYear}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="report-print-section">
        <h2>Pendapatan per bulan</h2>
        <table className="report-print-table report-print-table--grid">
          <thead>
            <tr>
              <th scope="col">Bulan</th>
              <th scope="col" className="report-print-number">
                Transaksi
              </th>
              <th scope="col" className="report-print-number">
                Pendapatan
              </th>
            </tr>
          </thead>
          <tbody>
            {revenue.monthly.map((month) => (
              <tr key={month.month}>
                <td>{month.label}</td>
                <td className="report-print-number">{month.count}</td>
                <td className="report-print-number">{formatCurrency(month.revenue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="report-print-number">{revenue.paidCount}</td>
              <td className="report-print-number">{formatCurrency(revenue.total)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {revenue.byPlan.length > 0 ? (
        <section className="report-print-section">
          <h2>Pendapatan per paket</h2>
          <table className="report-print-table report-print-table--grid">
            <thead>
              <tr>
                <th scope="col">Paket</th>
                <th scope="col" className="report-print-number">
                  Transaksi
                </th>
                <th scope="col" className="report-print-number">
                  Pendapatan
                </th>
              </tr>
            </thead>
            <tbody>
              {revenue.byPlan.map((plan) => (
                <tr key={plan.planName}>
                  <td>{plan.planName}</td>
                  <td className="report-print-number">{plan.count}</td>
                  <td className="report-print-number">{formatCurrency(plan.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="report-print-section">
        <h2>Langganan berakhir dalam 7 hari</h2>
        {expiring.length === 0 ? (
          <p>Tidak ada langganan yang berakhir dalam 7 hari ke depan.</p>
        ) : (
          <table className="report-print-table report-print-table--grid">
            <thead>
              <tr>
                <th scope="col">Vendor</th>
                <th scope="col">Paket</th>
                <th scope="col">Berakhir</th>
                <th scope="col" className="report-print-number">
                  Sisa hari
                </th>
              </tr>
            </thead>
            <tbody>
              {expiring.map((vendor) => (
                <tr key={vendor.subscriptionId}>
                  <td>{vendor.vendorName}</td>
                  <td>{vendor.planName}</td>
                  <td>{formatLongDate(vendor.endsAt)}</td>
                  <td className="report-print-number">{vendor.daysLeft}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="report-print-footer">
        <p>
          Laporan ini hanya memuat pendapatan langganan platform dan data akun vendor. Data
          operasional vendor (booking, klien, invoice) tidak termasuk.
        </p>
      </footer>
    </article>
  )
}
