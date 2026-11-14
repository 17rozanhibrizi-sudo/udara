import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BarChart3, Database, HeartPulse, LayoutDashboard, Radio, ShieldCheck } from "lucide-react"
import { ISPU_CATEGORIES } from "@/lib/data"
import stats from "@/lib/home-stats.json"

/** "last30" = 30 hari terakhir data (sama dengan default dashboard); "all" = seluruh periode data */
const PERIOD: "last30" | "all" = "last30"

const win = stats[PERIOD]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}
const idn = (n: number, digits = 0) => n.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits })
const periodLabel = PERIOD === "last30" ? "30 hari terakhir" : "seluruh periode"

const SECTIONS = [
  {
    href: "/overview",
    icon: LayoutDashboard,
    title: "Overview",
    question: "Seberapa buruk kualitas udara saat ini?",
    desc: "Rata-rata konsentrasi, hari melampaui baku mutu, peta stasiun, dan tren harian.",
  },
  {
    href: "/pola-faktor",
    icon: BarChart3,
    title: "Pola & Faktor",
    question: "Kapan, di mana, dan mengapa polusi memuncak?",
    desc: "Pola per jam & mingguan, korelasi faktor cuaca/lalu lintas, dan rincian per stasiun.",
  },
  {
    href: "/dampak-kesehatan",
    icon: HeartPulse,
    title: "Dampak Kesehatan",
    question: "Siapa yang paling terdampak?",
    desc: "Kasus ISPA vs PM2.5, kelompok rentan, jeda paparan, dan beban rumah sakit.",
  },
  {
    href: "/evaluasi",
    icon: ShieldCheck,
    title: "Evaluasi & Rekomendasi",
    question: "Apa yang harus dilakukan?",
    desc: "Kelengkapan jaringan AQMS, blind spot, usulan stasiun, dan rekomendasi bertahap.",
  },
]

const HEADLINES = [
  { value: idn(stats.stations.operating), label: `Stasiun AQMS beroperasi (dari ${stats.stations.total} terdaftar)` },
  { value: win.pm25Kalimantan == null ? "–" : idn(win.pm25Kalimantan, 1), label: `µg/m³ rata-rata PM2.5 Kalimantan · ${periodLabel}` },
  { value: idn(win.ispaNasional), label: `Kasus ISPA di RS rujukan · ${periodLabel}` },
  { value: win.completeness == null ? "–" : `${idn(win.completeness, 1)}%`, label: `Kelengkapan data jaringan · ${periodLabel}` },
]

export function HomePage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8 p-4 md:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-2xl bg-sidebar text-sidebar-accent-foreground">
        <Image
          src="/images/hero-haze.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 1100px, 100vw"
          className="object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/85 to-sidebar/20" aria-hidden />
        <div className="relative flex flex-col gap-6 px-6 py-10 md:px-10 md:py-14">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-sidebar-primary opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-sidebar-primary" />
            </span>
            Pemantauan periode {fmtDate(win.from)} – {fmtDate(win.to)}
          </span>
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-balance md:text-5xl">
              Dasbor Kualitas Udara & Dampak Kesehatan
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-sidebar-foreground/85 md:text-base text-pretty">
              Satu tempat untuk membaca kondisi udara dari jaringan stasiun AQMS, memahami pola dan pemicunya,
              mengukur dampaknya pada pasien rumah sakit, hingga menyusun rekomendasi kebijakan.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/overview"
              className="inline-flex items-center gap-2 rounded-lg bg-sidebar-primary px-4 py-2.5 text-sm font-semibold text-sidebar-primary-foreground transition-opacity hover:opacity-90"
            >
              Mulai dari Overview
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/evaluasi"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10"
            >
              Lihat rekomendasi
            </Link>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 md:grid-cols-4">
            {HEADLINES.map((h) => (
              <div key={h.label} className="bg-sidebar/70 px-4 py-4 backdrop-blur">
                <dt className="text-xs text-sidebar-foreground/70">{h.label}</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums">{h.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="alur" className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-primary uppercase">Alur analisis</p>
          <h2 id="alur" className="mt-1 text-xl font-bold tracking-tight">
            Empat pertanyaan, empat halaman
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon
            return (
              <Link
                key={s.href}
                href={s.href}
                className="group flex flex-col rounded-xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm font-medium text-primary">{s.question}</p>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  Buka halaman
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border bg-card p-5 shadow-xs lg:col-span-3">
          <h2 className="text-sm font-semibold">Cara membaca kategori ISPU</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Indeks Standar Pencemar Udara (ISPU) mengikuti Permen LHK No. 14/2020.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-5">
            {ISPU_CATEGORIES.map((c) => (
              <li key={c.key} className="flex flex-col gap-2 rounded-lg border p-3">
                <span className="h-1.5 w-full rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                <span className="text-sm font-semibold">{c.label}</span>
                <span className="font-mono text-xs text-muted-foreground">ISPU {c.range}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs lg:col-span-2">
          <h2 className="text-sm font-semibold">Sumber data & catatan</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            <li className="flex gap-3">
              <Radio className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-medium">AQMS per jam</span>
                <span className="block text-xs text-muted-foreground">
                  {stats.stations.operating} stasiun beroperasi dari {stats.stations.total} terdaftar
                  {stats.stations.intermittent ? ` (${stats.stations.intermittent} intermiten)` : ""} · PM2.5, PM10, CO, SO₂, NO₂, O₃
                </span>
              </span>
            </li>
            <li className="flex gap-3">
              <HeartPulse className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-medium">Rekam kunjungan RS rujukan</span>
                <span className="block text-xs text-muted-foreground">ISPA, kardiovaskular, asma, PPOK, kematian</span>
              </span>
            </li>
            <li className="flex gap-3">
              <Database className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-medium">Status data</span>
                <span className="block text-xs text-muted-foreground">
                  Data nyata AQMS dan RS rujukan yang sudah lolos QC (valid). Hari ketika sensor macet dikecualikan dari rata-rata konsentrasi.
                </span>
              </span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
