import { CalendarPlus, FileText, LogIn, type IconComponent } from '@/components/ui/icons'

/**
 * Visualisasi alur kerja tiga langkah di halaman promosi.
 *
 * Menjelaskan perjalanan vendor dari masuk sampai menagih klien, sesuai alur
 * Alur: daftar & masuk → catat booking/jadwal → terbitkan invoice dan
 * bagikan tautannya. Garis penghubung hanya tampil di layar lebar.
 */

interface WorkflowStep {
  step: string
  icon: IconComponent
  title: string
  description: string
}

const STEPS: WorkflowStep[] = [
  {
    step: '01',
    icon: LogIn,
    title: 'Daftar & masuk',
    description:
      'Daftar gratis dengan email dan kata sandi, akun langsung aktif. Langsung bisa dipakai tanpa menunggu persetujuan.',
  },
  {
    step: '02',
    icon: CalendarPlus,
    title: 'Catat booking & atur jadwal',
    description:
      'Pilih tanggal, data klien, dan paket. Tanggal terpakai langsung tertandai agar tidak bentrok.',
  },
  {
    step: '03',
    icon: FileText,
    title: 'Terbitkan invoice, bagikan link',
    description:
      'DP atau pelunasan dibuat dari data booking. Kirim tautan ke klien dan catat pembayarannya.',
  },
]

export function WorkflowSteps() {
  return (
    <section className="border-t border-ink-200/70 bg-ink-50/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-caption font-semibold uppercase tracking-wider text-brand-700">
            Cara kerja
          </p>
          <h2 className="mt-2 text-heading tracking-tight text-ink-900 sm:text-display">
            Tiga langkah, dari pesanan sampai tagihan
          </h2>
          <p className="mt-3 text-body leading-relaxed text-ink-500">
            Tidak perlu berpindah aplikasi — semuanya selesai di dashboard yang sama.
          </p>
        </div>

        <ol className="relative mt-12 grid gap-6 md:grid-cols-3 md:gap-4">
          {/* Garis penghubung hanya di layar lebar. */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-[16%] right-[16%] top-6 hidden h-px bg-ink-200 md:block"
          />

          {STEPS.map((step) => (
            <WorkflowStepCard key={step.step} step={step} />
          ))}
        </ol>
      </div>
    </section>
  )
}

function WorkflowStepCard({ step }: { step: WorkflowStep }) {
  const Icon = step.icon

  return (
    <li className="relative flex flex-col items-center text-center">
      <span className="relative z-10 flex size-12 items-center justify-center rounded-full border border-ink-200 bg-white text-brand-700 shadow-sm">
        <Icon className="size-5" />
      </span>
      <span className="mt-3 text-2xs font-semibold uppercase tracking-wider text-ink-400">
        Langkah {step.step}
      </span>
      <h3 className="mt-1 text-lead font-semibold text-ink-900">{step.title}</h3>
      <p className="mt-1.5 max-w-xs text-meta leading-relaxed text-ink-500">
        {step.description}
      </p>
    </li>
  )
}
