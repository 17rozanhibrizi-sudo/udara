"use client"

import { useEffect, useState } from "react"
import { prepareDB, type OverviewDB, type RawOverview } from "@/lib/overview-data"

// Diunduh sekali per sesi browser, dipakai bersama oleh semua komponen
let cache: Promise<OverviewDB> | null = null

function load() {
  if (!cache) {
    cache = fetch("/data/overview.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Gagal memuat data (HTTP ${r.status})`)
        return r.json() as Promise<RawOverview>
      })
      .then(prepareDB)
      .catch((e) => {
        cache = null // izinkan coba lagi
        throw e
      })
  }
  return cache
}

export function useOverviewData() {
  const [state, setState] = useState<{ db: OverviewDB | null; error: string | null }>({ db: null, error: null })

  useEffect(() => {
    let alive = true
    load()
      .then((db) => alive && setState({ db, error: null }))
      .catch((e) => alive && setState({ db: null, error: e instanceof Error ? e.message : String(e) }))
    return () => {
      alive = false
    }
  }, [])

  return { ...state, loading: !state.db && !state.error }
}
