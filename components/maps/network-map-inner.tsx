"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useMemo } from "react"
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet"
import { divIcon, latLngBounds } from "leaflet"
import type { NetworkPoint } from "@/lib/data"

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length) map.fitBounds(latLngBounds(points), { padding: [28, 28], maxZoom: 7 })
  }, [map, points])
  return null
}

const STATION = "oklch(0.5 0.1 195)"
const HOSPITAL = "oklch(0.57 0.2 27)"

const starIcon = divIcon({
  className: "",
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  html: `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill="#f2b632" stroke="#7a5200" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
})

export default function NetworkMapInner({
  stations,
  proposed,
}: {
  stations: NetworkPoint[]
  proposed: NetworkPoint[]
}) {
  const points = useMemo(
    () => [...stations, ...proposed].map((p) => [p.lat, p.lng] as [number, number]),
    [stations, proposed],
  )

  return (
    <MapContainer center={[-2, 110]} zoom={5} scrollWheelZoom={false} className="h-full w-full rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {stations.map((s) => (
        <Circle
          key={`r-${s.name}`}
          center={[s.lat, s.lng]}
          radius={40000}
          pathOptions={{ color: STATION, weight: 1, fillColor: STATION, fillOpacity: 0.12 }}
        />
      ))}
      {stations.map((s, i) => (
        <CircleMarker
          key={`h-${s.name}`}
          center={[s.lat + (i % 2 ? 0.18 : -0.16), s.lng + (i % 3 ? 0.2 : -0.18)]}
          radius={4}
          pathOptions={{ color: "#fff", weight: 1, fillColor: HOSPITAL, fillOpacity: 1 }}
        >
          <Tooltip direction="top">RS rujukan · {s.name}</Tooltip>
        </CircleMarker>
      ))}
      {stations.map((s) => (
        <CircleMarker
          key={`s-${s.name}`}
          center={[s.lat, s.lng]}
          radius={5}
          pathOptions={{ color: "#fff", weight: 1.5, fillColor: STATION, fillOpacity: 1 }}
        >
          <Tooltip direction="top">Stasiun AQMS · {s.name}</Tooltip>
        </CircleMarker>
      ))}
      {proposed.map((p) => (
        <Marker key={p.name} position={[p.lat, p.lng]} icon={starIcon}>
          <Tooltip direction="top" offset={[0, -10]}>
            {p.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  )
}
