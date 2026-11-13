"use client"

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { DISEASES, VULNERABILITY, type Disease, type Hospital } from "@/lib/data"

export function PmVsCasesChart({ data, disease }: { data: { day: string; pm: number; cases: number }[]; disease: string }) {
  const config = {
    pm: { label: "PM2.5 (µg/m³)", color: "var(--warning)" },
    cases: { label: `Kasus ${disease}/hari`, color: "var(--chart-1)" },
  } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <LineChart data={data} margin={{ left: -12, right: -12, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} interval={5} tickMargin={8} />
        <YAxis yAxisId="pm" tickLine={false} axisLine={false} width={44} />
        <YAxis yAxisId="cases" orientation="right" tickLine={false} axisLine={false} width={44} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line yAxisId="pm" dataKey="pm" type="monotone" stroke="var(--color-pm)" strokeWidth={2.5} dot={false} />
        <Line yAxisId="cases" dataKey="cases" type="monotone" stroke="var(--color-cases)" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}

export function VulnerabilityChart({ active }: { active: string }) {
  const config = {
    balita: { label: "Balita (<5 th)", color: "var(--warning)" },
    lansia: { label: "Lansia (>60 th)", color: "var(--chart-3)" },
  } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <BarChart data={VULNERABILITY} margin={{ left: -16, right: 8, top: 18 }} barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="pollutant" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={44} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {(["balita", "lansia"] as const).map((k) => (
          <Bar key={k} dataKey={k} radius={[4, 4, 0, 0]} barSize={14}>
            {VULNERABILITY.map((v) => (
              <Cell key={v.key} fill={`var(--color-${k})`} fillOpacity={v.key === active ? 1 : 0.3} />
            ))}
            <LabelList dataKey={k} position="top" fontSize={10} className="fill-foreground" />
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  )
}

export function DiseaseTotalsChart({ data, active }: { data: { disease: Disease; total: number }[]; active: Disease }) {
  const config = { total: { label: "Total kasus", color: "var(--chart-1)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 48 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} />
        <YAxis dataKey="disease" type="category" width={104} tickLine={false} axisLine={false} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="total" barSize={16} radius={4}>
          {data.map((d) => (
            <Cell key={d.disease} fill={d.disease === active ? "var(--chart-1)" : "var(--subtle)"} />
          ))}
          <LabelList
            dataKey="total"
            position="right"
            formatter={(v) => Number(v).toLocaleString("id-ID")}
            className="fill-foreground"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

const DISEASE_KEYS = ["ispa", "kardio", "asma", "ppok", "kematian"] as const

export function HospitalShareChart({ hospitals, active }: { hospitals: Hospital[]; active: Disease }) {
  const activeIdx = DISEASES.findIndex((d) => d.value === active)
  const data = hospitals.map((h) => ({
    code: h.code,
    ...Object.fromEntries(DISEASE_KEYS.map((k, i) => [k, h.share[i]])),
  }))
  const greys = ["var(--chart-3)", "oklch(0.62 0.02 230)", "oklch(0.74 0.015 230)", "oklch(0.84 0.01 230)"]
  let greyIdx = 0
  const config = Object.fromEntries(
    DISEASE_KEYS.map((k, i) => [
      k,
      { label: DISEASES[i].value, color: i === activeIdx ? "var(--chart-1)" : greys[greyIdx++ % greys.length] },
    ]),
  ) satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(200, data.length * 30 + 40) }}>
      <BarChart data={data} layout="vertical" stackOffset="expand" margin={{ left: 0, right: 8 }}>
        <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} />
        <YAxis dataKey="code" type="category" width={76} tickLine={false} axisLine={false} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {DISEASE_KEYS.map((k) => (
          <Bar key={k} dataKey={k} stackId="a" fill={`var(--color-${k})`} barSize={16} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

export function hospitalLegend(active: Disease) {
  const activeIdx = DISEASES.findIndex((d) => d.value === active)
  const greys = ["var(--chart-3)", "oklch(0.62 0.02 230)", "oklch(0.74 0.015 230)", "oklch(0.84 0.01 230)"]
  let g = 0
  return DISEASES.map((d, i) => ({ label: d.value, color: i === activeIdx ? "var(--chart-1)" : greys[g++ % greys.length] }))
}
