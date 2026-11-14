"use client"

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { DiseaseSelection } from "@/lib/data"
import { DISEASE_COLS, type HospitalRow } from "@/lib/health-data"

const fmt = (v: unknown) => (v == null ? "–" : Number(v).toLocaleString("id-ID"))

/* ---------- Grafik 1: dual-axis ---------- */
export function PmVsCasesChart({
  data,
  pollutantLabel,
  diseaseLabel,
}: {
  data: { day: string; pm: number | null; cases: number | null }[]
  pollutantLabel: string
  diseaseLabel: string
}) {
  const config = {
    pm: { label: `${pollutantLabel} (µg/m³)`, color: "var(--warning)" },
    cases: { label: `Kasus ${diseaseLabel}/hari`, color: "var(--chart-1)" },
  } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <LineChart data={data} margin={{ left: -12, right: -12, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
        <YAxis yAxisId="pm" tickLine={false} axisLine={false} width={44} />
        <YAxis yAxisId="cases" orientation="right" tickLine={false} axisLine={false} width={48} tickFormatter={fmt} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line yAxisId="pm" dataKey="pm" type="monotone" stroke="var(--color-pm)" strokeWidth={2.5} dot={false} />
        <Line yAxisId="cases" dataKey="cases" type="monotone" stroke="var(--color-cases)" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}

/* ---------- Grafik 2: kerentanan (β × 10) ---------- */
export function VulnerabilityChart({
  data,
  active,
}: {
  data: { pollutant: string; key: string; balita: number | null; lansia: number | null }[]
  active: string
}) {
  const config = {
    balita: { label: "Balita (<5 th)", color: "var(--warning)" },
    lansia: { label: "Lansia (>60 th)", color: "var(--chart-3)" },
  } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <BarChart data={data} margin={{ left: -16, right: 8, top: 18 }} barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="pollutant" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} width={44} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {(["balita", "lansia"] as const).map((k) => (
          <Bar key={k} dataKey={k} radius={[4, 4, 0, 0]} barSize={12}>
            {data.map((v) => (
              <Cell
                key={v.key}
                fill={v.key === active ? `var(--color-${k})` : "var(--subtle)"}
                fillOpacity={v.key === active ? 1 : 0.7}
              />
            ))}
            <LabelList
              dataKey={k}
              position="top"
              fontSize={9}
              className="fill-foreground"
              formatter={(v) => (v == null ? "" : Number(v).toLocaleString("id-ID"))}
            />
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  )
}

/* ---------- Grafik 3: akumulasi per penyakit ---------- */
export function DiseaseTotalsChart({
  data,
  active,
}: {
  data: { disease: string; label: string; total: number }[]
  active: DiseaseSelection
}) {
  const config = { total: { label: "Total kasus", color: "var(--chart-1)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 56 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={fmt} />
        <YAxis dataKey="label" type="category" width={104} tickLine={false} axisLine={false} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="total" barSize={16} radius={4}>
          {data.map((d) => (
            <Cell key={d.disease} fill={active === "ALL" || d.disease === active ? "var(--chart-1)" : "var(--subtle)"} />
          ))}
          <LabelList dataKey="total" position="right" formatter={fmt} className="fill-foreground" fontSize={11} />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

/* ---------- Proporsi per RS (100% stacked) ---------- */
const ALL_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]
const GREYS = ["var(--chart-3)", "oklch(0.62 0.02 230)", "oklch(0.74 0.015 230)", "oklch(0.84 0.01 230)"]

export function diseaseColors(active: DiseaseSelection) {
  if (active === "ALL") return DISEASE_COLS.map((d, i) => ({ ...d, color: ALL_COLORS[i] }))
  let g = 0
  return DISEASE_COLS.map((d) => ({ ...d, color: d.disease === active ? "var(--chart-1)" : GREYS[g++ % GREYS.length] }))
}

export function HospitalShareChart({ rows, active }: { rows: HospitalRow[]; active: DiseaseSelection }) {
  const cols = diseaseColors(active)
  const data = rows
    .filter((r) => r.hasData)
    .map((r) => ({ code: r.code, ...Object.fromEntries(cols.map((c, i) => [c.col, r.share[i]])) }))
  const config = Object.fromEntries(cols.map((c) => [c.col, { label: c.label, color: c.color }])) satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(200, data.length * 30 + 40) }}>
      <BarChart data={data} layout="vertical" stackOffset="expand" margin={{ left: 0, right: 8 }}>
        <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} />
        <YAxis dataKey="code" type="category" width={80} tickLine={false} axisLine={false} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {cols.map((c) => (
          <Bar key={c.col} dataKey={c.col} stackId="a" fill={`var(--color-${c.col})`} barSize={16} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
