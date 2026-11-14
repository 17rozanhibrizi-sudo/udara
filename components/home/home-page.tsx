import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BarChart3, Database, EyeOff, HeartPulse, LayoutDashboard, Radio, ShieldCheck, Users } from "lucide-react"
import { ISPU_CATEGORIES } from "@/lib/data"
import { BrandLogo } from "@/components/dashboard/brand-logo"

/** Cakupan data (sumber: master stasiun–RS dan 04_env_health_daily_ready; diperbarui manual bila data berubah) */
const COVERAGE = {
  stations: 27, // terdaftar; 26 beroperasi, 1 rusak (AQMS-JMB-02)
  operating: 26,
  intermittent: 3,
  defective: 1,
  hospitals: 27, // RS rujukan; 26 punya data kunjungan
  islands: 5, // Sumatera, Jawa, Kalimantan, Sulawesi, Papua
  from: "2024-01-01",
  to: "2026-10-14",
  days: 1018,
  pollutants: ["PM2.5", "PM10", "SO₂", "CO", "O₃", "NO₂"],
  diseases: ["ISPA", "asma", "PPOK", "kardiovaskular", "kematian"],
  /** stasiun beroperasi yang jaraknya > 1.200 km dari stasiun beroperasi lain terdekat (Sorong, Merauke) */
  isolatedStations: 2,
  isolatedKm: 1200,
  completeness: 93.1, // % jam valid (baris valid / baris mentah) 26 stasiun beroperasi, seluruh periode
  ispaCases: 688345, // kasus ISPA/pernapasan seluruh periode, seluruh RS
  lansiaPct: 54.8, // porsi rawat inap pernapasan: lansia >60 th vs balita <5 th
  balitaPct: 45.2,
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}
const idn = (n: number) => n.toLocaleString("id-ID")
const pct = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 1 })

const SECTIONS = [
  {
    href: "/overview",
    icon: LayoutDashboard,
    title: "Overview",
    question: "Seberapa buruk kualitas udara saat ini?",
    desc: "Konsentrasi, hari melampaui baku mutu, peta stasiun, tren harian.",
  },
  {
    href: "/pola-faktor",
    icon: BarChart3,
    title: "Pola & Faktor",
    question: "Kapan, di mana, dan mengapa polusi memuncak?",
    desc: "Pola per jam & mingguan, korelasi faktor, rincian per stasiun.",
  },
  {
    href: "/dampak-kesehatan",
    icon: HeartPulse,
    title: "Dampak Kesehatan",
    question: "Siapa yang paling terdampak?",
    desc: "Kasus ISPA vs PM2.5, kelompok rentan, jeda paparan, beban RS.",
  },
  {
    href: "/evaluasi",
    icon: ShieldCheck,
    title: "Evaluasi & Rekomendasi",
    question: "Apa yang harus dilakukan?",
    desc: "Kelengkapan jaringan, blind spot, usulan stasiun, rekomendasi.",
  },
]

const HEADLINES = [
  { value: `${COVERAGE.stations} / ${COVERAGE.hospitals}`, label: `Stasiun AQMS / RS rujukan · ${COVERAGE.islands} pulau besar` },
  { value: `${COVERAGE.from.slice(0, 4)}–${COVERAGE.to.slice(0, 4)}`, label: `Periode observasi · ${idn(COVERAGE.days)} hari` },
  { value: String(COVERAGE.pollutants.length), label: `Parameter polutan · ${COVERAGE.pollutants.join(", ")}` },
  { value: String(COVERAGE.diseases.length), label: `Kategori dampak medis · ${COVERAGE.diseases.join(", ")}` },
]

