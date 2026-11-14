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
}

export type Proposal = { lat: number; lng: number; label: string; near: string }

/* ---------- Konstanta aturan ---------- */

const DAY_MS = 86400000
export const COVERAGE_KM = { inner: 30, outer: 50 }
/** Bobot skor blind spot: beban kasus, rasio PM2.5/baseline, kekurangan kelengkapan data */
export const SCORE_WEIGHTS = { cases: 0.4, ratio: 0.4, gap: 0.2 }
export const RATIO_CRITICAL = 1.5
export const RATIO_WATCH = 1.2
export const COMPLETENESS_MIN = 80
export const COMPLETENESS_GOOD = 95
const PROPOSAL_REACH_KM = 150
const PROPOSAL_SPACING_KM = 100

/* ---------- Muat & siapkan ---------- */

export function prepareEvaluasi(raw: RawEvaluasi): EvalDB {
  return {
    base: raw.base,
    max: raw.max,
    baseTime: Date.parse(`${raw.base}T00:00:00Z`),
    days: raw.days,
    cand: raw.cand,
    stations: raw.stations.map(({ d, ...rest }) => {
      let acc = 0
      return { ...rest, idx: d.map((x, k) => (acc = k === 0 ? x : acc + x)) }
    }),
  }
}

/* ---------- Helper ---------- */

export const stationsInRegion = <T extends { region: string }>(list: T[], region: Region) =>
  region === "nasional" ? list : list.filter((s) => s.region === region)

const dayIdx = (db: EvalDB, iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - db.baseTime) / DAY_MS)
const round1 = (n: number) => Math.round(n * 10) / 10

