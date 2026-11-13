import type { Metadata } from "next"
import { OverviewDashboard } from "@/components/overview/overview-dashboard"

export const metadata: Metadata = { title: "Overview Kualitas Udara · Gelar Rasa" }

export default function Page() {
  return <OverviewDashboard />
}
