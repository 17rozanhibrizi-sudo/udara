"use client"

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ISPU_CATEGORIES, type Station } from "@/lib/data"

export function DailyTrendChart({
  data,
  standard,
  label,
}: {
  data: { day: string; value: number; standard: number }[]
  standard: number
  label: string
}) {
  const config = {
    value: { label, color: "var(--chart-1)" },
    standard: { label: "Baku mutu 24 jam", color: "var(--chart-4)" },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <LineChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
       <XAxis dataKey="day" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={44} />
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
        />
      </LineChart>
    </ChartContainer>
  )
}

export function ExceedanceChart({
  data,
  active,
}: {
  data: { pollutant: string; key: string; value: number }[]
  active: string
}) {
  const config = { value: { label: "% hari melampaui", color: "var(--chart-1)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 36 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
        <YAxis dataKey="pollutant" type="category" width={48} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={4} barSize={16}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.key === active ? "var(--chart-1)" : "var(--subtle)"} />
          ))}
          <LabelList dataKey="value" position="right" formatter={(v) => `${v}%`} className="fill-foreground" fontSize={11} />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

export function IspuDistributionChart({ stations }: { stations: Station[] }) {
  const data = stations.map((s) => ({
    name: s.name,
    baik: s.ispu[0],
    sedang: s.ispu[1],
    tidakSehat: s.ispu[2],
    sangat: s.ispu[3],
    bahaya: s.ispu[4],
  }))
  const config = Object.fromEntries(ISPU_CATEGORIES.map((c) => [c.key, { label: c.label, color: c.color }])) satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(200, data.length * 30 + 40) }}>
      <BarChart data={data} layout="vertical" stackOffset="expand" margin={{ left: 0, right: 8 }}>
        <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} />
        <YAxis dataKey="name" type="category" width={120} tickLine={false} axisLine={false} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {ISPU_CATEGORIES.map((c, i) => (
          <Bar
            key={c.key}
            dataKey={c.key}
            stackId="a"
            fill={`var(--color-${c.key})`}
            barSize={16}
            radius={i === 0 ? [4, 0, 0, 4] : i === ISPU_CATEGORIES.length - 1 ? [0, 4, 4, 0] : 0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

export function YoyChart({ stations }: { stations: Station[] }) {
  const data = [...stations].sort((a, b) => b.yoy - a.yoy).map((s) => ({ name: s.name, yoy: s.yoy }))
  const config = { yoy: { label: "Perubahan YoY (%)", color: "var(--chart-4)" } } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(200, data.length * 30 + 40) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" domain={[-15, 30]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
        <YAxis dataKey="name" type="category" width={120} tickLine={false} axisLine={false} fontSize={11} />
        <ReferenceLine x={0} stroke="var(--muted-foreground)" />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="yoy" barSize={14} radius={4}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.yoy >= 0 ? "var(--destructive)" : "var(--success)"} />
          ))}
          <LabelList
            dataKey="yoy"
            position="right"
            formatter={(v) => `${Number(v) > 0 ? "+" : ""}${v}%`}
            className="fill-foreground"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