function lowerBound(a: number[], x: number) {
  let lo = 0
  let hi = a.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (a[mid] < x) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371.0088
  const rad = Math.PI / 180
  const dp = (b.lat - a.lat) * rad
  const dl = (b.lng - a.lng) * rad
  const h = Math.sin(dp / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const median = (v: number[]) => {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const isPeat = (t: string) => /peat|gambut|deforestation/i.test(t)
const isTraffic = (t: string) => /traffic|roadside|highway|artery/i.test(t)
const isIndustrial = (t: string) => /industrial/i.test(t)
const isUrban = (t: string) => /urban/i.test(t)

/** "Tipe B" / "Tipe C" (juga "Tipe A (Khusus Paru)" tidak termasuk) */
const isClassBC = (cls: string) => /^Tipe [BC]\b/.test(cls)

/* ---------- 1. Hitung semua wilayah (nasional) pada rentang tanggal ---------- */

type Base = Omit<WilayahRow, "highLoad" | "score" | "level" | "actions">

function baseRow(db: EvalDB, s: EvalStation, range: DateRange): Base {
  const i0 = dayIdx(db, range.from)
  const i1 = dayIdx(db, range.to)
  const a = lowerBound(s.idx, i0)
  const b = lowerBound(s.idx, i1 + 1)
  let cases = 0
  let sumPm = 0
  let nPm = 0
  for (let k = a; k < b; k++) {
    cases += s.h[k]
    const v = s.p[k]
    if (v != null) {
      sumPm += v
      nPm++
    }
  }
  const nDays = b - a
  let valid = 0
  for (let k = Math.max(i0, 0); k <= Math.min(i1, db.days - 1); k++) valid += s.v[k] ?? 0
  const expected = 24 * countDays(range)
  const avgPm = nPm ? sumPm / nPm : null
  return {
    code: s.code,
    name: s.name,
    fullName: s.fullName,
    province: s.province,
    region: s.region,
    type: s.type,
    status: s.status,
    lat: s.lat,
    lng: s.lng,
    operational: s.status !== "Defective",
    hospital: s.hospital,
    baseline: s.baseline,
    hasData: nDays > 0,
    daysWithData: nDays,
    pmDays: nPm,
    pmSum: sumPm,
    cases,
    casesPerDay: nDays ? cases / nDays : null,
    avgPm: avgPm == null ? null : round1(avgPm),
    ratio: avgPm == null ? null : avgPm / s.baseline,
    completeness: expected ? (valid / expected) * 100 : 0,
  }
}

function minMax(vals: number[]) {
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  return (x: number) => (hi > lo ? (x - lo) / (hi - lo) : 0)
}

function actionsFor(r: Base, level: Level): string[] {
  if (level === "Nonaktif") return ["Perbaiki atau ganti sensor (stasiun rusak)"]
  if (level === "Tanpa data") return ["Pastikan pengiriman data pada rentang ini"]
  const out: string[] = []
  if (level === "Kritis" || level === "Waspada") {
    if (isPeat(r.type)) out.push("Protokol kabut asap & siaga ruang rawat pernapasan")
    else if (isTraffic(r.type)) out.push("Kendalikan emisi lalu lintas")
    else if (isIndustrial(r.type)) out.push("Awasi emisi industri sekitar")
    else if (isUrban(r.type)) out.push("Peringatan dini & pantau jam puncak")
    else out.push("Tingkatkan pemantauan & kesiapsiagaan RS")
  }
  if (r.completeness < COMPLETENESS_GOOD || r.status === "Intermittent") out.push("Kalibrasi/perbaiki sensor")
  if (!out.length) out.push("Pertahankan pemantauan rutin")
  return out
}

/** Semua stasiun (nasional) lengkap dengan skor blind spot, status, dan aksi. Skor dinormalkan nasional agar tidak bergantung filter Wilayah. */
export function computeRows(db: EvalDB, range: DateRange): WilayahRow[] {
  const base = db.stations.map((s) => baseRow(db, s, range))
  const scored = base.filter((r) => r.operational && r.hasData && r.ratio != null)
  const med = median(scored.map((r) => r.casesPerDay ?? 0))
  const nCases = minMax(scored.map((r) => r.casesPerDay ?? 0))
  const nRatio = minMax(scored.map((r) => r.ratio ?? 0))
  const nGap = minMax(scored.map((r) => 100 - r.completeness))

  return base.map((r): WilayahRow => {
    const inScore = r.operational && r.hasData && r.ratio != null
    const highLoad = inScore && (r.casesPerDay ?? 0) >= med
    const score = inScore
      ? SCORE_WEIGHTS.cases * nCases(r.casesPerDay ?? 0) +
        SCORE_WEIGHTS.ratio * nRatio(r.ratio ?? 0) +
        SCORE_WEIGHTS.gap * nGap(100 - r.completeness)
      : 0
    let level: Level
    if (!r.operational) level = "Nonaktif"
    else if (!r.hasData) level = "Tanpa data"
    else if (r.ratio != null && r.ratio > RATIO_CRITICAL && highLoad) level = "Kritis"
    else if (
      (r.ratio != null && (r.ratio > RATIO_CRITICAL || (r.ratio > RATIO_WATCH && highLoad))) ||
      r.completeness < COMPLETENESS_MIN
    )
      level = "Waspada"
    else level = "Terpantau"
    return { ...r, highLoad, score, level, actions: actionsFor(r, level) }
  })
}

/* ---------- 2. Kartu KPI ---------- */

export function getKpis(rows: WilayahRow[]) {
  const live = rows.filter((r) => r.operational)
  // Card 1: jam valid / total jam observasi (24 x hari) seluruh stasiun beroperasi
  const ref = live.length
  const completeness = ref ? live.reduce((a, r) => a + r.completeness, 0) / ref : null
  const intermittent = live.filter((r) => r.status === "Intermittent").length

  // Card 2: wilayah dengan skor gabungan tertinggi
  const candidates = live.filter((r) => r.hasData && r.ratio != null)
  const blind = candidates.length ? candidates.reduce((a, b) => (b.score > a.score ? b : a)) : null

  // Card 4: rata-rata aktual PM2.5 / rata-rata baseline (dibobot per pengamatan hari-stasiun)
  let sumPm = 0
  let sumBase = 0
  let n = 0
  for (const r of candidates) {
    if (!r.pmDays) continue
    sumPm += r.pmSum
    sumBase += r.baseline * r.pmDays
    n += r.pmDays
  }
  const ratio = n ? { avg: sumPm / n, baseline: sumBase / n, value: sumPm / sumBase } : null

  return { completeness, operational: live.length, intermittent, blind, ratio }
}

/* ---------- 3. Titik usulan stasiun baru (Layer 4 peta) ---------- */

/**
 * Kandidat = titik daratan >= 50 km dari semua stasiun beroperasi (dihitung di script build).
 * Manfaat kandidat = jumlah skor wilayah berisiko (Kritis / Waspada akibat polusi) yang berada <= 150 km,
 * dibobot makin dekat makin besar. Dipilih greedy, antar-usulan minimal 100 km. Hasil INDIKATIF.
 */
export function getProposals(db: EvalDB, rows: WilayahRow[], region: Region): Proposal[] {
  const needs = rows
    .filter((r) => r.level === "Kritis" || (r.level === "Waspada" && (r.ratio ?? 0) > RATIO_WATCH))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
  if (!needs.length || !db.cand.length) return []
  const max = region === "nasional" ? 4 : 2
  const chosen: { lat: number; lng: number; near: WilayahRow; benefit: number }[] = []
  for (let n = 0; n < max; n++) {
    let best: (typeof chosen)[number] | null = null
    for (const [lat, lng] of db.cand) {
      if (chosen.some((c) => haversineKm(c, { lat, lng }) < PROPOSAL_SPACING_KM)) continue
      let benefit = 0
      let near: WilayahRow | null = null
      let nearD = Infinity
      for (const r of needs) {
        const dkm = haversineKm({ lat, lng }, r)
        if (dkm <= PROPOSAL_REACH_KM) benefit += r.score * (1 - dkm / PROPOSAL_REACH_KM)
        if (dkm < nearD) {
          nearD = dkm
          near = r
        }
      }
      if (near && benefit > 0 && (!best || benefit > best.benefit)) best = { lat, lng, near, benefit }
    }
    if (!best) break
    chosen.push(best)
  }
  return chosen.map((c) => ({ lat: c.lat, lng: c.lng, near: c.near.name, label: `Usulan · dekat ${c.near.name}` }))
}

/* ---------- 4. Rencana aksi kebijakan (3 kartu) ---------- */

const list = (names: string[], max = 3) =>
  names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")}, dan ${names.length - max} lainnya`

/** Jam mulai jendela 3 jam dengan rata-rata PM2.5 tertinggi (rata-rata profil stasiun beroperasi di wilayah) */
export function peakWindow(db: EvalDB, region: Region): string | null {
  const st = stationsInRegion(db.stations, region).filter((s) => s.status !== "Defective" && s.hp)
  if (!st.length) return null
  const mean = Array.from({ length: 24 }, (_, h) => {
    const v = st.map((s) => s.hp![h]).filter((x): x is number => x != null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : -Infinity
  })
  let best = -Infinity
  let start = 0
  for (let h = 0; h < 24; h++) {
    const w = (mean[h] + mean[(h + 1) % 24] + mean[(h + 2) % 24]) / 3
    if (w > best) {
      best = w
      start = h
    }
  }
  const p = (h: number) => String(h % 24).padStart(2, "0")
  return `${p(start)}.00–${p(start + 3)}.00 WIB`
}

export function getActionPlan(db: EvalDB, rows: WilayahRow[], region: Region, proposals: Proposal[]) {
  const live = rows.filter((r) => r.operational)
  const peat = live.filter((r) => isPeat(r.type)).map((r) => r.name)
  const road = live.filter((r) => isTraffic(r.type) || isUrban(r.type)).map((r) => r.name)
  const win = peakWindow(db, region)
  const lowQ = live
    .filter((r) => r.completeness < COMPLETENESS_GOOD)
    .sort((a, b) => a.completeness - b.completeness)
    .slice(0, 3)
  const bcTop = live
    .filter((r) => r.hasData && r.ratio != null && isClassBC(r.hospital.cls))
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
    .slice(0, 3)
  const fmt = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 })

  const short: string[] = [
    `Aktifkan sistem peringatan dini otomatis menjelang jam puncak pencemaran${win ? ` (${win})` : ""} untuk melindungi balita dan lansia.`,
    peat.length
      ? `Terapkan protokol siaga darurat kabut asap dan siagakan ruang rawat inap pernapasan RS rujukan di ${list(peat)} pada musim kemarau.`
      : `Siagakan ruang rawat inap pernapasan RS rujukan saat konsentrasi PM2.5 melampaui baku mutu.`,
    lowQ.length
      ? `Pelihara dan kalibrasi sensor pada stasiun dengan kelengkapan data terendah: ${lowQ
          .map((r) => `${r.name} (${fmt(r.completeness)}%)`)
          .join(", ")}.`
      : `Lanjutkan kalibrasi berkala sensor; semua stasiun beroperasi berkelengkapan ≥ ${COMPLETENESS_GOOD}%.`,
  ]

  const mid: string[] = []
  if (road.length)
    mid.push(
      `Perketat uji emisi kendaraan dan rekayasa lalu lintas di koridor padat sekitar stasiun tepi jalan dan perkotaan (${list(road)}).`,
    )
  if (bcTop.length)
    mid.push(
      `Tambah kapasitas tempat tidur ruang perawatan gangguan pernapasan di RS tipe B dan C pada wilayah dengan rasio polusi tertinggi: ${bcTop
        .map((r) => `${r.name} (${fmt(r.ratio ?? 0)}× baseline)`)
        .join(", ")}.`,
    )
  if (peat.length)
    mid.push(`Awasi terpadu pencegahan kebakaran hutan dan lahan gambut di sekitar ${list(peat)}.`)
  if (!mid.length) mid.push("Tidak ada karakteristik sumber dominan pada wilayah ini; lanjutkan pemantauan rutin.")

  const long: string[] = [
    proposals.length
      ? `Bangun stasiun AQMS baru di ${proposals.length} titik usulan pada peta (${list(proposals.map((p) => p.near), 4)}): wilayah berbeban kasus tinggi di luar radius ${COVERAGE_KM.outer} km stasiun eksisting.`
      : `Belum ada celah di luar radius ${COVERAGE_KM.outer} km pada wilayah berisiko; pertahankan kerapatan jaringan yang ada.`,
    "Integrasikan telemetri kualitas udara langsung dengan rekam medis harian RS rujukan untuk pemantauan berkelanjutan.",
  ]
  return { short, mid, long }
}
