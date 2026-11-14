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
export const SCORE_WEIGHTS = { cases: 0.4, ratio: 0.4, gap: 0.2 }
export const RATIO_CRITICAL = 1.5
export const RATIO_WATCH = 1.2
export const COMPLETENESS_MIN = 80
export const COMPLETENESS_GOOD = 95
const PROPOSAL_REACH_KM = 150
/** Wilayah "terisolasi" = tidak ada stasiun beroperasi lain dalam radius ini (km). Wilayah terisolasi selalu jadi calon usulan stasiun baru. */
export const ISOLATION_KM = 500
/** Bobot minimum wilayah terisolasi pada perhitungan manfaat usulan (skala skor 0..1) */
const ISOLATED_WEIGHT = 0.3

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

type Base = Omit<WilayahRow, "highLoad" | "score" | "level" | "actions" | "nearestKm" | "isolated">

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

function actionsFor(r: Base, level: Level, isolated = false): string[] {
  if (level === "Nonaktif") return ["Perbaiki atau ganti sensor (stasiun rusak)"]
  if (level === "Tanpa data")
    return ["Pastikan pengiriman data pada rentang ini", ...(isolated ? ["Pertimbangkan stasiun tambahan (cakupan terbatas)"] : [])]
  const out: string[] = []
  if (level === "Kritis" || level === "Waspada") {
    if (isPeat(r.type)) out.push("Protokol kabut asap & siaga ruang rawat pernapasan")
    else if (isTraffic(r.type)) out.push("Kendalikan emisi lalu lintas")
    else if (isIndustrial(r.type)) out.push("Awasi emisi industri sekitar")
    else if (isUrban(r.type)) out.push("Peringatan dini & pantau jam puncak")
    else out.push("Tingkatkan pemantauan & kesiapsiagaan RS")
  }
  if (isolated) out.push("Pertimbangkan stasiun tambahan (cakupan terbatas)")
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

  // Jarak ke stasiun beroperasi lain terdekat (seluruh nasional, tidak bergantung filter Wilayah)
  const live = base.filter((r) => r.operational)

  return base.map((r): WilayahRow => {
    const nearestKm = r.operational
      ? live.reduce((m, o) => (o === r ? m : Math.min(m, haversineKm(r, o))), Infinity)
      : null
    const nearest = nearestKm != null && Number.isFinite(nearestKm) ? nearestKm : null
    const isolated = nearest != null && nearest > ISOLATION_KM
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
    return { ...r, highLoad, score, level, nearestKm: nearest, isolated, actions: actionsFor(r, level, isolated) }
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

/** Radius cakupan yang dipakai menghitung tambahan daratan tercakup */
const PROPOSAL_COVER_KM = COVERAGE_KM.outer
/** Jarak minimum antar-usulan (km) agar titik tidak bergerombol */
const PROPOSAL_MIN_SPACING_KM = 150
/** Kandidat harus minimal sejauh ini dari stasiun beroperasi terdekat, agar usulan tidak menempel di tepi radius */
const PROPOSAL_MIN_STATION_KM = 80
/** Pengali bobot kedekatan ke wilayah berisiko (0 = abaikan risiko) */
const RISK_BOOST = 0.5
/** Pemilihan berhenti bila tambahan cakupan < ini (satuan: titik kandidat berbobot; 1 titik ~ 780 km², lingkaran 50 km ~ 10 titik) */
const PROPOSAL_MIN_GAIN = 4
const PROPOSAL_MAX = { region: 8, nasional: 12 }

type CandIndex = { region: (MacroRegion | null)[]; near: string[]; nearKm: number[]; nb: number[][] }
const candCache = new WeakMap<EvalDB, CandIndex>()

/** Dihitung sekali per db: wilayah & stasiun terdekat tiap kandidat, serta tetangga dalam radius cakupan */
function candIndex(db: EvalDB): CandIndex {
  const hit = candCache.get(db)
  if (hit) return hit
  const live = db.stations.filter((s) => s.status !== "Defective")
  const pts = db.cand.map(([lat, lng]) => ({ lat, lng }))
  const region: (MacroRegion | null)[] = []
  const near: string[] = []
  const nearKm: number[] = []
  for (const p of pts) {
    let best: EvalStation | null = null
    let bd = Infinity
    for (const s of live) {
      const d = haversineKm(p, s)
      if (d < bd) {
        bd = d
        best = s
      }
    }
    region.push(best ? best.region : null)
    near.push(best ? best.name : "")
    nearKm.push(bd)
  }
  const nb: number[][] = pts.map(() => [])
  for (let i = 0; i < pts.length; i++) {
    nb[i].push(i)
    for (let j = i + 1; j < pts.length; j++) {
      // saringan cepat sebelum haversine
      if (Math.abs(pts[i].lat - pts[j].lat) > 0.6 || Math.abs(pts[i].lng - pts[j].lng) > 0.6) continue
      if (haversineKm(pts[i], pts[j]) <= PROPOSAL_COVER_KM) {
        nb[i].push(j)
        nb[j].push(i)
      }
    }
  }
  const out = { region, near, nearKm, nb }
  candCache.set(db, out)
  return out
}

/**
 * Usulan = greedy coverage. Kandidat (db.cand) adalah titik daratan >= 50 km dari semua stasiun beroperasi, jadi
 * himpunan kandidat = daratan yang belum terjangkau. Tiap putaran dipilih titik yang menambah paling banyak
 * daratan tak terjangkau dalam radius 50 km (dibobot 1 + kedekatan ke wilayah Kritis/Waspada/terisolasi), lalu
 * titik di dalam radiusnya dianggap tercakup. Titik yang menempel di tepi radius stasiun otomatis kalah karena
 * lingkarannya hampir seluruhnya tumpang tindih. Kandidat >= 80 km dari stasiun terdekat; jarak antar-usulan >= 150 km. Berhenti bila tambahan cakupan
 * < ~4 titik kandidat (sekitar 3.000 km² daratan baru), atau batas atas (8 per wilayah, 12 nasional). Hasil INDIKATIF.
 */
export function getProposals(db: EvalDB, rows: WilayahRow[], region: Region): Proposal[] {
  if (!db.cand.length) return []
  const { region: candRegion, near, nearKm, nb } = candIndex(db)
  const weight = (r: WilayahRow) => (r.isolated ? Math.max(r.score, ISOLATED_WEIGHT) : r.score)
  const needs = rows.filter((r) => r.level === "Kritis" || (r.level === "Waspada" && (r.ratio ?? 0) > RATIO_WATCH) || r.isolated)

  // Bobot tiap kandidat dan himpunan celah pada wilayah terpilih
  const inScope: boolean[] = db.cand.map((_, i) => region === "nasional" || candRegion[i] === region)
  const w = db.cand.map(([lat, lng], i) => {
    if (!inScope[i]) return 0
    let boost = 0
    for (const r of needs) {
      const d = haversineKm({ lat, lng }, r)
      if (d < PROPOSAL_REACH_KM) boost = Math.max(boost, weight(r) * (1 - d / PROPOSAL_REACH_KM))
    }
    return 1 + RISK_BOOST * boost
  })
  const total = w.reduce((a, b) => a + b, 0)
  if (!total) return []
  const covered = new Array(db.cand.length).fill(false)
  const max = region === "nasional" ? PROPOSAL_MAX.nasional : PROPOSAL_MAX.region
  const chosen: number[] = []

  for (let n = 0; n < max; n++) {
    let best = -1
    let bestGain = 0
    for (let i = 0; i < db.cand.length; i++) {
      if (!inScope[i] || nearKm[i] < PROPOSAL_MIN_STATION_KM) continue
      const [lat, lng] = db.cand[i]
      if (chosen.some((c) => haversineKm({ lat, lng }, { lat: db.cand[c][0], lng: db.cand[c][1] }) < PROPOSAL_MIN_SPACING_KM)) continue
      let gain = 0
      for (const j of nb[i]) if (!covered[j]) gain += w[j]
      if (gain > bestGain) {
        bestGain = gain
        best = i
      }
    }
    if (best < 0 || bestGain < PROPOSAL_MIN_GAIN) break
    chosen.push(best)
    for (const j of nb[best]) covered[j] = true
  }
  return chosen.map((i) => ({ lat: db.cand[i][0], lng: db.cand[i][1], near: near[i], label: `Usulan · dekat ${near[i]}` }))
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
      ? `Bangun stasiun AQMS baru di ${proposals.length} titik usulan pada peta (dekat ${list([...new Set(proposals.map((p) => p.near))], 4)}): daratan di luar radius ${COVERAGE_KM.outer} km stasiun eksisting yang menambah cakupan terbesar, diprioritaskan dekat wilayah berisiko atau terisolasi.`
      : `Belum ada celah di luar radius ${COVERAGE_KM.outer} km pada wilayah berisiko atau terisolasi; pertahankan kerapatan jaringan yang ada.`,
    "Integrasikan telemetri kualitas udara langsung dengan rekam medis harian RS rujukan untuk pemantauan berkelanjutan.",
  ]
  return { short, mid, long }
}
