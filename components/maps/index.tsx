"use client"

import dynamic from "next/dynamic"

function MapSkeleton() {
  return <div className="h-full w-full animate-pulse rounded-lg bg-muted" aria-label="Memuat peta" />
}

export const StationMap = dynamic(() => import("./station-map-inner"), { ssr: false, loading: MapSkeleton })
export const NetworkMap = dynamic(() => import("./network-map-inner"), { ssr: false, loading: MapSkeleton })
