import type { Metadata } from "next"
import { EvaluasiDashboard } from "@/components/evaluasi/evaluasi-dashboard"

export const metadata: Metadata = { title: "Evaluasi & Rekomendasi · Gelar Rasa" }

export default function Page() {
  return <EvaluasiDashboard />
}
