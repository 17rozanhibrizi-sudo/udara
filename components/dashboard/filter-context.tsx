"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { DATA_MAX, DATA_MIN, DEFAULT_RANGE, type DateRange, type Disease, type Pollutant, type Region } from "@/lib/data"

type FilterState = {
  region: Region
  pollutant: Pollutant
  range: DateRange
  disease: Disease
}

/** Kondisi awal saat halaman pertama dibuka: ringan (30 hari terakhir data). */
export const DEFAULT_FILTERS: FilterState = {
  region: "kalimantan",
  pollutant: "PM2.5",
  range: DEFAULT_RANGE,
  disease: "ISPA",
}

/**
 * Kondisi setelah tombol [Reset filter] sesuai spesifikasi:
 * Semua Wilayah, Semua Polutan, seluruh periode observasi.
 * "ALL" sudah didukung di runtime (POLLUTANT_OPTIONS + resolvePollutant); cast dipakai agar tipe Pollutant halaman lain tidak berubah.
 * Penyakit: "Semua Penyakit" ("ALL", lihat DISEASE_OPTIONS di lib/data.ts); cast dipakai agar tipe Disease tidak berubah.
 */
export const RESET_FILTERS: FilterState = {
  region: "nasional",
  pollutant: "ALL" as unknown as Pollutant,
  range: { from: DATA_MIN, to: DATA_MAX },
  disease: "ALL" as unknown as Disease,
}

type FilterContextValue = FilterState & {
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  reset: () => void
  /** true bila filter sudah sama dengan kondisi hasil Reset (tombol Reset dinonaktifkan) */
  isDefault: boolean
}

const FilterContext = createContext<FilterContextValue | null>(null)

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FilterState>(DEFAULT_FILTERS)

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }, [])

  const reset = useCallback(() => setState(RESET_FILTERS), [])

  const value = useMemo(
    () => ({
      ...state,
      setFilter,
      reset,
      isDefault:
        state.region === RESET_FILTERS.region &&
        state.pollutant === RESET_FILTERS.pollutant &&
        state.disease === RESET_FILTERS.disease &&
        state.range.from === RESET_FILTERS.range.from &&
        state.range.to === RESET_FILTERS.range.to,
    }),
    [state, setFilter, reset],
  )

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useFilters() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error("useFilters must be used inside FilterProvider")
  return ctx
}
