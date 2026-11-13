"use client"

import { FlaskConical, MapPin, RotateCcw, Stethoscope } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DISEASES, POLLUTANT_OPTIONS, REGIONS, type PollutantSelection } from "@/lib/data"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { useFilters } from "./filter-context"

type FilterKey = "region" | "pollutant" | "period" | "disease"

function FilterSelect<T extends string>({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string
  icon: React.ReactNode
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-44">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <Select value={value} onValueChange={(v) => v && onChange(v as T)} items={options}>
        <SelectTrigger className="h-9 w-full bg-card" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function FilterBar({ show, note }: { show: FilterKey[]; note?: string }) {
  const f = useFilters()

  return (
    <div className="relative z-30 rounded-xl border bg-card/70 p-3 shadow-xs backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {show.includes("region") && (
          <FilterSelect
            label="Wilayah"
            icon={<MapPin className="size-3" aria-hidden />}
            value={f.region}
            onChange={(v) => f.setFilter("region", v)}
            options={REGIONS.map((r) => ({ value: r.value, label: r.label }))}
          />
        )}
        {show.includes("pollutant") && (
          <FilterSelect<PollutantSelection>
            label="Polutan"
            icon={<FlaskConical className="size-3" aria-hidden />}
            value={f.pollutant as PollutantSelection}
            onChange={(v) => f.setFilter("pollutant", v as never)}
            options={POLLUTANT_OPTIONS}
          />
        )}
        {show.includes("disease") && (
          <FilterSelect
            label="Penyakit"
            icon={<Stethoscope className="size-3" aria-hidden />}
            value={f.disease}
            onChange={(v) => f.setFilter("disease", v)}
            options={DISEASES.map((d) => ({ value: d.value, label: d.value === "ISPA" ? "ISPA / Pernapasan" : d.value }))}
          />
        )}
        {show.includes("period") && <DateRangePicker value={f.range} onChange={(v) => f.setFilter("range", v)} />}
        <div className="flex items-center gap-3 sm:ml-auto">
          {note && <p className="hidden max-w-48 text-[11px] leading-snug text-muted-foreground xl:block">{note}</p>}
          <Button variant="outline" className="h-9" onClick={f.reset} disabled={f.isDefault}>
            <RotateCcw className="size-3.5" aria-hidden />
            Reset filter
          </Button>
        </div>
      </div>
    </div>
  )
}
