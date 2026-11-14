"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useMemo } from "react"
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet"
import { divIcon, latLngBounds } from "leaflet"
import { COVERAGE_KM, type Proposal, type WilayahRow } from "@/lib/evaluasi-data"

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length) map.fitBounds(latLngBounds(points), { padding: [36, 36], maxZoom: 8 })
  }, [map, points])
  return null
}

const STAR = divIcon({
  className: "",
  html: '<div style="color:#f2b632;font-size:24px;line-height:24px;text-shadow:0 0 3px #fff,0 0 3px #fff">★</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const TEAL = "#0f766e"
const GREY = "#9ca3af"
const RED = "#dc2626"

/** Layer 1: stasiun eksisting · Layer 3: radius 30 & 50 km · Layer 4: usulan stasiun baru. (Tidak ada layer RS: dataset tanpa koordinat RS.) */
export default function EvaluasiMapInner({ stations, proposals }: { stations: WilayahRow[]; proposals: Proposal[] }) {
  const points = useMemo(
    () => [...stations.map((s) => [s.lat, s.lng] as [number, number]), ...proposals.map((p) => [p.lat, p.lng] as [number, number])],
    [stations, proposals],
  )
  return (
    <MapContainer center={[-1.5, 113]} zoom={6} scrollWheelZoom={false} className="h-full w-full rounded-lg" attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {stations
        .filter((s) => s.operational)
        .map((s) => (
          <Circle
            key={`r50-${s.code}`}
            center={[s.lat, s.lng]}
            radius={COVERAGE_KM.outer * 1000}
            pathOptions={{ color: TEAL, weight: 1, fillColor: TEAL, fillOpacity: 0.1, interactive: false }}
          />
        ))}
      {stations
        .filter((s) => s.operational)
        .map((s) => (
          <Circle
            key={`r30-${s.code}`}
            center={[s.lat, s.lng]}
            radius={COVERAGE_KM.inner * 1000}
            pathOptions={{ color: TEAL, weight: 1, dashArray: "4 4", fillOpacity: 0, interactive: false }}
          />
        ))}
      {stations.map((s) => (
        <CircleMarker
          key={s.code}
          center={[s.lat, s.lng]}
          radius={8}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            fillColor: !s.operational ? GREY : s.level === "Kritis" ? RED : TEAL,
            fillOpacity: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            <div className="text-xs">
              <strong>{s.name}</strong>
              <br />
              {s.code} · {s.status}
              <br />
              {s.operational ? `Kelengkapan ${s.completeness.toFixed(1)}%` : "Stasiun rusak/nonaktif"}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
      {proposals.map((p) => (
        <Marker key={`${p.lat}-${p.lng}`} position={[p.lat, p.lng]} icon={STAR}>
          <Tooltip direction="top" offset={[0, -10]}>
            <div className="text-xs">
              <strong>{p.label}</strong>
              <br />
              Titik indikatif ({p.lat.toFixed(2)}, {p.lng.toFixed(2)}), verifikasi lapangan
            </div>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  )
}
