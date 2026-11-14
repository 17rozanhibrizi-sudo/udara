"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useMemo } from "react"
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet"
import { latLngBounds } from "leaflet"
import { ispuCategory, type Station } from "@/lib/data"

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length) map.fitBounds(latLngBounds(points), { padding: [36, 36], maxZoom: 7 })
  }, [map, points])
  return null
}

/** Station biasa, atau OverviewStation (punya hasData/status/fullName). Field ekstra opsional. */
type MapStation = Station & { hasData?: boolean; status?: string; fullName?: string }

const NO_DATA_COLOR = "#9ca3af"

export default function StationMapInner({
  stations,
  selected,
  onSelect,
}: {
  stations: MapStation[]
  selected: string | null
  onSelect: (code: string | null) => void
}) {
  const points = useMemo(() => stations.map((s) => [s.lat, s.lng] as [number, number]), [stations])

  return (
    <MapContainer
      center={[-1.5, 113]}
      zoom={6}
      scrollWheelZoom={false}
      className="h-full w-full rounded-lg"
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {/* stasiun tanpa data digambar lebih dulu agar stasiun berdata selalu di atasnya */}
      {[...stations]
        .sort((x, y) => Number(y.hasData === false) - Number(x.hasData === false))
        .map((s) => {
        const noData = s.hasData === false
        const cat = ispuCategory(s.ispuNow)
        const isSel = selected === s.code
        return (
          <CircleMarker
            key={s.code}
            center={[s.lat, s.lng]}
            radius={isSel ? 13 : 10}
            pathOptions={{
              color: "#ffffff",
              weight: isSel ? 3 : 2,
              fillColor: noData
                ? NO_DATA_COLOR
                : cat.color.startsWith("var")
                  ? getComputedColor(cat.color)
                  : cat.color,
              fillOpacity: selected && !isSel ? 0.45 : 0.95,
            }}
            eventHandlers={{ click: () => onSelect(isSel ? null : s.code) }}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent={isSel}>
              <div className="text-xs">
                <p className="font-semibold">{s.fullName ?? s.name}</p>
                {noData ? (
                  <p>{s.status === "Defective" ? "Stasiun rusak/nonaktif" : "Tanpa data pada periode ini"}</p>
                ) : (
                  <p>
                    ISPU {Math.round(s.ispuNow)} · {cat.label}
                  </p>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}

function getComputedColor(cssVar: string) {
  const name = cssVar.slice(4, -1)
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#2563eb"
}
