"use client"

import { useMemo } from "react"
import { CheckCircle2, EyeOff, Ratio } from "lucide-react"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { useFilters } from "@/components/dashboard/filter-context"
import { KpiCard, LegendDot, PageHeader, Panel } from "@/components/dashboard/widgets"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatId } from "@/lib/data"
import {
  COMPLETENESS_GOOD,
  COMPLETENESS_MIN,
  COVERAGE_KM,
  RATIO_CRITICAL,
  RATIO_WATCH,
  computeRows,
  getActionPlan,
  getKpis,
  getProposals,
  stationsInRegion,
  type EvalDB,
  type Level,
  type WilayahRow,
} from "@/lib/evaluasi-data"
import { useEvaluasiData } from "@/lib/use-evaluasi-data"
import { cn } from "@/lib/utils"
import { EvaluasiMap } from "./evaluasi-map"

const levelStyle: Record<Level, string> = {
  Kritis: "bg-destructive/10 text-destructive",
  Waspada: "bg-warning/15 text-[oklch(0.5_0.13_55)]",
  Terpantau: "bg-success/10 text-success",
  Nonaktif: "bg-muted text-muted-foreground",
  "Tanpa data": "bg-muted text-muted-foreground",
}

const toneStyles = {
  success: { bar: "bg-success", chip: "bg-success/10 text-success" },
  primary: { bar: "bg-chart-5", chip: "bg-chart-5/10 text-chart-5" },
  warning: { bar: "bg-warning", chip: "bg-warning/15 text-[oklch(0.5_0.13_55)]" },
}

function Header() {
  return (
    <PageHeader
      eyebrow="04 · Evaluasi & Rekomendasi"
      title="Evaluasi Jaringan & Rekomendasi Kebijakan"
      description="Menilai keandalan jaringan AQMS, celah cakupan pemantauan terhadap beban kesehatan, dan langkah kebijakan yang diusulkan."
      dummy={false}
    />
  )
}

export function EvaluasiDashboard() {
  const { db, error, loading } = useEvaluasiData()
  if (db) return <EvaluasiContent db={db} />
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:p-8">
      <Header />
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground" role="status">
        {loading ? "Memuat data evaluasi jaringan…" : `Data tidak dapat dimuat. ${error ?? ""}`}
      </div>
    </div>
  )
}

