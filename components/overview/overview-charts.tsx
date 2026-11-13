"use client"

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ISPU_CATEGORIES, POLLUTANTS, POLLUTANT_COLORS, type Pollutant } from "@/lib/data"
import type { MultiRow, OverviewStation } from "@/lib/overview-data"

const nf = (v: unknown) => Number(v).toLocaleString("id-ID", { maximumFractionDigits: 1 })

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-md border border-dashed px-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  )
}

export function DailyTrendChart({
  data,
  standard,
  label,
  standardLabel = "Baku mutu",
}: {
  /** value = null bila tidak ada stasiun berdata pada hari itu (garis putus) */
  data: { day: string; value: number | null; standard: number }[]
  standard: number
  label: string
  standardLabel?: string
}) {
  const config = {
    value: { label, color: "var(--chart-1)" },
    standard: { label: standardLabel, color: "var(--chart-4)" },
  } satisfies ChartConfig

  if (data.every((d) => d.value == null)) return <Empty text="Tidak ada data pada wilayah & rentang tanggal ini." />

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <LineChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ReferenceLine
          y={standard}
          stroke="var(--color-standard)"
          strokeDasharray="6 4"
          strokeWidth={1.5}
          label={{ value: `BM ${standard}`, position: "insideTopRight", fill: "var(--color-standard)", fontSize: 11 }}
        />
        <Line
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls={false}
          isAnimationActive={data.length < 400}
        />
      </LineChart>
    </ChartContainer>
  )
}

/* Key aman untuk recharts / CSS variable (tanpa titik): "PM2.5" -> "PM25" */
const SAFE_KEY: Record<Pollutant, string> = {
  "PM2.5": "PM25",
  PM10: "PM10",
  CO: "CO",
  SO2: "SO2",
  NO2: "NO2",
  O3: "O3",
}

/** Mode "Semua polutan": satu garis per polutan, nilai dalam % baku mutu (100 = tepat di baku mutu) */
export function MultiTrendChart({ data }: { data: MultiRow[] }) {
  const config = Object.fromEntries(
    POLLUTANTS.map((p) => [SAFE_KEY[p.value], { label: p.label, color: POLLUTANT_COLORS[p.value] }]),
  ) satisfies ChartConfig

  const rows = data.map((r) => {
    const out: Record<string, string | number | undefined> = { label: r.label }
    POLLUTANTS.forEach((p) => {
      out[SAFE_KEY[p.value]] = r[p.value]
    })
    return out
  })

  if (data.every((r) => POLLUTANTS.every((p) => r[p.value] == null)))
    return <Empty text="Tidak ada data pada wilayah & rentang tanggal ini." />

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <LineChart data={rows} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v) => `${v}%`} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ReferenceLine
          y={100}
          stroke="var(--chart-4)"
          strokeDasharray="6 4"
          strokeWidth={1.5}
          label={{ value: "BM 100%", position: "insideTopRight", fill: "var(--chart-4)", fontSize: 11 }}
        />
        {POLLUTANTS.map((p) => (
          <Line
            key={p.value}
            dataKey={SAFE_KEY[p.value]}
            type="monotone"
            stroke={POLLUTANT_COLORS[p.value]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={rows.length < 400}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}

export function ExceedanceChart({
  data,
  active,
}: {
  data: { pollutant: string; key: string; value: number }[]
  /** key polutan yang disorot, atau "ALL" untuk menyorot semuanya */
  active: string
}) {
  const config = { value: { label: "% hari melampaui", color: "var(--chart-1)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
        <YAxis dataKey="pollutant" type="category" width={48} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={4} barSize={16}>
          {data.map((d) => (
            <Cell key={d.key} fill={active === "ALL" || d.key === active ? "var(--chart-1)" : "var(--subtle)"} />
          ))}
          <LabelList dataKey="value" position="right" formatter={(v) => `${nf(v)}%`} className="fill-foreground" fontSize={11} />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

const shortName = (n: string) => (n.length > 18 ? `${n.slice(0, 17)}…` : n)

/** Tinggi grafik per-stasiun: lebih rapat bila stasiunnya banyak */
function rowsHeight(n: number) {
  const pitch = n > 12 ? 24 : 30
  return Math.max(200, n * pitch + 40)
}

export function IspuDistributionChart({ stations }: { stations: OverviewStation[] }) {
  if (stations.length === 0) return <Empty text="Tidak ada stasiun berdata pada pilihan ini." />

  // urut: porsi hari tidak sehat atau lebih buruk paling besar di atas
  const data = [...stations]
    .sort((a, b) => b.ispu[2] + b.ispu[3] + b.ispu[4] - (a.ispu[2] + a.ispu[3] + a.ispu[4]))
    .map((s) => ({
      name: s.name,
      baik: s.ispu[0],
      sedang: s.ispu[1],
      tidakSehat: s.ispu[2],
      sangat: s.ispu[3],
      bahaya: s.ispu[4],
    }))
  const config = Object.fromEntries(ISPU_CATEGORIES.map((c) => [c.key, { label: c.label, color: c.color }])) satisfies ChartConfig
  const bar = data.length > 12 ? 12 : 16

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: rowsHeight(data.length) }}>
      <BarChart data={data} layout="vertical" stackOffset="expand" margin={{ left: 0, right: 8 }}>
        <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} />
        <YAxis dataKey="name" type="category" width={112} tickLine={false} axisLine={false} fontSize={11} tickFormatter={shortName} interval={0} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {ISPU_CATEGORIES.map((c, i) => (
          <Bar
            key={c.key}
            dataKey={c.key}
            stackId="a"
            fill={`var(--color-${c.key})`}
            barSize={bar}
            radius={i === 0 ? [4, 0, 0, 4] : i === ISPU_CATEGORIES.length - 1 ? [0, 4, 4, 0] : 0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

export function YoyChart({ stations }: { stations: OverviewStation[] }) {
  const data = stations
    .filter((s) => s.yoyOk)
    .sort((a, b) => b.yoy - a.yoy)
    .map((s) => ({ name: s.name, yoy: s.yoy }))

  if (data.length === 0)
    return <Empty text="Belum ada pembanding: stasiun tidak punya data pada periode yang sama tahun lalu." />

  const config = { yoy: { label: "Perubahan YoY (%)", color: "var(--chart-4)" } } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: rowsHeight(data.length) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 48 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          domain={[
            (min: number) => Math.min(0, Math.floor(min * 1.15)),
            (max: number) => Math.max(0, Math.ceil(max * 1.15)),
          ]}
          tickFormatter={(v) => `${v}%`}
          tickLine={false}
          axisLine={false}
        />
        <YAxis dataKey="name" type="category" width={112} tickLine={false} axisLine={false} fontSize={11} tickFormatter={shortName} interval={0} />
        <ReferenceLine x={0} stroke="var(--muted-foreground)" />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="yoy" barSize={data.length > 12 ? 10 : 14} radius={4}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.yoy >= 0 ? "var(--destructive)" : "var(--success)"} />
          ))}
          <LabelList
            dataKey="yoy"
            position="right"
            formatter={(v) => `${Number(v) > 0 ? "+" : ""}${nf(v)}%`}
            className="fill-foreground"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
