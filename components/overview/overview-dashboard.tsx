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
  getDailySeries,
  getDailySeriesAll,
  getExceedance,
  getOverviewKpis,
  getOverviewStations,
  getPollutant,
  getRegion,
  previousYearRange,
  resolvePollutant,
  type PollutantSelection,
} from "@/lib/data"
import { DailyTrendChart, ExceedanceChart, IspuDistributionChart, MultiTrendChart, YoyChart } from "./overview-charts"

export function OverviewDashboard() {
  const { region, pollutant: rawSelection, range } = useFilters()
  const selection = rawSelection as PollutantSelection
  const isAll = selection === "ALL"
  // Panel/hitungan yang hanya cocok untuk satu polutan memakai PM2.5 saat "Semua polutan"
  const pollutant = resolvePollutant(selection)
  const [selected, setSelected] = useState<string | null>(null)

  const pol = getPollutant(pollutant)
  const reg = getRegion(region)
  const kpi = useMemo(() => getOverviewKpis({ region, pollutant, range }), [region, pollutant, range])
  const daily = useMemo(() => getDailySeries({ region, pollutant, range }), [region, pollutant, range])
  const dailyAll = useMemo(() => (isAll ? getDailySeriesAll({ region, range }) : []), [isAll, region, range])
  const allKpis = useMemo(
    () =>
      isAll
        ? POLLUTANTS.map((p) => ({ p, ...getOverviewKpis({ region, pollutant: p.value, range }) }))
        : [],
    [isAll, region, range],
  )
  const exceed = useMemo(() => getExceedance({ region, range }), [region, range])
  // Semua stasiun di wilayah (termasuk yang tanpa data → tetap tampil di peta, abu-abu)
  const stations = useMemo(() => getOverviewStations({ region, selection, range }), [region, selection, range])
  const withData = useMemo(() => stations.filter((s) => s.hasData), [stations])
  const selectedStation = stations.find((s) => s.code === selected)
  // Grafik bawah: hanya stasiun yang punya data; diurutkan dari ISPU rata-rata tertinggi
  const tableStations = useMemo(() => {
    const list = selected ? withData.filter((s) => s.code === selected) : withData
    return [...list].sort((a, b) => b.ispuNow - a.ispuNow)
  }, [selected, withData])

  const hasData = isAll ? allKpis.some((k) => k.hasData) : kpi.hasData
  const stationCount = isAll ? Math.max(0, ...allKpis.map((k) => k.stationCount)) : kpi.stationCount

  // Ringkasan KPI untuk mode "Semua polutan"
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(v.length, 1)
  const avgPct = isAll && hasData ? mean(allKpis.filter((k) => k.hasData).map((k) => (k.avg / k.p.standard) * 100)) : 0
  const worstDays = isAll && hasData ? allKpis.reduce((a, b) => (b.above > a.above ? b : a), allKpis[0]) : null
  const yoyList = isAll ? allKpis.map((k) => k.yoy).filter(Number.isFinite) : []
  const yoy = isAll ? (yoyList.length ? Math.round(mean(yoyList) * 10) / 10 : NaN) : kpi.yoy
  const yoyOk = Number.isFinite(yoy)
  const worse = yoy >= 0
  const prevYear = previousYearRange(range).from.slice(0, 4)
  const noData = (s: { status: string }) =>
    s.status === "Defective"
      ? "Stasiun ini rusak (Defective) — tidak ada data yang tersedia."
      : "Stasiun ini belum punya data pada rentang tanggal terpilih."

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:p-8">
      <PageHeader
        eyebrow="01 · Overview"
        title="Overview Kualitas Udara"
        description="Ringkasan konsentrasi polutan, jumlah hari melampaui baku mutu, dan kategori ISPU per stasiun AQMS."
      />
      <FilterBar show={["region", "pollutant", "period"]} note={`Default = Kalimantan, PM2.5, ${formatRangeShort(DEFAULT_RANGE)}`} />

      {!hasData && (
        <div role="status" className="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground">
          Belum ada data AQMS untuk {reg.label} pada {formatRangeShort(range)}. Coba ubah wilayah atau rentang tanggal.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {isAll ? (
          <KpiCard
            label="Rata-rata terhadap baku mutu"
            value={hasData ? `${formatId(avgPct)}%` : "–"}
            caption={`6 polutan · ${reg.label} · ${formatRangeShort(range)}`}
            icon={<Gauge className="size-4" aria-hidden />}
          />
        ) : (
          <KpiCard
            label={`Rata-rata ${pol.label} (µg/m³)`}
            value={hasData ? formatId(kpi.avg) : "–"}
            caption={`${reg.label} · ${formatRangeShort(range)}`}
            icon={<Gauge className="size-4" aria-hidden />}
          />
        )}
        {isAll && worstDays ? (
          <KpiCard
            label="Hari di atas baku mutu (terbanyak)"
            value={
              <>
                {worstDays.above}{" "}
                <span className="text-lg font-semibold text-muted-foreground">dari {worstDays.days} hari</span>
              </>
            }
            caption={`Polutan terbanyak: ${worstDays.p.label} · rata-rata ${worstDays.stationCount} stasiun`}
            tone="warning"
            icon={<CalendarClock className="size-4" aria-hidden />}
          />
        ) : (
          <KpiCard
            label="Hari di atas baku mutu"
            value={
              <>
                {kpi.above} <span className="text-lg font-semibold text-muted-foreground">dari {kpi.days} hari</span>
              </>
            }
            caption={`Rata-rata ${stationCount} stasiun · BM 24 jam: ${pol.standard.toLocaleString("id-ID")} µg/m³`}
            tone="warning"
            icon={<CalendarClock className="size-4" aria-hidden />}
          />
        )}
        <KpiCard
          label="Perubahan YoY"
          value={
            yoyOk ? (
              <span className="inline-flex items-center gap-2">
                {worse ? <TrendingUp className="size-6" aria-hidden /> : <TrendingDown className="size-6" aria-hidden />}
                {formatId(Math.abs(yoy))}%
                <span className="text-lg font-semibold">{worse ? "lebih buruk" : "lebih baik"}</span>
              </span>
            ) : (
              "N/A"
            )
          }
          caption={
            yoyOk
              ? isAll
                ? `Rata-rata 6 polutan dibanding periode yang sama tahun ${prevYear}`
                : `Dibanding periode yang sama tahun ${prevYear}`
              : "Data periode yang sama tahun sebelumnya belum tersedia"
          }
          tone={yoyOk ? (worse ? "danger" : "success") : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-2"
          title="Peta stasiun AQMS"
          subtitle="Warna = kategori ISPU rata-rata periode · abu-abu = tidak ada data · klik stasiun untuk memfilter"
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
            <StationMap stations={stations} selected={selected} onSelect={setSelected} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            {ISPU_CATEGORIES.map((c) => (
              <LegendDot key={c.key} color={c.color} label={c.label} />
            ))}
            {stations.some((s) => !s.hasData) && <LegendDot color="#9ca3af" label="Tanpa data / nonaktif" />}
          </div>
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
              ? "100% = tepat di baku mutu 24 jam masing-masing polutan"
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
            <DailyTrendChart data={daily} standard={pol.standard} label={pol.label} />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Polutan vs baku mutu"
          subtitle="% hari melampaui baku mutu"
          footnote={
            isAll ? "Menampilkan 6 polutan sekaligus" : `Menampilkan 6 polutan; polutan terpilih (${pol.label}) disorot`
          }
        >
          <ExceedanceChart data={exceed} active={isAll ? "ALL" : pollutant} />
        </Panel>
        <Panel title="Distribusi kategori ISPU per stasiun" subtitle="Proporsi hari (0–100%)">
          {selectedStation && !selectedStation.hasData ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{noData(selectedStation)}</p>
          ) : (
            <IspuDistributionChart stations={tableStations} />
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
            {ISPU_CATEGORIES.map((c) => (
              <LegendDot key={c.key} color={c.color} label={c.label} shape="square" />
            ))}
          </div>
        </Panel>
        <Panel
          title="Perubahan konsentrasi YoY per stasiun"
          subtitle="Kanan (+) memburuk · kiri (−) membaik"
          footnote="Garis acuan 0%"
        >
          {selectedStation && !selectedStation.hasData ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{noData(selectedStation)}</p>
          ) : (
            <YoyChart stations={tableStations} />
          )}
        </Panel>
      </div>
    </div>
  )
}
