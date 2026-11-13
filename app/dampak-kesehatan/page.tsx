import type { Metadata } from "next"
import { HealthDashboard } from "@/components/dampak/health-dashboard"

export const metadata: Metadata = { title: "Dampak Kesehatan · Gelar Rasa" }

export default function Page() {
  return <HealthDashboard />
}
