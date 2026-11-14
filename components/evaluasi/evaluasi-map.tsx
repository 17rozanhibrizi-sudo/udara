"use client"

import dynamic from "next/dynamic"

/** Leaflet butuh `window`, jadi dimuat hanya di browser. */
export const EvaluasiMap = dynamic(() => import("./evaluasi-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground" role="status">
      Memuat peta…
    </div>
  ),
})
