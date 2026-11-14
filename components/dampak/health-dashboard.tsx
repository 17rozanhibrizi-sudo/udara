"use client"

import { useMemo } from "react"
import { Baby, Clock, Users } from "lucide-react"
import { FilterBar } from "@/components/dashboard/filter-bar"
import { useFilters } from "@/components/dashboard/filter-context"
import { KpiCard, LegendDot, PageHeader, Panel } from "@/components/dashboard/widgets"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getPollutant, resolvePollutant, type DiseaseSelection, type PollutantSelection } from "@/lib/data"
import {
  diseaseLabel,
  getDiseaseAccumulation,
  getHospitalRows,
  getLagCorrelation,
  getTotals,
  getTrend,
  getVulnerability,
  type HealthDB,
} from "@/lib/health-data"
import { useHealthData } from "@/lib/use-health-data"
import { DiseaseTotalsChart, HospitalShareChart, PmVsCasesChart, VulnerabilityChart, diseaseColors } from "./health-charts"

const idn = (n: number) => n.toLocaleString("id-ID")
const dec = (n: number, d = 2) => n.toFixed(d).replace(".", ",")

function Header() {
  return (
    <PageHeader
      eyebrow="03 · Dampak Kesehatan"
      title="Dampak Kesehatan"
      description="Hubungan paparan polutan dengan kunjungan rumah sakit, kelompok rentan, dan jeda waktu reaksi pasien."
      dummy={false}
    />
  )
}

export function HealthDashboard() {
  const { db, error, loading } = useHealthData()
  if (db) return <HealthContent db={db} />
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:p-8">
      <Header />
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground" role="status">
        {loading ? "Memuat data kesehatan…" : `Data tidak dapat dimuat. ${error ?? ""}`}
      </div>
    </div>
  )
}

