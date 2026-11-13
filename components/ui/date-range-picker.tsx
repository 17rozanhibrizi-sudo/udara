"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import {
  DATA_MAX,
  DATA_MIN,
  MONTHS_LONG,
  RANGE_PRESETS,
  formatRange,
  formatRangeShort,
  parseISO,
  toISO,
  type DateRange,
} from "@/lib/data"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]

const monthIndex = (iso: string) => {
  const d = parseISO(iso)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}
const MIN_VIEW = monthIndex(DATA_MIN)
// Layar lebar (2 bulan): bulan kiri maksimal = bulan terakhir - 1. Layar sempit (1 bulan): sampai bulan terakhir.
const MAX_VIEW_WIDE = monthIndex(DATA_MAX) - 1

function MonthGrid({
  index,
  value,
  anchor,
  hover,
  onPick,
  onHover,
}: {
  index: number
  value: DateRange
  anchor: string | null
  hover: string | null
  onPick: (iso: string) => void
  onHover: (iso: string | null) => void
}) {
  const year = Math.floor(index / 12)
  const month = index % 12
  const first = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const offset = (first.getUTCDay() + 6) % 7 // Senin = 0

  // Rentang yang disorot: pratinjau (saat memilih tanggal akhir) atau nilai terpilih
  let lo = value.from
  let hi = value.to
  if (anchor) {
    const other = hover ?? anchor
    lo = anchor <= other ? anchor : other
    hi = anchor <= other ? other : anchor
  }

  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISO(new Date(Date.UTC(year, month, i + 1)))),
  ]

  return (
    <div className="w-[16.5rem]">
      <p className="mb-2 text-center text-sm font-semibold">
        {MONTHS_LONG[month]} {year}
      </p>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((iso, i) => {
          if (!iso) return <span key={`e${i}`} />
          const disabled = iso < DATA_MIN || iso > DATA_MAX
          const isStart = iso === lo
          const isEnd = iso === hi
          const inRange = iso >= lo && iso <= hi
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onPick(iso)}
              onMouseEnter={() => onHover(iso)}
              className={cn(
                "relative h-8 text-xs tabular-nums transition-colors",
                disabled && "cursor-not-allowed text-muted-foreground/40",
                !disabled && !inRange && "rounded-md hover:bg-muted",
                inRange && !isStart && !isEnd && "bg-primary/10 text-foreground",
                isStart && "rounded-l-md bg-primary font-semibold text-primary-foreground",
                isEnd && "rounded-r-md bg-primary font-semibold text-primary-foreground",
                isStart && isEnd && "rounded-md",
              )}
              aria-label={iso}
              aria-pressed={isStart || isEnd}
            >
              {Number(iso.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [view, setView] = useState(() => Math.min(Math.max(monthIndex(value.from), MIN_VIEW), MAX_VIEW_WIDE))
  const ref = useRef<HTMLDivElement>(null)

  // Layar lebar = 2 bulan, layar sempit = 1 bulan
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)")
    const sync = () => setWide(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  const maxView = wide ? MAX_VIEW_WIDE : MAX_VIEW_WIDE + 1
  const shownView = Math.min(view, maxView)

  const close = () => {
    setOpen(false)
    setAnchor(null)
    setHover(null)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const toggle = () => {
    if (open) return close()
    setView(Math.min(Math.max(monthIndex(value.from), MIN_VIEW), maxView))
    setOpen(true)
  }

  const pick = (iso: string) => {
    if (!anchor) {
      setAnchor(iso)
      return
    }
    onChange(anchor <= iso ? { from: anchor, to: iso } : { from: iso, to: anchor })
    close()
  }

  const activePreset = useMemo(
    () => RANGE_PRESETS.find((p) => p.range.from === value.from && p.range.to === value.to)?.label,
    [value],
  )

  return (
    <div ref={ref} className="relative flex min-w-0 flex-1 flex-col gap-1 sm:min-w-56">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <CalendarDays className="size-3" aria-hidden />
        Tanggal
      </span>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Rentang tanggal"
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-card px-3 text-sm shadow-xs outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="truncate">{formatRangeShort(value)}</span>
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pilih rentang tanggal"
          className="absolute top-full left-0 z-50 mt-2 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg"
          onMouseLeave={() => setHover(null)}
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  onChange(p.range)
                  close()
                }}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  activePreset === p.label
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-start gap-1">
            <button
              type="button"
              onClick={() => setView(Math.max(shownView - 1, MIN_VIEW))}
              disabled={shownView <= MIN_VIEW}
              aria-label="Bulan sebelumnya"
              className="mt-0.5 rounded-md p-1 hover:bg-muted disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="flex flex-col gap-4 sm:flex-row">
              <MonthGrid
                index={shownView}
                value={value}
                anchor={anchor}
                hover={hover}
                onPick={pick}
                onHover={setHover}
              />
              {wide && (
                <MonthGrid
                  index={shownView + 1}
                  value={value}
                  anchor={anchor}
                  hover={hover}
                  onPick={pick}
                  onHover={setHover}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => setView(Math.min(shownView + 1, maxView))}
              disabled={shownView >= maxView}
              aria-label="Bulan berikutnya"
              className="mt-0.5 rounded-md p-1 hover:bg-muted disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
            {anchor ? "Pilih tanggal akhir (klik tanggal yang sama untuk satu hari)" : "Klik tanggal awal, lalu tanggal akhir"}
            {" · "}Data tersedia {formatRange({ from: DATA_MIN, to: DATA_MAX })}
          </p>
        </div>
      )}
    </div>
  )
}
</document_content>
</document>
<invoke name="present_files">
<parameter name="filepaths">["/mnt/user-data/outputs/date-range-picker.tsx"]
