"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { DEFAULT_RANGE, type DateRange, type Disease, type Pollutant, type Region } from "@/lib/data"

type FilterState = {
  region: Region
  pollutant: Pollutant
  range: DateRange
  disease: Disease
}

export const DEFAULT_FILTERS: FilterState = {
  region: "kalimantan",
  pollutant: "PM2.5",
  range: DEFAULT_RANGE,
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
      isDefault:
        state.region === DEFAULT_FILTERS.region &&
        state.pollutant === DEFAULT_FILTERS.pollutant &&
        state.disease === DEFAULT_FILTERS.disease &&
        state.range.from === DEFAULT_FILTERS.range.from &&
        state.range.to === DEFAULT_FILTERS.range.to,
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
