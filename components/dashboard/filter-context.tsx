"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import type { Disease, Period, Pollutant, Region } from "@/lib/data"

type FilterState = {
  region: Region
  pollutant: Pollutant
  period: Period
  disease: Disease
}

export const DEFAULT_FILTERS: FilterState = {
  region: "kalimantan",
  pollutant: "PM2.5",
  period: "okt-2025",
  disease: "ISPA",
}

type FilterContextValue = FilterState & {
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  reset: () => void
  isDefault: boolean
}

const FilterContext = createContext<FilterContextValue | null>(null)

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FilterState>(DEFAULT_FILTERS)

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }, [])

  const reset = useCallback(() => setState(DEFAULT_FILTERS), [])

  const value = useMemo(
    () => ({
      ...state,
      setFilter,
      reset,
      isDefault: (Object.keys(DEFAULT_FILTERS) as (keyof FilterState)[]).every((k) => state[k] === DEFAULT_FILTERS[k]),
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
