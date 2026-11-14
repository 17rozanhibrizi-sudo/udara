"use client"

import { useEffect, useState } from "react"
import { prepareEvaluasi, type EvalDB, type RawEvaluasi } from "@/lib/evaluasi-data"

// Diunduh sekali per sesi browser, dipakai bersama oleh semua komponen
let cache: Promise<EvalDB> | null = null

function load() {
  if (!cache) {
    cache = fetch("/data/evaluasi.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Gagal memuat data evaluasi (HTTP ${r.status})`)
        return r.json() as Promise<RawEvaluasi>
      })
      .then(prepareEvaluasi)
      .catch((e) => {
        cache = null // izinkan coba lagi
        throw e
      })
  }
  return cache
}

export function useEvaluasiData() {
  const [state, setState] = useState<{ db: EvalDB | null; error: string | null }>({ db: null, error: null })

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
