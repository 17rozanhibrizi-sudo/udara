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
import { CORRELATIONS, LOCATION_TYPES } from "@/lib/data"

export function HourlyChart({ data, peak }: { data: { hour: string; value: number }[]; peak: string }) {
  const config = { value: { label: "Konsentrasi", color: "var(--chart-1)" } } satisfies ChartConfig
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
        <ReferenceLine x={peak} stroke="var(--destructive)" strokeDasharray="4 4" />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => `Pukul ${v}.00 WIB`} />} />
        <Area dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2.5} fill="url(#hourFill)" />
      </AreaChart>
    </ChartContainer>
  )
}

export function WeeklyChart({ data }: { data: { week: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value))
  const config = { value: { label: "Rata-rata", color: "var(--chart-1)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ left: -16, right: 8, top: 20 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} width={44} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={44}>
          {data.map((d) => (
            <Cell key={d.week} fill={d.value === max ? "var(--warning)" : "var(--chart-1)"} />
          ))}
          <LabelList dataKey="value" position="top" className="fill-foreground" fontSize={11} fontWeight={600} />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

export function CorrelationChart({ active, onSelect }: { active: string; onSelect: (factor: string) => void }) {
  const config = { r: { label: "Koefisien r", color: "var(--chart-1)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={CORRELATIONS} layout="vertical" margin={{ left: 0, right: 40 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tickLine={false} axisLine={false} />
        <YAxis dataKey="factor" type="category" width={128} tickLine={false} axisLine={false} fontSize={11} />
        <ReferenceLine x={0} stroke="var(--muted-foreground)" />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar
          dataKey="r"
          barSize={16}
          radius={4}
          className="cursor-pointer"
          onClick={(d) => {
            const factor = (d as unknown as { factor?: string; payload?: { factor: string } }).payload?.factor
            if (factor) onSelect(factor)
          }}
        >
          {CORRELATIONS.map((c) => (
            <Cell key={c.factor} fill={c.factor === active ? "var(--chart-1)" : "var(--subtle)"} />
          ))}
          <LabelList
            dataKey="r"
            position="right"
            formatter={(v) => `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2)}`}
            className="fill-foreground"
            fontSize={11}
          />
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
      </ComposedChart>
    </ChartContainer>
  )
}