function HealthContent({ db }: { db: HealthDB }) {
  const f = useFilters()
  const { region, range } = f
  const disease = f.disease as unknown as DiseaseSelection
  const pollutant = resolvePollutant(f.pollutant as unknown as PollutantSelection)
  const pol = getPollutant(pollutant)
  const dLabel = diseaseLabel(disease)

  const totals = useMemo(() => getTotals(db, { region, range, disease }), [db, region, range, disease])
  const lag = useMemo(() => getLagCorrelation(db, { region, pollutant, range, disease }), [db, region, pollutant, range, disease])
  const trend = useMemo(() => getTrend(db, { region, pollutant, range, disease }), [db, region, pollutant, range, disease])
  const vuln = useMemo(() => getVulnerability(db, { region, range }), [db, region, range])
  const accum = useMemo(() => getDiseaseAccumulation(db, { region, range }), [db, region, range])
  const rows = useMemo(() => getHospitalRows(db, { region, range, disease }), [db, region, range, disease])
  const legend = diseaseColors(disease)

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:p-8">
      <Header />
      <FilterBar show={["region", "pollutant", "disease", "period"]} singlePollutant />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total kasus kesehatan"
          value={
            <>
              {idn(totals.total)} <span className="text-lg font-semibold text-muted-foreground">pasien</span>
            </>
          }
          caption={`${dLabel} · ${totals.withData} RS · tidak berubah saat polutan diganti`}
          icon={<Users className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Kelompok paling rentan"
          value={totals.group ? `${totals.group.short} ${dec(totals.group.pct, 1)}%` : "–"}
          caption={
            totals.group
              ? `Porsi rawat inap pernapasan · Balita ${dec(totals.balitaPct ?? 0, 1)}% vs Lansia ${dec(totals.lansiaPct ?? 0, 1)}%`
              : "Tidak ada data pada rentang ini"
          }
          tone="warning"
          icon={<Baby className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Waktu reaksi pasien"
          value={lag.best ? (lag.best.lag === 0 ? "Hari yang sama" : `${lag.best.lag} hari setelah paparan`) : "–"}
          valueClassName="text-2xl md:text-3xl"
          caption={
            lag.best
              ? `Korelasi tertinggi r = ${dec(lag.best.r)} · ${pol.label} → ${dLabel} · lag 0–7 hari`
              : "Data terlalu sedikit untuk korelasi (min. 30 pasangan hari)"
          }
          tone="danger"
          icon={<Clock className="size-4" aria-hidden />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title={`Tren ${pol.label} vs kasus ${dLabel} harian`}
          subtitle={`Rata-rata harian ${pol.label} (kiri) · total kasus per hari (kanan)`}
        >
          <PmVsCasesChart data={trend} pollutantLabel={pol.label} diseaseLabel={dLabel} />
          <div className="mt-2 flex flex-wrap gap-3">
            <LegendDot color="var(--warning)" label={`${pol.label} (µg/m³) · sumbu kiri`} shape="line" />
            <LegendDot color="var(--chart-1)" label="Kasus/hari · sumbu kanan" shape="line" />
          </div>
        </Panel>
        <Panel
          title="Kerentanan: kenaikan kasus per +10 µg/m³"
          subtitle="Tambahan rawat inap pernapasan per RS per hari (β × 10)"
          footnote={`Polutan terpilih (${pol.label}) menyala, lainnya abu-abu · regresi dalam-RS, min. 30 pasangan hari`}
        >
          <VulnerabilityChart data={vuln} active={pollutant} />
          <div className="mt-2 flex flex-wrap gap-3">
            <LegendDot color="var(--warning)" label="Balita (<5 th)" shape="square" />
            <LegendDot color="var(--chart-3)" label="Lansia (>60 th)" shape="square" />
          </div>
        </Panel>
        <Panel
          title="Akumulasi kasus per jenis penyakit"
          subtitle="Total pasien pada periode terpilih"
          footnote={disease === "ALL" ? "Semua kategori disorot" : `Penyakit terpilih (${dLabel}) menyala, lainnya abu-abu`}
        >
          <DiseaseTotalsChart data={accum} active={disease} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Rincian rumah sakit" subtitle="RS rujukan & stasiun AQMS pasangan" footnote="Polutan dominan = rata-rata periode ÷ baku mutu PP 22/2021 tertinggi di stasiun pasangan">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>Rumah sakit</TableHead>
                  <TableHead>Stasiun AQMS</TableHead>
                  <TableHead>Kelas & kapasitas</TableHead>
                  <TableHead>Polutan dominan</TableHead>
                  <TableHead className="text-right">Total kasus</TableHead>
                  <TableHead>Penyakit dominan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((h) => (
                  <TableRow key={h.code} className={h.hasData ? undefined : "text-muted-foreground"}>
                    <TableCell>
                      <span className="font-mono text-[11px] text-muted-foreground">{h.code}</span>
                      <span className="block font-medium">{h.name}</span>
                      <span className="block text-xs text-muted-foreground">{h.city}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{h.station}</span>
                      <span className="block text-xs text-muted-foreground">{h.stationName}</span>
                    </TableCell>
                    <TableCell>{h.classLabel}</TableCell>
                    <TableCell>
                      {h.dominantPollutant ? `${h.dominantPollutant.label} (${dec(h.dominantPollutant.ratio, 1)}× BM)` : "–"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{h.hasData ? idn(h.total) : "–"}</TableCell>
                    <TableCell>
                      {h.dominantDisease ? (
                        <span
                          className={
                            h.dominantDisease === disease
                              ? "rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                              : "text-xs"
                          }
                        >
                          {h.dominantDisease}
                        </span>
                      ) : (
                        <span className="text-xs">{h.status === "Defective" ? "Sensor rusak" : "Tanpa data"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
        <Panel
          title="Proporsi penyakit per rumah sakit"
          subtitle="Persentase dari total kasus RS (5 kategori)"
          footnote={disease === "ALL" ? "Semua kategori ditampilkan" : `${dLabel} disorot · lainnya abu-abu`}
        >
          <HospitalShareChart rows={rows} active={disease} />
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
            {legend.map((l) => (
              <LegendDot key={l.col} color={l.color} label={l.label} shape="square" />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
