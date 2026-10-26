<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Services\InvoiceStatusResolver;
use Illuminate\Console\Command;

/**
 * Hitung ulang status & akumulasi pembayaran seluruh invoice.
 *
 * Berguna setelah impor data, perbaikan manual di database, atau bila ada
 * pembayaran yang sempat tercatat tanpa memperbarui invoice (mis. crash di
 * tengah transaksi pada versi lama).
 */
class RecalculateInvoiceStatus extends Command
{
    protected $signature = 'invoices:recalculate-status {--dry-run : Tampilkan perubahan tanpa menyimpan}';

    protected $description = 'Sinkronkan paid_amount & status invoice dari riwayat pembayaran';

    public function handle(InvoiceStatusResolver $resolver): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $changed = 0;
        $scanned = 0;

        Invoice::query()
            ->with('payments')
            ->orderBy('id')
            ->chunkById(200, function ($invoices) use ($resolver, $dryRun, &$changed, &$scanned) {
                foreach ($invoices as $invoice) {
                    $scanned++;
                    $paid = round((float) $invoice->payments->sum('amount'), 2);
                    $status = $resolver->derive((float) $invoice->amount, $paid, $invoice->status);

                    $needsFix = $paid !== round((float) $invoice->paid_amount, 2)
                        || $status !== $invoice->status;

                    if (! $needsFix) {
                        continue;
                    }

                    $changed++;

                    if ($dryRun) {
                        $this->line(sprintf(
                            '%s: %s → %s, paid %s → %s',
                            $invoice->invoice_number,
                            $invoice->status,
                            $status,
                            number_format((float) $invoice->paid_amount, 0, ',', '.'),
                            number_format($paid, 0, ',', '.'),
                        ));

                        continue;
                    }

                    $invoice->paid_amount = $paid;
                    $invoice->status = $status;
                    $invoice->save();
                }
            });

        $this->info(sprintf(
            '%d invoice diperiksa, %d %s.',
            $scanned,
            $changed,
            $dryRun ? 'perlu diperbaiki' : 'diperbarui',
        ));

        return self::SUCCESS;
    }
}
