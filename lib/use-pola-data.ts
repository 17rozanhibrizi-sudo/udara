"use client"

import { useEffect, useState } from "react"
import type { Pollutant, Region } from "@/lib/data"
import {
  POLLUTANT_SLUG,
  preparePolaDB,
  prepareHourly,
  regionsToLoad,
  type HourlyData,
  type PolaDB,
  type RawHourly,
  type RawPola,
} from "@/lib/pola-data"

// Diunduh sekali per sesi browser lalu dipakai bersama
let dailyCache: Promise<PolaDB> | null = null
const hourlyCache = new Map<string, Promise<RawHourly>>()

function loadDaily() {
  if (!dailyCache) {
    dailyCache = fetch("/data/pola-daily.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Gagal memuat data harian (HTTP ${r.status})`)
        return r.json() as Promise<RawPola>
      })
      .then(preparePolaDB)
      .catch((e) => {
        dailyCache = null
        throw e
      })
  }
  return dailyCache
}

function loadHourly(key: string) {
  let p = hourlyCache.get(key)
  if (!p) {
    p = fetch(`/data/pola-hourly/${key}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Gagal memuat data per jam (HTTP ${r.status})`)
        return r.json() as Promise<RawHourly>
      })
      .catch((e) => {
        hourlyCache.delete(key)
        throw e
      })
    hourlyCache.set(key, p)
  }
  return p
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Data harian (konsentrasi, cuaca, profil stasiun): ±0,4 MB gzip, dimuat sekali. */
export function usePolaData() {
  const [state, setState] = useState<{ db: PolaDB | null; error: string | null }>({ db: null, error: null })
  useEffect(() => {
    let alive = true
    loadDaily()
      .then((db) => alive && setState({ db, error: null }))
      .catch((e) => alive && setState({ db: null, error: msg(e) }))
    return () => {
      alive = false
    }
  }, [])
  return { ...state, loading: !state.db && !state.error }
}

/** Data per jam untuk polutan + wilayah terpilih saja (nasional = 5 file wilayah). */
export function usePolaHourly(pollutant: Pollutant, region: Region) {
  const key = regionsToLoad(region)
    .map((r) => `${POLLUTANT_SLUG[pollutant]}-${r}`)
    .join("|")
  const [state, setState] = useState<{ key: string; hourly: HourlyData | null; error: string | null }>({
    key: "",
    hourly: null,
    error: null,
  })
  useEffect(() => {
    let alive = true
    Promise.all(key.split("|").map(loadHourly))
      .then((raws) => alive && setState({ key, hourly: prepareHourly(raws), error: null }))
      .catch((e) => alive && setState({ key, hourly: null, error: msg(e) }))
    return () => {
      alive = false
    }
  }, [key])
  const ready = state.key === key
  return { hourly: ready ? state.hourly : null, loading: !ready, error: ready ? state.error : null }
}
