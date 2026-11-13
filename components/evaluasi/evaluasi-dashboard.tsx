"use client"

import { CheckCircle2, EyeOff, Hospital, Ratio } from "lucide-react"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { useFilters } from "@/components/dashboard/filter-context"
import { KpiCard, LegendDot, PageHeader, Panel } from "@/components/dashboard/widgets"
import { NetworkMap } from "@/components/maps"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EVAL_KPIS, EVAL_TABLE, NETWORK_STATIONS, PROPOSED_STATIONS, RECOMMENDATIONS, formatId } from "@/lib/data"
import { cn } from "@/lib/utils"

const toneStyles = {
  success: { bar: "bg-success", chip: "bg-success/10 text-success" },
  primary: { bar: "bg-chart-5", chip: "bg-chart-5/10 text-chart-5" },
  warning: { bar: "bg-warning", chip: "bg-warning/15 text-[oklch(0.5_0.13_55)]" },
}

export function EvaluasiDashboard() {
  const { region } = useFilters()
  const kpi = EVAL_KPIS[region]
  const byRegion = <T extends { region: string }>(list: T[]) =>
    region === "nasional" ? list : list.filter((x) => x.region === region)
  const stations = byRegion(NETWORK_STATIONS)
  const proposed = byRegion(PROPOSED_STATIONS)
  const rows = byRegion(EVAL_TABLE)

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:p-8">
      <PageHeader
        eyebrow="04 · Evaluasi & Rekomendasi"
        title="Evaluasi Jaringan & Rekomendasi Kebijakan"
        description="Menilai keandalan jaringan AQMS, celah cakupan pemantauan terhadap beban kesehatan, dan langkah kebijakan yang diusulkan."
      />
      <FilterBar show={["region", "period"]} note="Tanpa filter polutan: evaluasi risiko menyeluruh" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Kelengkapan data jaringan"
          value={`${formatId(kpi.completeness)}% jam valid`}
          valueClassName="text-2xl"
          caption={`Keandalan rekaman dari ${kpi.stations} stasiun AQMS aktif`}
          tone="success"
          icon={<CheckCircle2 className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Wilayah paling blind spot"
          value={kpi.blindSpot}
          valueClassName="text-lg leading-snug"
          caption={kpi.blindNote}
          tone="danger"
          icon={<EyeOff className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Rata-rata jarak RS ke stasiun"
          value={`${formatId(kpi.distance)} km`}
          valueClassName="text-2xl"
          caption="Jarak RS rujukan ke sensor pemantau terdekat"
          tone="warning"
          icon={<Hospital className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Rasio polusi vs baseline"
          value={`${formatId(kpi.ratio, 2)}× baseline`}
          valueClassName="text-2xl"
          caption={`PM2.5 rata-rata ${kpi.ratioPct}% di atas acuan alamiah wilayah`}
          tone="danger"
          icon={<Ratio className="size-4" aria-hidden />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-2" title="Peta evaluasi jaringan & usulan stasiun baru" subtitle="Radius cakupan ±40 km per stasiun (ilustrasi)">
          <div className="h-80">
            <NetworkMap stations={stations} proposed={proposed} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            <LegendDot color="var(--chart-1)" label={`Stasiun (${stations.length})`} />
            <LegendDot color="var(--destructive)" label={`RS rujukan (${stations.length})`} />
            <LegendDot color="oklch(0.5 0.1 195 / 0.25)" label="Radius 30–50 km" />
            <LegendDot color="#f2b632" label={`Usulan stasiun baru (${proposed.length})`} shape="square" />
          </div>
        </Panel>
        <Panel className="lg:col-span-3" title="Evaluasi pemantauan vs risiko kesehatan" subtitle="Prioritas wilayah berdasarkan beban kasus dan rasio polusi">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>Wilayah (Kota/Kab)</TableHead>
                  <TableHead>Tipe lokasi</TableHead>
                  <TableHead>Stasiun</TableHead>
                  <TableHead className="text-right">Beban kasus RS</TableHead>
                  <TableHead>Kapasitas TT</TableHead>
                  <TableHead>PM2.5 vs baseline</TableHead>
                  <TableHead className="min-w-56">Status & rekomendasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.area}>
                    <TableCell className="font-medium whitespace-normal">{r.area}</TableCell>
                    <TableCell className="whitespace-normal">{r.type}</TableCell>
                    <TableCell>{r.stations}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.cases} kasus</TableCell>
                    <TableCell>{r.beds}</TableCell>
                    <TableCell className="tabular-nums whitespace-normal">{r.pm}</TableCell>
                    <TableCell className="whitespace-normal">
                      <span
                        className={cn(
                          "mr-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                          r.status === "Kritis" ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-[oklch(0.5_0.13_55)]",
                        )}
                      >
                        {r.status}
                      </span>
                      <span className="text-xs">{r.action}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </div>

      <section aria-labelledby="rekomendasi" className="flex flex-col gap-3">
        <h2 id="rekomendasi" className="text-sm font-semibold">
          Rekomendasi kebijakan bertahap
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {RECOMMENDATIONS.map((rec, i) => (
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
