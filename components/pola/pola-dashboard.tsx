"use client"

import { useState } from "react"
import { CalendarRange, Flame } from "lucide-react"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { useFilters } from "@/components/dashboard/filter-context"
import { KpiCard, LegendDot, PageHeader, Panel } from "@/components/dashboard/widgets"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  CORRELATIONS,
  LOCATION_TYPES,
  filterFactor,
  formatId,
  getHourlySeries,
  getLongestEpisode,
  getPollutant,
  getStations,
  getScatter,
  getWeeklySeries,
} from "@/lib/data"
import { CorrelationChart, HourlyChart, ScatterFactorChart, TYPE_COLORS, WeeklyChart } from "./pola-charts"

export function PolaDashboard() {
  const { region, pollutant, period } = useFilters()
  const filters = { region, pollutant, period }
  const [factor, setFactor] = useState(CORRELATIONS[0].factor)

  const pol = getPollutant(pollutant)
  const hourly = getHourlySeries(filters)
  const peak = hourly.reduce((a, b) => (b.value > a.value ? b : a))
  const weekly = getWeeklySeries(filters)
  const scale = filterFactor(filters)
  const scatter = getScatter(factor, scale)
  const stations = getStations(region)
  const weekday = 49.2 * scale
  const weekend = 44.3 * scale
  const episode = getLongestEpisode(filters)
  const isMonthly = period === "semua"

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:p-8">
      <PageHeader
        eyebrow="02 · Pola & Faktor"
        title="Pola Waktu, Tempat & Faktor Pemengaruh"
        description="Kapan dan di mana polusi memuncak, serta faktor lingkungan yang paling berkaitan dengan konsentrasinya."
      />
      <FilterBar show={["region", "pollutant", "period"]} />

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel
          className="lg:col-span-5"
          title={`Pola harian ${pol.label} per jam`}
          subtitle="AQMS per jam, waktu WIB (µg/m³)"
          action={
            <Badge variant="destructive" className="shrink-0">
              Puncak {peak.hour}.00 WIB
            </Badge>
          }
        >
          <HourlyChart data={hourly} peak={peak.hour} />
        </Panel>
        <Panel
          className="lg:col-span-4"
          title={`Pola periodik ${pol.label} per ${isMonthly ? "bulan" : "minggu"}`}
          subtitle={isMonthly ? "Rentang >4 bulan = per bulan" : "Rentang 15 hari–4 bulan = per minggu"}
          footnote="≤14 hari → harian · >4 bulan → bulanan"
        >
          <WeeklyChart data={weekly} />
        </Panel>
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1">
          <KpiCard
            label="Episode terpanjang"
            value={`${episode.len} hari`}
            caption={episode.len ? `Berturut-turut di atas BM · ${episode.range}` : "Tidak ada hari di atas BM"}
            tone="danger"
            icon={<Flame className="size-4" aria-hidden />}
          />
          <KpiCard
            label="Weekday vs weekend"
            value={
              <>
                {formatId(weekday)} <span className="text-lg text-muted-foreground">vs</span> {formatId(weekend)}
              </>
            }
            caption="µg/m³ · akhir pekan 10% lebih bersih"
            icon={<CalendarRange className="size-4" aria-hidden />}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={`Korelasi Pearson (r) ${pol.label} dengan faktor pemengaruh`}
          subtitle="Klik batang untuk mengganti sumbu X pada scatter"
          footnote="*Arah angin dikonversi ke komponen sin/cos"
        >
          <CorrelationChart active={factor} onSelect={setFactor} />
        </Panel>
        <Panel
          title={`Scatter: ${pol.label} vs ${factor.replace("*", "").toLowerCase()}`}
          subtitle="Setiap titik = rata-rata harian satu stasiun"
          footnote={`y = ${formatId(scatter.intercept)} ${scatter.slope < 0 ? "−" : "+"} ${formatId(Math.abs(scatter.slope), 2)}·x · R² = ${formatId(scatter.r2, 2)} (r = ${formatId(scatter.r, 2)}) · garis regresi ilustrasi`}
        >
          <ScatterFactorChart
            points={scatter.points}
            line={scatter.line}
            xLabel={`${factor.replace("*", "")} (${scatter.unit})`}
          />
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
            {LOCATION_TYPES.map((t) => (
              <LegendDot key={t} color={TYPE_COLORS[t]} label={t} />
            ))}
            <LegendDot color="var(--destructive)" label="Garis regresi" shape="line" />
          </div>
        </Panel>
      </div>

      <Panel title="Tabel rincian stasiun" subtitle="Pola waktu & faktor pemengaruh per stasiun AQMS">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead>Kode & nama stasiun</TableHead>
                <TableHead>Tipe lokasi</TableHead>
                <TableHead className="text-right">Rata-rata (µg/m³)</TableHead>
                <TableHead>Jam terburuk</TableHead>
                <TableHead>Puncak musiman</TableHead>
                <TableHead>Selisih weekday–weekend</TableHead>
                <TableHead className="text-right">Episode terpanjang</TableHead>
                <TableHead>Faktor dominan</TableHead>
                <TableHead>Korelasi r & R²</TableHead>
                <TableHead className="text-right">Kelengkapan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stations.map((s) => (
                <TableRow key={s.code}>
                  <TableCell>
                    <span className="font-mono text-[11px] text-muted-foreground">{s.code}</span>
                    <span className="block font-medium">{s.name}</span>
                  </TableCell>
                  <TableCell>{s.type}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatId(s.avg * scale)}</TableCell>
                  <TableCell className="tabular-nums">{s.peakHour} WIB</TableCell>
                  <TableCell>{s.season}</TableCell>
                  <TableCell className="tabular-nums">{s.weekdayDiff}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.episode} hari</TableCell>
                  <TableCell>{s.factor}</TableCell>
                  <TableCell className="tabular-nums">
                    r {s.r > 0 ? "+" : "−"}
                    {formatId(Math.abs(s.r), 2)} · R² {formatId(s.r2, 2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        s.completeness >= 95 ? "font-semibold text-success" : "font-semibold text-[oklch(0.6_0.16_55)]"
                      }
                    >
                      {s.completeness}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  )
}
