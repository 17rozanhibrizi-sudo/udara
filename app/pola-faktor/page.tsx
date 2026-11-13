import type { Metadata } from "next"
import { PolaDashboard } from "@/components/pola/pola-dashboard"

export const metadata: Metadata = { title: "Pola & Faktor · Gelar Rasa" }

export default function Page() {
  return <PolaDashboard />
}
