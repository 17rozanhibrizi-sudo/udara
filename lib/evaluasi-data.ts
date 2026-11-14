/**
 * Lapisan data nyata untuk halaman "Evaluasi Jaringan & Rekomendasi Kebijakan".
 * Sumber: public/data/evaluasi.json (dibuat oleh scripts/build-evaluasi-data.py). Semua fungsi murni, tanpa React.
 *
 * Catatan data:
 * - 1 kota/kabupaten = 1 stasiun AQMS = 1 RS rujukan. Jadi "Wilayah (Kota/Kab)" pada tabel = 1 stasiun.
 * - Dataset TIDAK punya koordinat RS, jadi tidak ada jarak RS-stasiun (Card "Rata-rata jarak" dan titik RS dihapus).
 * - Beban kasus RS = resp + cvd + death (kolom 04_env_health_daily_ready.csv).
 */
import { countDays, type DateRange, type Region } from "@/lib/data"

/* ---------- Tipe ---------- */

type MacroRegion = Exclude<Region, "nasional">
export type StationStatus = "Active" | "Intermittent" | "Defective"

export type RawEvalStation = {
  code: string
  hospitalId: string
  name: string
  fullName: string
  province: string
  region: MacroRegion
  type: string
  status: StationStatus
  lat: number
  lng: number
  baseline: number
  hospital: { name: string; cls: string; beds: number }
  hp: (number | null)[] | null // profil rata-rata PM2.5 per jam (0-23 WIB), seluruh periode
  d: number[] // delta-encoded indeks hari (hari berdata pada 04_env_health_daily_ready)
  p: (number | null)[] // PM2.5 harian (null = sensor macet)
  h: number[] // kasus harian resp + cvd + death
  v: number[] // jam valid per hari kalender (0-24), panjang = days
}
export type RawEvaluasi = {
  version: number
  base: string
  max: string
  days: number
  stations: RawEvalStation[]
  cand: [number, number][]
}
export type EvalStation = Omit<RawEvalStation, "d"> & { idx: number[] }
export type EvalDB = { base: string; max: string; baseTime: number; days: number; stations: EvalStation[]; cand: [number, number][] }

export type Level = "Kritis" | "Waspada" | "Terpantau" | "Nonaktif" | "Tanpa data"

export type WilayahRow = {
  code: string
  name: string
  fullName: string
  province: string
  region: MacroRegion
  type: string
  status: StationStatus
  lat: number
  lng: number
  operational: boolean // Active atau Intermittent
  hospital: { name: string; cls: string; beds: number }
  baseline: number
  hasData: boolean
  daysWithData: number
  pmDays: number // jumlah hari ber-PM2.5 (tidak macet) pada rentang
  pmSum: number // jumlah PM2.5 harian (tanpa pembulatan) untuk rata-rata terbobot KPI
  cases: number // akumulasi resp + cvd + death pada rentang
  casesPerDay: number | null
  avgPm: number | null
  ratio: number | null // avgPm / baseline
  completeness: number // % jam valid terhadap 24 x jumlah hari pada rentang
  highLoad: boolean // beban kasus per hari >= median seluruh stasiun berdata
  score: number // skor blind spot gabungan 0..1
  level: Level
  actions: string[]
  /** jarak (km) ke stasiun beroperasi lain terdekat; null bila stasiun nonaktif */
  nearestKm: number | null
  /** true bila nearestKm > ISOLATION_KM: cakupan jaringan di sekitarnya praktis hanya stasiun ini */
  isolated: boolean
}

export type Proposal = { lat: number; lng: number; label: string; near: string }

/* ---------- Konstanta aturan ---------- */

const DAY_MS = 86400000
export const COVERAGE_KM = { inner: 30, outer: 50 }
/** Bobot skor blind spot: beban kasus, rasio PM2.5/baseline, kekurangan kelengkapan data */
export const SCORE_WEIGHTS = {
