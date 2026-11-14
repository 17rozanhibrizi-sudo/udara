"use client"

import { useMemo, useState } from "react"
import { CalendarClock, Gauge, TrendingDown, TrendingUp } from "lucide-react"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { useFilters } from "@/components/dashboard/filter-context"
import { KpiCard, LegendDot, PageHeader, Panel } from "@/components/dashboard/widgets"
import { StationMap } from "@/components/maps"
import {
  DEFAULT_RANGE,
  ISPU_CATEGORIES,
  POLLUTANTS,
  POLLUTANT_COLORS,
  formatId,
  formatRangeShort,
  getPollutant,
  getRegion,
  resolvePollutant,
  type PollutantSelection,
} from "@/lib/data"
import {
  STANDARD_WINDOW,
  getDailySeries,
  getDailySeriesAll,
  getExceedance,
  getOverviewKpis,
  getOverviewStations,
  previousYearRange,
  type OverviewDB,
} from "@/lib/overview-data"
import { useOverviewData } from "@/lib/use-overview-data"
import { DailyTrendChart, ExceedanceChart, IspuDistributionChart, MultiTrendChart, YoyChart } from "./overview-charts"

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(v.length, 1)
const fmtCount = (n: number) => formatId(n, Number.isInteger(n) ? 0 : 1)

function Header() {
  return (
    <PageHeader
      eyebrow="01 · Overview"
      title="Overview Kualitas Udara"
      description="Ringkasan konsentrasi polutan, jumlah hari melampaui baku mutu, dan kategori ISPU per stasiun AQMS."
      dummy={false}
    />
  )
}

export function OverviewDashboard() {
  const { db, error, loading } = useOverviewData()

  if (db) return <OverviewContent db={db} />

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:p-8">
      <Header />
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground" role="status">
        {loading ? "Memuat data kualitas udara…" : `Data tidak dapat dimuat. ${error ?? ""}`}
      </div>
    </div>
  )
}

