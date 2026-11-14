"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  Scatter,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { LOCATION_TYPES } from "@/lib/data"

const nf = (v: unknown, d = 1) => Number(v).toLocaleString("id-ID", { maximumFractionDigits: d })

function Empty({ text, className = "h-56" }: { text: string; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-md border border-dashed px-4 text-center text-xs text-muted-foreground ${className}`}
    >
      {text}
    </div>
  )
}

/** Pola harian per jam (0–23 WIB). value = null bila tidak ada data pada jam itu. */
export function HourlyChart({ data, peak }: { data: { hour: string; value: number | null }[]; peak: string | null }) {
  const config = { value: { label: "Konsentrasi", color: "var(--chart-1)" } } satisfies ChartConfig
  if (data.every((d) => d.value == null)) return <Empty text="Tidak ada data per jam pada wilayah & rentang tanggal ini." />
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <AreaChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="hourFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="hour" tickLine={false} axisLine={false} interval={2} tickFormatter={(v) => `${v}:00`} />
        <YAxis tickLine={false} axisLine={false} width={44} />
        {peak && <ReferenceLine x={peak} stroke="var(--destructive)" strokeDasharray="4 4" />}
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => `Pukul ${v}.00 WIB`} />} />
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2.5}
          fill="url(#hourFill)"
          connectNulls={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

/** Pola periodik: per hari / minggu / bulan (granularitas ditentukan di lib/pola-data.ts). */
export function PeriodChart({ data }: { data: { label: string; value: number | null }[] }) {
  const vals = data.map((d) => d.value).filter((v): v is number => v != null)
  if (!vals.length) return <Empty text="Tidak ada data pada wilayah & rentang tanggal ini." />
  const max = Math.max(...vals)
  const config = { value: { label: "Rata-rata", color: "var(--chart-1)" } } satisfies ChartConfig
  const dense = data.length > 12
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ left: -16, right: 8, top: 20 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval={dense ? "preserveStartEnd" : 0} minTickGap={12} />
        <YAxis tickLine={false} axisLine={false} width={44} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={dense ? undefined : 44}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.value != null && d.value === max ? "var(--warning)" : "var(--chart-1)"} />
          ))}
          {!dense && (
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v) => (v == null ? "" : nf(v))}
              className="fill-foreground"
              fontSize={11}
              fontWeight={600}
            />
          )}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

export type CorrRow = { factor: string; key: string; r: number | null }

/**
 * Korelasi Pearson (diverging bar).
 * active = faktor pada scatter (biru), dominant = |r| terbesar (oranye bila berbeda dari active).
 */
export function CorrelationChart({
  rows,
  active,
  dominant,
  onSelect,
}: {
  rows: CorrRow[]
  active: string
  dominant: string | null
  onSelect: (key: string) => void
}) {
  const config = { r: { label: "Koefisien r", color: "var(--chart-1)" } } satisfies ChartConfig
  const data = rows.map((c) => ({ ...c, v: c.r ?? 0, text: c.r == null ? "n/a" : `${c.r > 0 ? "+" : ""}${c.r.toFixed(2)}` }))
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tickLine={false} axisLine={false} />
        <YAxis dataKey="factor" type="category" width={128} tickLine={false} axisLine={false} fontSize={11} />
        <ReferenceLine x={0} stroke="var(--muted-foreground)" />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar
          dataKey="v"
          barSize={16}
          radius={4}
          className="cursor-pointer"
          onClick={(d) => {
            const key = (d as unknown as { payload?: { key: string } }).payload?.key
            if (key) onSelect(key)
          }}
        >
          {data.map((c) => (
            <Cell
              key={c.key}
              fill={c.key === active ? "var(--chart-1)" : c.key === dominant ? "var(--warning)" : "var(--subtle)"}
            />
          ))}
          <LabelList dataKey="text" position="right" className="fill-foreground" fontSize={11} />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

export const TYPE_COLORS: Record<(typeof LOCATION_TYPES)[number], string> = {
  "Tepi gambut": "var(--warning)",
  Perkotaan: "var(--chart-5)",
  "Tepi jalan": "oklch(0.55 0.18 300)",
  Industri: "var(--chart-3)",
  "Latar bersih": "var(--success)",
}

export function ScatterFactorChart({
  points,
  line,
  xLabel,
}: {
  points: { x: number; y: number; type: string }[]
  line: { x: number; y: number }[]
  xLabel: string
}) {
  const config = Object.fromEntries(
    LOCATION_TYPES.map((t) => [t.replace(/\s/g, ""), { label: t, color: TYPE_COLORS[t] }]),
  ) satisfies ChartConfig
  if (!points.length) return <Empty text="Tidak ada data pada wilayah & rentang tanggal ini." className="h-64" />

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <ComposedChart margin={{ left: -8, right: 12, top: 8, bottom: 12 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="x"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => nf(v, 2)}
          label={{ value: xLabel, position: "insideBottom", offset: -8, fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <YAxis dataKey="y" type="number" tickLine={false} axisLine={false} width={44} />
        <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltipContent hideLabel />} />
        {LOCATION_TYPES.map((t) => (
          <Scatter
            key={t}
            name={t}
            data={points.filter((p) => p.type === t)}
            fill={TYPE_COLORS[t]}
            isAnimationActive={false}
          />
        ))}
        {line.length === 2 && (
          <Line
            data={line}
            dataKey="y"
            type="linear"
            stroke="var(--destructive)"
            strokeDasharray="6 4"
            strokeWidth={2}
            dot={false}
            activeDot={false}
            legendType="none"
            tooltipType="none"
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  )
}
