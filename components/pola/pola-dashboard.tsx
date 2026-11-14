"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarRange, Flame } from "lucide-react"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { useFilters } from "@/components/dashboard/filter-context"
import { KpiCard, LegendDot, PageHeader, Panel } from "@/components/dashboard/widgets"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  LOCATION_TYPES,
  formatId,
  getPollutant,
  resolvePollutant,
  type Pollutant,
  type PollutantSelection,
} from "@/lib/data"
import { STANDARD_WINDOW } from "@/lib/overview-data"
import {
  factorMeta,
  getCorrelations,
  getHourlyProfile,
  getLongestEpisode,
  getPeriodSeries,
  getScatter,
  getStationTable,
  getWeekdayWeekend,
  type FactorKey,
  type PolaDB,
  type PolaRow,
} from "@/lib/pola-data"
import { usePolaData, usePolaHourly } from "@/lib/use-pola-data"
import { CorrelationChart, HourlyChart, PeriodChart, ScatterFactorChart, TYPE_COLORS } from "./pola-charts"

/** Angka dengan 3 angka signifikan (kemiringan regresi bisa sangat kecil, mis. lalu lintas) */
const sig = (n: number) => n.toLocaleString("id-ID", { maximumSignificantDigits: 3 })
const signed = (n: number, d = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatId(Math.abs(n), d)}`

function Header() {
  return (
    <PageHeader
      eyebrow="02 · Pola & Faktor"
      title="Pola Waktu, Tempat & Faktor Pemengaruh"
      description="Kapan dan di mana polusi memuncak, serta faktor lingkungan yang paling berkaitan dengan konsentrasinya."
      dummy={false}
    />
  )
}

export function PolaDashboard() {
  const { db, error, loading } = usePolaData()
  if (db) return <PolaContent db={db} />
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:p-8">
      <Header />
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground" role="status">
        {loading ? "Memuat data kualitas udara…" : `Data tidak dapat dimuat. ${error ?? ""}`}
      </div>
    </div>
  )
}

function PolaContent({ db }: { db: PolaDB }) {
  const { region, pollutant: rawSelection, range, setFilter } = useFilters()
  const selection = rawSelection as PollutantSelection

  // Halaman ini hanya menerima SATU polutan (nilai awal PM2.5). "Semua polutan" dari halaman Overview dikembalikan ke PM2.5.
  useEffect(() => {
    if (selection === "ALL") setFilter("pollutant", "PM2.5")
  }, [selection, setFilter])
  const pollutant: Pollutant = resolvePollutant(selection)

  const pol = getPollutant(pollutant)
  const filters = useMemo(() => ({ region, pollutant, range }), [region, pollutant, range])
  const { hourly, loading: hourlyLoading, error: hourlyError } = usePolaHourly(pollutant, region)

  const profile = useMemo(() => (hourly ? getHourlyProfile(db, hourly, filters) : null), [db, hourly, filters])
  const period = useMemo(() => getPeriodSeries(db, filters), [db, filters])
  const episode = useMemo(() => getLongestEpisode(db, filters), [db, filters])
  const ww = useMemo(() => getWeekdayWeekend(db, filters), [db, filters])
  const corr = useMemo(() => getCorrelations(db, filters), [db, filters])
  const table = useMemo(() => getStationTable(db, hourly, filters), [db, hourly, filters])

  // Faktor pada scatter: pilihan pengguna, bila belum ada → faktor dominan (|r| terbesar)
  const [picked, setPicked] = useState<FactorKey | null>(null)
  const active: FactorKey = picked ?? corr.dominant ?? "wind"
  const scatter = useMemo(() => getScatter(db, filters, active), [db, filters, active])
  const dominantRow = corr.rows.find((r) => r.key === corr.dominant)
  const meta = factorMeta(active)

  const granSubtitle = {
    hari: "Rentang ≤14 hari = per hari",
    minggu: "Rentang 15 hari–4 bulan = per minggu",
    bulan: "Rentang >4 bulan = per bulan",
  }[period.gran]
  const stdWindow = STANDARD_WINDOW[pollutant]
  const stationsWithData = table.filter((s) => s.hasData).length

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:p-8">
      <Header />
      <FilterBar show={["region", "pollutant", "period"]} singlePollutant />

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel
          className="lg:col-span-5"
          title={`Pola harian ${pol.label} per jam`}
          subtitle="AQMS per jam, waktu WIB (µg/m³)"
          action={
            profile?.peak ? (
              <Badge variant="destructive" className="shrink-0">
                Puncak {profile.peak.hour}.00 WIB
              </Badge>
            ) : null
          }
        >
          {profile ? (
            <HourlyChart data={profile.points} peak={profile.peak?.hour ?? null} />
          ) : (
            <div
              className="flex h-56 items-center justify-center rounded-md border border-dashed px-4 text-center text-xs text-muted-foreground"
              role="status"
            >
              {hourlyError ? `Data per jam tidak dapat dimuat. ${hourlyError}` : "Memuat data per jam…"}
            </div>
          )}
        </Panel>
        <Panel
          className="lg:col-span-4"
          title={`Pola periodik ${pol.label} per ${period.gran}`}
          subtitle={granSubtitle}
          footnote="≤14 hari → harian · 15 hari–4 bulan → mingguan · >4 bulan → bulanan"
        >
          <PeriodChart data={period.points} />
        </Panel>
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1">
          <KpiCard
            label="Episode terpanjang"
            value={`${episode.len} hari`}
            caption={
              episode.len
                ? `Berturut-turut di atas BM ${stdWindow} (${pol.standard.toLocaleString("id-ID")}) · ${episode.range}`
                : stationsWithData
                  ? `Tidak ada hari di atas BM (${pol.standard.toLocaleString("id-ID")} µg/m³)`
                  : "Tidak ada stasiun berdata"
            }
            tone="danger"
            icon={<Flame className="size-4" aria-hidden />}
          />
          <KpiCard
            label="Weekday vs weekend"
            value={
              ww ? (
                <>
                  {formatId(ww.weekday)} <span className="text-lg text-muted-foreground">vs</span> {formatId(ww.weekend)}
                </>
              ) : (
                "–"
              )
            }
            caption={
              ww
                ? `µg/m³ · akhir pekan ${
                    ww.pct === 0 ? "sama" : `${formatId(Math.abs(ww.pct))}% ${ww.pct > 0 ? "lebih bersih" : "lebih kotor"}`
                  }`
                : "Perlu data hari kerja dan akhir pekan"
            }
            icon={<CalendarRange className="size-4" aria-hidden />}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={`Korelasi Pearson (r) ${pol.label} dengan faktor pemengaruh`}
          subtitle="Klik batang untuk mengganti sumbu X pada scatter"
          footnote={
            (dominantRow
              ? corr.dominantWeak
                ? `Korelasi terkuat: ${dominantRow.factor} (r = ${formatId(dominantRow.r ?? 0, 2)}), tergolong lemah (|r| < 0,1), jadi tidak ada faktor dominan yang jelas. `
                : `Faktor dominan: ${dominantRow.factor} (r = ${formatId(dominantRow.r ?? 0, 2)}), batang oranye bila tidak sedang dipilih. `
              : "") +
            "Suhu, kelembapan, angin: n = hari-stasiun. Lalu lintas & jarak jalan tetap per lokasi, jadi dihitung antar-stasiun (n = jumlah stasiun)."
          }
        >
          <CorrelationChart
            rows={corr.rows}
            active={active}
            dominant={corr.dominant}
            onSelect={(k) => setPicked(k as FactorKey)}
          />
        </Panel>
        <Panel
          title={`Scatter: ${pol.label} vs ${meta.label.toLowerCase()}`}
          subtitle={
            meta.level === "harian"
              ? "Setiap titik = rata-rata harian satu stasiun"
              : "Setiap titik = rata-rata satu stasiun pada periode terpilih"
          }
          footnote={
            scatter.r == null || scatter.slope == null || scatter.intercept == null || scatter.r2 == null
              ? `Data belum cukup untuk regresi (n = ${scatter.total}).`
              : `y = ${sig(scatter.intercept)} ${scatter.slope < 0 ? "−" : "+"} ${sig(Math.abs(scatter.slope))}·x · R² = ${formatId(scatter.r2, 2)} (r = ${formatId(scatter.r, 2)}) · n = ${scatter.total.toLocaleString("id-ID")}${
                  scatter.points.length < scatter.total ? ` (titik digambar: ${scatter.points.length.toLocaleString("id-ID")})` : ""
                }`
          }
        >
          <ScatterFactorChart points={scatter.points} line={scatter.line} xLabel={`${meta.label} (${meta.unit})`} />
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
            {LOCATION_TYPES.map((t) => (
              <LegendDot key={t} color={TYPE_COLORS[t]} label={t} />
            ))}
            <LegendDot color="var(--destructive)" label="Garis regresi" shape="line" />
          </div>
        </Panel>
      </div>

      <Panel
        title="Tabel rincian stasiun"
        subtitle="Pola waktu & faktor pemengaruh per stasiun AQMS"
        footnote="Selisih = rata-rata hari kerja − akhir pekan (% terhadap hari kerja). Faktor dominan dipilih dari suhu, kelembapan, dan kecepatan angin (|r| terbesar); |r| < 0,1 dianggap lemah. Kelengkapan = % data valid terhadap seluruh rekaman sensor."
      >
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
              {table.map((s) => (
                <StationRow key={s.code} s={s} hourlyLoading={hourlyLoading} />
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  )
}

function StationRow({ s, hourlyLoading }: { s: PolaRow; hourlyLoading: boolean }) {
  const dash = <span className="text-muted-foreground">–</span>
  return (
    <TableRow className={s.hasData ? undefined : "text-muted-foreground"}>
      <TableCell>
        <span className="font-mono text-[11px] text-muted-foreground">{s.code}</span>
        <span className="block font-medium">{s.name}</span>
      </TableCell>
      <TableCell>{s.type}</TableCell>
      {s.hasData ? (
        <>
          <TableCell className="text-right font-semibold tabular-nums">{formatId(s.avg ?? 0)}</TableCell>
          <TableCell className="tabular-nums">
            {s.worstHour != null ? `${String(s.worstHour).padStart(2, "0")}.00 WIB` : hourlyLoading ? "…" : dash}
          </TableCell>
          <TableCell>{s.peakMonth ?? dash}</TableCell>
          <TableCell className="tabular-nums">
            {s.weekday ? `${signed(s.weekday.diff)} (${signed(s.weekday.pct, 0)}%)` : dash}
          </TableCell>
          <TableCell className="text-right tabular-nums">{s.episode.len} hari</TableCell>
          <TableCell>
            {s.factor ? (
              s.factor.weak ? (
                <span className="text-muted-foreground" title={`Korelasi terkuat: ${s.factor.label}`}>
                  Lemah (|r| &lt; 0,1)
                </span>
              ) : (
                s.factor.label
              )
            ) : (
              dash
            )}
          </TableCell>
          <TableCell className="tabular-nums">
            {s.factor ? `r ${signed(s.factor.r, 2)} · R² ${formatId(s.factor.r2, 2)}` : dash}
          </TableCell>
        </>
      ) : (
        <TableCell colSpan={7} className="text-xs">
          {s.status === "Defective"
            ? "Stasiun rusak/nonaktif: tidak ada data."
            : "Tidak ada data pada rentang tanggal ini."}
        </TableCell>
      )}
      <TableCell className="text-right">
        <span
          className={s.completeness >= 95 ? "font-semibold text-success" : "font-semibold text-[oklch(0.6_0.16_55)]"}
        >
          {formatId(s.completeness)}%
        </span>
      </TableCell>
    </TableRow>
  )
}
