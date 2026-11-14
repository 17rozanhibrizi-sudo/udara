"use client"

import { useEffect, useState } from "react"
import { prepareHealth, type HealthDB, type RawHealth } from "@/lib/health-data"

// Diunduh sekali per sesi browser, dipakai bersama semua komponen
let cache: Promise<HealthDB> | null = null

function load() {
  if (!cache) {
    cache = fetch("/data/health.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Gagal memuat data (HTTP ${r.status})`)
        return r.json() as Promise<RawHealth>
      })
      .then(prepareHealth)
      .catch((e) => {
        cache = null
        throw e
      })
  }
  return cache
}

export function useHealthData() {
  const [state, setState] = useState<{ db: HealthDB | null; error: string | null }>({ db: null, error: null })

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
