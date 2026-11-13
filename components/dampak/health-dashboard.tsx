"use client"

import { Baby, Clock, Users } from "lucide-react"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { useFilters } from "@/components/dashboard/filter-context"
import { KpiCard, LegendDot, PageHeader, Panel } from "@/components/dashboard/widgets"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getDiseaseTotals, getHealthKpis, getHealthSeries, getHospitals, getPollutant } from "@/lib/data"
import {
  DiseaseTotalsChart,
  HospitalShareChart,
  PmVsCasesChart,
  VulnerabilityChart,
  hospitalLegend,
} from "./health-charts"

export function HealthDashboard() {
  const { region, pollutant, period, disease } = useFilters()
  const kpi = getHealthKpis(region, disease)
  const series = getHealthSeries({ region, pollutant, period }, disease)
  const totals = getDiseaseTotals(region)
  const hospitals = getHospitals(region)
  const pol = getPollutant(pollutant)

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:p-8">
      <PageHeader
        eyebrow="03 · Dampak Kesehatan"
        title="Dampak Kesehatan"
        description="Hubungan paparan polutan dengan kunjungan rumah sakit, kelompok rentan, dan jeda waktu reaksi pasien."
      />
      <FilterBar show={["region", "pollutant", "disease", "period"]} />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total kasus kesehatan"
          value={
            <>
              {kpi.total.toLocaleString("id-ID")} <span className="text-lg font-semibold text-muted-foreground">pasien</span>
            </>
          }
          caption={`${disease} · tidak berubah saat polutan diganti`}
          icon={<Users className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Kelompok paling rentan"
          value={`${kpi.group.split(" (")[0]} ${kpi.groupShare}%`}
          caption={`Porsi rawat inap: ${kpi.groupNote}`}
          tone="warning"
          icon={<Baby className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Waktu reaksi pasien"
          value={`${kpi.lag} hari setelah paparan`}
          valueClassName="text-2xl md:text-3xl"
          caption={`Korelasi tertinggi r = ${kpi.r.toFixed(2).replace(".", ",")} · PM2.5 → ${disease}`}
          tone="danger"
          icon={<Clock className="size-4" aria-hidden />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title={`Tren PM2.5 vs kasus ${disease} harian`}
          subtitle={`AQMS harian + data RS · kasus menyusul ± ${kpi.lag} hari`}
        >
          <PmVsCasesChart data={series} disease={disease} />
          <div className="mt-2 flex flex-wrap gap-3">
            <LegendDot color="var(--warning)" label="PM2.5 (µg/m³) · sumbu kiri" shape="line" />
            <LegendDot color="var(--chart-1)" label="Kasus/hari · sumbu kanan" shape="line" />
          </div>
        </Panel>
        <Panel
          title="Kerentanan: kenaikan kasus per +10 µg/m³"
          subtitle="Persentase kenaikan kasus per kelompok usia"
          footnote={`Polutan terpilih (${pol.label}) menyala, lainnya redup`}
        >
          <VulnerabilityChart active={pollutant} />
          <div className="mt-2 flex flex-wrap gap-3">
            <LegendDot color="var(--warning)" label="Balita (<5 th)" shape="square" />
            <LegendDot color="var(--chart-3)" label="Lansia (>60 th)" shape="square" />
          </div>
        </Panel>
        <Panel
          title="Akumulasi kasus per jenis penyakit"
          subtitle="Total pasien pada periode terpilih"
          footnote={`Penyakit terpilih (${disease}) menyala, lainnya abu-abu`}
        >
          <DiseaseTotalsChart data={totals} active={disease} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Rincian rumah sakit" subtitle="Drill-down RS rujukan & stasiun AQMS terdekat">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>Rumah sakit</TableHead>
                  <TableHead>Stasiun terdekat</TableHead>
                  <TableHead>Kelas & kapasitas</TableHead>
                  <TableHead>Polutan dominan</TableHead>
                  <TableHead className="text-right">Total kasus</TableHead>
                  <TableHead>Penyakit dominan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hospitals.map((h) => (
                  <TableRow key={h.code}>
                    <TableCell>
                      <span className="font-mono text-[11px] text-muted-foreground">{h.code}</span>
                      <span className="block font-medium">{h.name}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{h.station}</TableCell>
                    <TableCell>{h.capacity}</TableCell>
                    <TableCell>{h.dominantPollutant}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{h.total.toLocaleString("id-ID")}</TableCell>
                    <TableCell>
                      <span
                        className={
                          h.dominantDisease === disease
                            ? "rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                            : "text-xs"
                        }
                      >
                        {h.dominantDisease}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
        <Panel
          className="lg:col-span-2"
          title="Proporsi penyakit per rumah sakit"
          subtitle="Persentase dari total kasus RS"
          footnote={`${disease} disorot · lainnya abu-abu`}
        >
          <HospitalShareChart hospitals={hospitals} active={disease} />
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
            {hospitalLegend(disease).map((l) => (
              <LegendDot key={l.label} color={l.color} label={l.label} shape="square" />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