function OverviewContent({ db }: { db: OverviewDB }) {
  const { region, pollutant: rawSelection, range } = useFilters()
  const selection = rawSelection as PollutantSelection
  const isAll = selection === "ALL"
  // Panel/hitungan yang hanya cocok untuk satu polutan memakai PM2.5 saat "Semua polutan"
  const pollutant = resolvePollutant(selection)
  const [selected, setSelected] = useState<string | null>(null)

  const pol = getPollutant(pollutant)
  const reg = getRegion(region)
  const prevRange = useMemo(() => previousYearRange(range), [range])

  const kpi = useMemo(() => getOverviewKpis(db, { region, pollutant, range }), [db, region, pollutant, range])
  const daily = useMemo(() => getDailySeries(db, { region, pollutant, range }), [db, region, pollutant, range])
  const dailyAll = useMemo(
    () => (isAll ? getDailySeriesAll(db, { region, range }) : []),
    [db, isAll, region, range],
  )
  const allKpis = useMemo(
    () =>
      isAll ? POLLUTANTS.map((p) => ({ p, ...getOverviewKpis(db, { region, pollutant: p.value, range }) })) : [],
    [db, isAll, region, range],
  )
  const exceed = useMemo(() => getExceedance(db, { region, range }), [db, region, range])
  const stations = useMemo(
    () => getOverviewStations(db, region, range, selection),
    [db, region, range, selection],
  )

  // Stasiun terpilih yang sudah tidak ada di wilayah/periode ini dianggap tidak terpilih
  const selectedStation = stations.find((s) => s.code === selected)
  const withData = stations.filter((s) => s.hasData)
  const chartStations = selectedStation ? withData.filter((s) => s.code === selectedStation.code) : withData

  // Ringkasan KPI untuk mode "Semua polutan"
  const okAll = allKpis.filter((k) => k.avg != null)
  const avgPct = isAll && okAll.length ? mean(okAll.map((k) => ((k.avg as number) / k.p.standard) * 100)) : null
  const worst = isAll
    ? allKpis.reduce<(typeof allKpis)[number] | null>(
        (a, b) => (b.above != null && (a == null || a.above == null || b.above > a.above) ? b : a),
        null,
      )
    : null
  const yoyAll = isAll ? allKpis.map((k) => k.yoy).filter((v): v is number => v != null) : []
  const yoy: number | null = isAll ? (yoyAll.length ? Math.round(mean(yoyAll) * 10) / 10 : null) : kpi.yoy
  const worse = (yoy ?? 0) >= 0
  const stationCount = kpi.stationCount

  const selectedNotice = selectedStation && !selectedStation.hasData
    ? selectedStation.status === "Defective"
      ? `${selectedStation.fullName}: stasiun rusak/nonaktif, tidak ada data yang tersedia.`
      : `${selectedStation.fullName}: tidak ada data pada rentang tanggal ini.`
    : null

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:p-8">
      <Header />
      <FilterBar show={["region", "pollutant", "period"]} note={`Default = Kalimantan, PM2.5, ${formatRangeShort(DEFAULT_RANGE)}`} />

      <div className="grid gap-4 sm:grid-cols-3">
        {isAll ? (
          <KpiCard
            label="Rata-rata terhadap baku mutu"
            value={avgPct == null ? "–" : `${formatId(avgPct)}%`}
            caption={`6 polutan · ${reg.label} · ${formatRangeShort(range)}`}
            icon={<Gauge className="size-4" aria-hidden />}
          />
        ) : (
          <KpiCard
            label={`Rata-rata ${pol.label} (µg/m³)`}
            value={kpi.avg == null ? "–" : formatId(kpi.avg)}
            caption={`${reg.label} · ${formatRangeShort(range)}`}
            icon={<Gauge className="size-4" aria-hidden />}
          />
        )}
        {isAll ? (
          <KpiCard
            label="Hari di atas baku mutu (terbanyak)"
            value={
              worst && worst.above != null ? (
                <>
                  {fmtCount(worst.above)}{" "}
                  <span className="text-lg font-semibold text-muted-foreground">dari {worst.days} hari</span>
                </>
              ) : (
                "–"
              )
            }
            caption={
              worst && worst.above != null
                ? `Polutan terbanyak: ${worst.p.label} · rata-rata ${worst.stationCount} stasiun`
                : "Tidak ada stasiun berdata"
            }
            tone="warning"
            icon={<CalendarClock className="size-4" aria-hidden />}
          />
        ) : (
          <KpiCard
            label="Hari di atas baku mutu"
            value={
              kpi.above == null ? (
                "–"
              ) : (
                <>
                  {fmtCount(kpi.above)}{" "}
                  <span className="text-lg font-semibold text-muted-foreground">dari {kpi.days} hari</span>
                </>
              )
            }
            caption={`Rata-rata ${stationCount} stasiun · BM ${STANDARD_WINDOW[pollutant]}: ${pol.standard.toLocaleString("id-ID")} µg/m³`}
            tone="warning"
            icon={<CalendarClock className="size-4" aria-hidden />}
          />
        )}
        <KpiCard
          label="Perubahan YoY"
          value={
            yoy == null ? (
              "n/a"
            ) : (
              <span className="inline-flex items-center gap-2">
                {worse ? <TrendingUp className="size-6" aria-hidden /> : <TrendingDown className="size-6" aria-hidden />}
                {formatId(Math.abs(yoy))}%
                <span className="text-lg font-semibold">{worse ? "lebih buruk" : "lebih baik"}</span>
              </span>
            )
          }
          caption={
            yoy == null
              ? `Pembanding (${formatRangeShort(prevRange)}) belum tersedia`
              : `${isAll ? "Rata-rata 6 polutan" : "Stasiun berdata di kedua periode"} dibanding ${formatRangeShort(prevRange)}`
          }
          tone={yoy == null ? undefined : worse ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-2"
          title="Peta stasiun AQMS"
          subtitle="Warna = kategori ISPU terkini · klik stasiun untuk memfilter"
          action={
            selectedStation ? (
              <button
                onClick={() => setSelected(null)}
                className="rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-accent-foreground hover:bg-accent/70"
              >
                {selectedStation.name} ✕
              </button>
            ) : null
          }
        >
          <div className="h-72">
           <StationMap stations={stations} selected={selectedStation ? selected : null} onSelect={setSelected} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            {ISPU_CATEGORIES.map((c) => (
              <LegendDot key={c.key} color={c.color} label={c.label} />
            ))}
            {stations.some((s) => !s.hasData) && <LegendDot color="#9ca3af" label="Tanpa data" />}
          </div>
          {selectedNotice && (
            <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" role="status">
              {selectedNotice}
            </p>
          )}
        </Panel>
        <Panel
          className="lg:col-span-3"
          title={
            isAll
              ? `Tren harian semua polutan (% baku mutu) · ${reg.label}`
              : `Tren harian ${pol.label} (µg/m³) · ${reg.label}`
          }
          subtitle={
            isAll
              ? "100% = tepat di baku mutu masing-masing polutan"
              : "AQMS harian, rata-rata stasiun di wilayah terpilih"
          }
          action={
            isAll ? (
              <div className="hidden flex-wrap gap-x-3 gap-y-1 sm:flex">
                {POLLUTANTS.map((p) => (
                  <LegendDot key={p.value} color={POLLUTANT_COLORS[p.value]} label={p.label} shape="line" />
                ))}
              </div>
            ) : (
              <div className="hidden gap-3 sm:flex">
                <LegendDot color="var(--chart-1)" label={pol.label} shape="line" />
                <LegendDot color="var(--chart-4)" label={`Baku mutu (${pol.standard})`} shape="line" />
              </div>
            )
          }
        >
          {isAll ? (
            <MultiTrendChart data={dailyAll} />
          ) : (
            <DailyTrendChart
              data={daily}
              standard={pol.standard}
              label={pol.label}
              standardLabel={`Baku mutu ${STANDARD_WINDOW[pollutant]}`}
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Polutan vs baku mutu"
          subtitle="% hari-stasiun melampaui baku mutu"
          footnote={
            (isAll ? "Menampilkan 6 polutan sekaligus" : `Menampilkan 6 polutan; polutan terpilih (${pol.label}) disorot`) +
            ". CO & O₃ dibandingkan dengan baku mutu 8 jam memakai rata-rata harian (pendekatan)."
          }
        >
          <ExceedanceChart data={exceed} active={isAll ? "ALL" : pollutant} />
        </Panel>
        <Panel
          title="Distribusi kategori ISPU per stasiun"
          subtitle={
            isAll
              ? "Proporsi hari (0–100%) · sub-indeks tertinggi dari 6 polutan"
              : `Proporsi hari (0–100%) · sub-indeks ${pol.label}`
          }
        >
          <IspuDistributionChart stations={chartStations} />
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
            {ISPU_CATEGORIES.map((c) => (
              <LegendDot key={c.key} color={c.color} label={c.label} shape="square" />
            ))}
          </div>
        </Panel>
        <Panel
          title="Perubahan konsentrasi YoY per stasiun"
          subtitle={`Kanan (+) memburuk · kiri (−) membaik${isAll ? " · acuan PM2.5" : ""}`}
          footnote="Garis acuan 0% · stasiun tanpa data di kedua periode tidak ditampilkan"
        >
          <YoyChart stations={chartStations} />
        </Panel>
      </div>
    </div>
  )
}