function EvaluasiContent({ db }: { db: EvalDB }) {
  const { region, range } = useFilters()

  // Skor & status dihitung nasional (dinormalkan seluruh stasiun) lalu disaring Wilayah.
  const all = useMemo(() => computeRows(db, range), [db, range])
  const rows = useMemo(
    () => [...stationsInRegion(all, region)].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    [all, region],
  )
  const kpi = useMemo(() => getKpis(rows), [rows])
  const proposals = useMemo(() => getProposals(db, rows, region), [db, rows, region])
  const plan = useMemo(() => getActionPlan(db, rows, region, proposals), [db, rows, region, proposals])

  const compTone = kpi.completeness == null ? "default" : kpi.completeness >= COMPLETENESS_GOOD ? "success" : kpi.completeness >= COMPLETENESS_MIN ? "warning" : "danger"
  const ratioTone = !kpi.ratio ? "default" : kpi.ratio.value > RATIO_CRITICAL ? "danger" : kpi.ratio.value > RATIO_WATCH ? "warning" : "success"
  const b = kpi.blind
  const pct = kpi.ratio ? Math.round((kpi.ratio.value - 1) * 100) : 0

  const recs = [
    { horizon: "Jangka Pendek", span: "0–6 bulan", title: "Respons cepat & operasional", tone: "success" as const, items: plan.short },
    { horizon: "Jangka Menengah", span: "6–18 bulan", title: "Pengendalian sumber & faskes", tone: "primary" as const, items: plan.mid },
    { horizon: "Jangka Panjang", span: ">18 bulan", title: "Ekspansi infrastruktur jaringan", tone: "warning" as const, items: plan.long },
  ]

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:p-8">
      <Header />
      <FilterBar show={["region", "period"]} note="Tanpa filter polutan: evaluasi risiko menyeluruh" />

      {/* Baris 1: KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Kelengkapan data jaringan"
          value={kpi.completeness == null ? "–" : `${formatId(kpi.completeness, 1)}% jam valid`}
          valueClassName="text-2xl"
          caption={
            kpi.operational
              ? `Jam valid ÷ total jam observasi, dari ${kpi.operational} stasiun AQMS beroperasi${kpi.intermittent ? ` (${kpi.intermittent} intermiten)` : ""}`
              : "Tidak ada stasiun beroperasi pada wilayah ini"
          }
          tone={compTone}
          icon={<CheckCircle2 className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Wilayah paling blind spot"
          value={b ? b.name : "–"}
          valueClassName="text-lg leading-snug"
          caption={
            b
              ? `${b.cases.toLocaleString("id-ID")} kasus RS · PM2.5 ${formatId(b.ratio ?? 0, 2)}× baseline · kelengkapan data ${formatId(b.completeness, 1)}%`
              : "Belum ada stasiun berdata pada rentang tanggal ini"
          }
          tone="danger"
          icon={<EyeOff className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Rasio polusi vs baseline"
          value={kpi.ratio ? `${formatId(kpi.ratio.value, 2)}× baseline` : "–"}
          valueClassName="text-2xl"
          caption={
            kpi.ratio
              ? `PM2.5 rata-rata ${formatId(kpi.ratio.avg, 1)} µg/m³ vs baseline ${formatId(kpi.ratio.baseline, 1)} µg/m³ (${pct >= 0 ? `${pct}% di atas` : `${Math.abs(pct)}% di bawah`} acuan alamiah)`
              : "Belum ada data PM2.5 pada rentang tanggal ini"
          }
          tone={ratioTone}
          icon={<Ratio className="size-4" aria-hidden />}
        />
      </div>

      {/* Baris 2: peta + tabel (50 : 50) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Peta evaluasi jaringan & usulan stasiun baru"
          subtitle={`Radius cakupan ${COVERAGE_KM.inner}–${COVERAGE_KM.outer} km per stasiun (ilustrasi)`}
          footnote="Dataset tidak memuat koordinat RS (1 RS = 1 stasiun di kota yang sama), jadi titik RS tidak digambar. Titik usulan indikatif: daratan di luar radius 50 km, dekat wilayah berisiko tinggi; verifikasi di lapangan."
        >
          <div className="h-80 lg:h-[26rem]">
            <EvaluasiMap stations={rows} proposals={proposals} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            <LegendDot color="var(--chart-1)" label={`Stasiun (${rows.filter((r) => r.operational).length})`} />
            <LegendDot color="var(--destructive)" label="Wilayah kritis" />
            <LegendDot color="oklch(0.5 0.1 195 / 0.25)" label={`Radius ${COVERAGE_KM.inner}–${COVERAGE_KM.outer} km`} />
            <LegendDot color="#f2b632" label={`Usulan stasiun baru (${proposals.length})`} shape="square" />
          </div>
        </Panel>

        <Panel
          title="Evaluasi pemantauan vs risiko kesehatan"
          subtitle="Prioritas wilayah berdasarkan beban kasus dan rasio polusi"
          footnote={`Beban kasus = resp + cvd + death. Kritis: PM2.5 > ${RATIO_CRITICAL}× baseline dan kasus/hari ≥ median seluruh stasiun. Waspada: PM2.5 > ${RATIO_CRITICAL}×, atau > ${RATIO_WATCH}× dengan beban tinggi, atau kelengkapan < ${COMPLETENESS_MIN}%. Kelengkapan = jam valid ÷ (24 × jumlah hari rentang). Hari sensor macet dikecualikan dari PM2.5.`}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>Wilayah (Kota/Kab)</TableHead>
                  <TableHead>Tipe lokasi</TableHead>
                  <TableHead>Stasiun eksisting</TableHead>
                  <TableHead className="text-right">Beban kasus RS</TableHead>
                  <TableHead>Kapasitas TT</TableHead>
                  <TableHead>PM2.5 vs baseline</TableHead>
                  <TableHead className="min-w-60">Status & rekomendasi aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <Row key={r.code} r={r} />
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </div>

      {/* Baris 3: rencana aksi */}
      <section aria-labelledby="rekomendasi" className="flex flex-col gap-3">
        <h2 id="rekomendasi" className="text-sm font-semibold">
          Rekomendasi kebijakan bertahap
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {recs.map((rec, i) => (
            <article key={rec.horizon} className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-xs">
              <span className={cn("absolute inset-x-0 top-0 h-1", toneStyles[rec.tone].bar)} aria-hidden />
              <div className="flex items-center justify-between gap-2">
                <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", toneStyles[rec.tone].chip)}>
                  {rec.horizon} · {rec.span}
                </span>
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-3 font-semibold">{rec.title}</h3>
              <ol className="mt-3 flex flex-col gap-2.5">
                {rec.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
                      {j + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function Row({ r }: { r: WilayahRow }) {
  const dash = <span className="text-muted-foreground">–</span>
  return (
    <TableRow className={r.hasData && r.operational ? undefined : "text-muted-foreground"}>
      <TableCell className="whitespace-normal">
        <span className="font-medium">{r.name}</span>
        <span className="block text-[11px] text-muted-foreground">
          {r.province} · <span className="font-mono">{r.code}</span>
        </span>
      </TableCell>
      <TableCell className="whitespace-normal">{r.type}</TableCell>
      <TableCell>{r.operational ? `1 stasiun${r.status === "Intermittent" ? " (intermiten)" : ""}` : "0 (rusak)"}</TableCell>
      <TableCell className="text-right tabular-nums">{r.hasData ? `${r.cases.toLocaleString("id-ID")} kasus` : dash}</TableCell>
      <TableCell className="whitespace-normal tabular-nums">
        {r.hospital.beds.toLocaleString("id-ID")} TT ({r.hospital.cls})
      </TableCell>
      <TableCell className="whitespace-normal tabular-nums">
        {r.avgPm != null && r.ratio != null ? (
          <>
            {formatId(r.avgPm, 1)} vs {formatId(r.baseline, 1)} µg/m³ ({formatId(r.ratio, 2)}×)
          </>
        ) : (
          dash
        )}
      </TableCell>
      <TableCell className="whitespace-normal">
        <span className={cn("mr-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase", levelStyle[r.level])}>
          {r.level}
        </span>
        <span className="text-xs">{r.actions.join(" · ")}</span>
        {r.operational && (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">Kelengkapan data {formatId(r.completeness, 1)}%</span>
        )}
      </TableCell>
    </TableRow>
  )
}