export function HomePage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6 lg:p-8">
      <BrandLogo className="self-start" />

      {/* Baris 1: hero (kiri) + dua masalah (kanan) */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <section className="relative overflow-hidden rounded-2xl bg-sidebar text-sidebar-accent-foreground">
          <Image
            src="/images/hero-haze.png"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 800px, 100vw"
            className="object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/85 to-sidebar/20" aria-hidden />
          <div className="relative flex h-full flex-col justify-between gap-5 px-6 py-6 md:px-8 md:py-7">
            <div className="flex flex-col gap-3">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-sidebar-primary opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-sidebar-primary" />
                </span>
                Periode observasi {fmtDate(COVERAGE.from)} – {fmtDate(COVERAGE.to)}
              </span>
              <div>
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">SI-NAPAS</h1>
                <p className="mt-2 max-w-xl text-lg font-semibold tracking-tight text-balance text-sidebar-primary md:text-xl">
                  Menutup Titik Buta Pemantauan Udara & Melindungi Kelompok Rentan
                </p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-sidebar-foreground/85 text-pretty">
                  Membaca kondisi udara dari jaringan stasiun AQMS, mengukur dampaknya pada pasien rumah sakit, dan menyusun
                  rekomendasi kebijakan.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/overview"
                  className="inline-flex items-center gap-2 rounded-lg bg-sidebar-primary px-4 py-2 text-sm font-semibold text-sidebar-primary-foreground transition-opacity hover:opacity-90"
                >
                  Mulai dari Overview
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  href="/evaluasi"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10"
                >
                  Lihat rekomendasi
                </Link>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 md:grid-cols-4">
              {HEADLINES.map((h) => (
                <div key={h.label} className="bg-sidebar/70 px-3 py-3 backdrop-blur">
                  <dt className="text-[11px] leading-snug text-sidebar-foreground/70">{h.label}</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums">{h.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-label="Dua masalah yang dijawab" className="grid gap-4">
          <article className="flex flex-col rounded-xl border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <EyeOff className="size-5" aria-hidden />
              </span>
              <h2 className="font-semibold">Titik buta pemantauan</h2>
            </div>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              {COVERAGE.isolatedStations} stasiun (Sorong, Merauke) berjarak &gt; {idn(COVERAGE.isolatedKm)} km dari stasiun lain. {COVERAGE.defective}{" "}
              stasiun rusak, {COVERAGE.intermittent} intermiten; kelengkapan jam valid {pct(COVERAGE.completeness)}%.
            </p>
            <Link href="/evaluasi" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
              Lihat peta evaluasi & usulan stasiun
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </article>
          <article className="flex flex-col rounded-xl border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-[oklch(0.5_0.13_55)]">
                <Users className="size-5" aria-hidden />
              </span>
              <h2 className="font-semibold">Kelompok rentan</h2>
            </div>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              Dari {idn(COVERAGE.ispaCases)} kasus ISPA di RS rujukan, rawat inap pernapasan lebih banyak dari lansia (&gt;60 th,{" "}
              {pct(COVERAGE.lansiaPct)}%) daripada balita (&lt;5 th, {pct(COVERAGE.balitaPct)}%).
            </p>
            <Link href="/dampak-kesehatan" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
              Lihat dampak kesehatan per kelompok usia
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </article>
        </section>
      </div>

      {/* Baris 2: empat halaman */}
      <section aria-label="Empat pertanyaan, empat halaman" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((s, i) => {
          const Icon = s.icon
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group flex flex-col rounded-xl border bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="font-semibold">{s.title}</h3>
                <span className="ml-auto font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <p className="mt-3 text-sm font-medium text-primary">{s.question}</p>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                Buka halaman
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          )
        })}
      </section>

      {/* Baris 3: ISPU + sumber data */}
      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border bg-card p-4 shadow-xs lg:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="text-sm font-semibold">Cara membaca kategori ISPU</h2>
            <p className="text-[11px] text-muted-foreground">Indeks Standar Pencemar Udara, Permen LHK No. 14/2020</p>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-5">
            {ISPU_CATEGORIES.map((c) => (
              <li key={c.key} className="flex flex-col gap-1.5 rounded-lg border p-2.5">
                <span className="h-1.5 w-full rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                <span className="text-xs font-semibold leading-tight">{c.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground">ISPU {c.range}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs lg:col-span-2">
          <h2 className="text-sm font-semibold">Sumber data & catatan</h2>
          <ul className="mt-3 flex flex-col gap-2.5 text-sm">
            <li className="flex gap-3">
              <Radio className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-medium">AQMS per jam</span>
                <span className="block text-xs text-muted-foreground">
                  {COVERAGE.operating} stasiun beroperasi dari {COVERAGE.stations} terdaftar ({COVERAGE.intermittent} intermiten)
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
                <span className="font-medium">Catatan kualitas data</span>
                <span className="block text-xs text-muted-foreground">
                  Hanya data valid; hari dengan kurang dari 18 jam data valid dikecualikan dari rata-rata konsentrasi.
                </span>
              </span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
