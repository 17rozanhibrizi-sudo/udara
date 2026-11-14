/**
 * Lapisan data nyata untuk halaman Dampak Kesehatan.
 * Sumber: public/data/health.json (dibuat oleh scripts/build-health-data.py), berasal dari
 * 01_master_station_hospital.csv + 04_env_health_daily_ready.csv. Semua fungsi murni (tanpa React).
 *
 * Satuan analisis = pasangan RS–stasiun AQMS per hari. Konsentrasi polutan bernilai null pada hari sensor macet.
 */
import {
  MONTHS_SHORT,
  POLLUTANTS,
  countDays,
  rangeDates,
  type DateRange,
  type Disease,
  type DiseaseSelection,
  type Pollutant,
  type Region,
} from "@/lib/data"

/* ---------- Tipe ---------- */

type MacroRegion = Exclude<Region, "nasional">
export type CaseKey = "u5" | "o60" | "asthma" | "copd" | "resp" | "cvd" | "death"
/** 5 kategori penyakit, urutan sama dengan DISEASES di lib/data.ts */
export type DiseaseCol = "resp" | "cvd" | "asthma" | "copd" | "death"

export const DISEASE_COLS: { col: DiseaseCol; disease: Disease; label: string }[] = [
  { col: "resp", disease: "ISPA", label: "ISPA / Pernapasan" },
  { col: "cvd", disease: "Kardiovaskular", label: "Kardiovaskular" },
  { col: "asthma", disease: "Asma darurat", label: "Asma darurat" },
  { col: "copd", disease: "PPOK", label: "PPOK" },
  { col: "death", disease: "Kematian", label: "Kematian" },
]
const COL_OF: Record<Disease, DiseaseCol> = {
  ISPA: "resp",
  Kardiovaskular: "cvd",
  "Asma darurat": "asthma",
  PPOK: "copd",
  Kematian: "death",
}

type RawHospital = {
  code: string
  name: string
  city: string
  class: string
  beds: number
  region: MacroRegion
  station: string
  stationName: string
  stationFull: string
  status: "Active" | "Intermittent" | "Defective"
  d: number[]
  c: Record<Pollutant, (number | null)[]>
  h: Record<CaseKey, number[]>
}
export type RawHealth = { version: number; base: string; max: string; hospitals: RawHospital[] }
export type Hospital = Omit<RawHospital, "d"> & { idx: number[] }
export type HealthDB = { base: string; max: string; baseTime: number; hospitals: Hospital[] }
export type HealthFilters = { region: Region; pollutant: Pollutant; range: DateRange; disease: DiseaseSelection }

/* ---------- Konstanta ---------- */

const DAY_MS = 86400000
export const MAX_LAG = 7
/** Minimal pasangan data agar r / β dihitung */
const MIN_PAIRS = 30
/** r lag tertinggi di bawah ini dianggap tidak ada jeda yang jelas */
export const WEAK_LAG_R = 0.1
/** porsi penyakit RS dianggap menonjol bila ≥ nilai ini × porsi rata-rata wilayah */
const STANDOUT_MIN = 1.1
/** RS dengan total kasus kurang dari ini tidak diberi label "menonjol" (sampel terlalu kecil) */
const STANDOUT_MIN_CASES = 30

/* ---------- Muat & siapkan ---------- */

export function prepareHealth(raw: RawHealth): HealthDB {
  return {
    base: raw.base,
    max: raw.max,
    baseTime: Date.parse(`${raw.base}T00:00:00Z`),
    hospitals: raw.hospitals.map(({ d, ...rest }) => {
      let acc = 0
      return { ...rest, idx: d.map((x, k) => (acc = k === 0 ? x : acc + x)) }
    }),
  }
}

/* ---------- Helper ---------- */

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

function dayIdx(db: HealthDB, iso: string) {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - db.baseTime) / DAY_MS)
}
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
const bounds = (idx: number[], i0: number, i1: number): [number, number] => [lowerBound(idx, i0), lowerBound(idx, i1 + 1)]
const standardOf = (p: Pollutant) => POLLUTANTS.find((x) => x.value === p)!.standard

export function hospitalsIn(db: HealthDB, region: Region) {
  return region === "nasional" ? db.hospitals : db.hospitals.filter((h) => h.region === region)
}

/** Jumlah kasus pada posisi k untuk pilihan penyakit ("ALL" = jumlah 5 kategori, sesuai spesifikasi) */
function casesAt(h: Hospital, k: number, sel: DiseaseSelection) {
  if (sel === "ALL") return h.h.resp[k] + h.h.cvd[k] + h.h.asthma[k] + h.h.copd[k] + h.h.death[k]
  return h.h[COL_OF[sel]][k]
}

export function diseaseLabel(sel: DiseaseSelection) {
  return sel === "ALL" ? "Semua Penyakit" : sel === "ISPA" ? "ISPA / Pernapasan Umum" : sel
}

/* ---------- Kartu 1 & 2 ---------- */

export function getTotals(db: HealthDB, { region, range, disease }: Pick<HealthFilters, "region" | "range" | "disease">) {
  const i0 = dayIdx(db, range.from)
  const i1 = dayIdx(db, range.to)
  let total = 0
  let u5 = 0
  let o60 = 0
  let withData = 0
  for (const h of hospitalsIn(db, region)) {
    const [a, b] = bounds(h.idx, i0, i1)
    if (b > a) withData++
    for (let k = a; k < b; k++) {
      total += casesAt(h, k, disease)
      u5 += h.h.u5[k]
      o60 += h.h.o60[k]
    }
  }
  const sum = u5 + o60
  const group = sum
    ? o60 >= u5
      ? { name: "Lansia (>60 th)", short: "Lansia", pct: round1((o60 / sum) * 100), other: round1((u5 / sum) * 100) }
      : { name: "Balita (<5 th)", short: "Balita", pct: round1((u5 / sum) * 100), other: round1((o60 / sum) * 100) }
    : null
  return {
    total,
    withData,
    group,
    balitaPct: sum ? round1((u5 / sum) * 100) : null,
    lansiaPct: sum ? round1((o60 / sum) * 100) : null,
  }
}

/* ---------- Kartu 3: korelasi silang lag 0–7 ---------- */

/**
 * r antara polutan pada hari (t − lag) dan kasus pada hari t. Dihitung DI DALAM tiap RS (nilai dikurangi
 * rata-rata RS itu), lalu digabung, agar perbedaan ukuran RS tidak ikut terhitung. Polutan sebelum awal
 * rentang boleh dipakai untuk lag; kasus hanya dari dalam rentang.
 */
export function getLagCorrelation(db: HealthDB, { region, pollutant, range, disease }: HealthFilters) {
  const i0 = dayIdx(db, range.from)
  const i1 = dayIdx(db, range.to)
  const list = hospitalsIn(db, region)
  const curve: { lag: number; r: number | null; n: number }[] = []

  for (let lag = 0; lag <= MAX_LAG; lag++) {
    let sxx = 0, syy = 0, sxy = 0, n = 0
    for (const h of list) {
      const [a, b] = bounds(h.idx, i0, i1)
      const pos = new Map<number, number>()
      const [pa] = bounds(h.idx, i0 - lag, i1)
      for (let k = pa; k < b; k++) pos.set(h.idx[k], k)
      const xs: number[] = []
      const ys: number[] = []
      for (let k = a; k < b; k++) {
        const kp = pos.get(h.idx[k] - lag)
        if (kp === undefined) continue
        const x = h.c[pollutant][kp]
        if (x == null) continue
        xs.push(x)
        ys.push(casesAt(h, k, disease))
      }
      if (xs.length < 2) continue
      const mx = xs.reduce((p, q) => p + q, 0) / xs.length
      const my = ys.reduce((p, q) => p + q, 0) / ys.length
      for (let j = 0; j < xs.length; j++) {
        const dx = xs[j] - mx
        const dy = ys[j] - my
        sxx += dx * dx
        syy += dy * dy
        sxy += dx * dy
      }
      n += xs.length
    }
    curve.push({ lag, n, r: n >= MIN_PAIRS && sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null })
  }
  let best: { lag: number; r: number } | null = null
  for (const c of curve) if (c.r != null && (best == null || c.r > best.r)) best = { lag: c.lag, r: c.r }
  return { best: best ? { lag: best.lag, r: round2(best.r) } : null, curve }
}

/* ---------- Grafik 1: tren polutan vs kasus ---------- */

export function getTrend(db: HealthDB, { region, pollutant, range, disease }: HealthFilters) {
  const n = countDays(range)
  const i0 = dayIdx(db, range.from)
  const pmSum = new Float64Array(n)
  const pmCnt = new Uint16Array(n)
  const caseSum = new Float64Array(n)
  const caseCnt = new Uint16Array(n)
  for (const h of hospitalsIn(db, region)) {
    const [a, b] = bounds(h.idx, i0, i0 + n - 1)
    for (let k = a; k < b; k++) {
      const j = h.idx[k] - i0
      caseSum[j] += casesAt(h, k, disease)
      caseCnt[j]++
      const x = h.c[pollutant][k]
      if (x != null) {
        pmSum[j] += x
        pmCnt[j]++
      }
    }
  }
  const multiYear = range.from.slice(0, 4) !== range.to.slice(0, 4)
  return rangeDates(range).map((d, j) => ({
    day: `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}${multiYear ? ` ${String(d.getUTCFullYear()).slice(2)}` : ""}`,
    pm: pmCnt[j] ? round1(pmSum[j] / pmCnt[j]) : null,
    cases: caseCnt[j] ? caseSum[j] : null,
  }))
}

/* ---------- Grafik 2: kerentanan balita vs lansia (β × 10) ---------- */

/**
 * β×10 = kenaikan rata-rata kasus rawat inap pernapasan per RS per hari untuk setiap +10 µg/m³ polutan.
 * Regresi linier dengan nilai dikurangi rata-rata RS (efek tetap per RS), pada hari yang sama.
 * Tanpa pengurangan itu, polutan seperti SO₂/NO₂/O₃ terlihat berefek besar semu hanya karena RS yang
 * kebetulan besar berada di stasiun dengan konsentrasi tinggi.
 */
export function getVulnerability(db: HealthDB, { region, range }: Pick<HealthFilters, "region" | "range">) {
  const i0 = dayIdx(db, range.from)
  const i1 = dayIdx(db, range.to)
  const list = hospitalsIn(db, region)
  return POLLUTANTS.map((p) => {
    const acc = { u5: { sxx: 0, sxy: 0 }, o60: { sxx: 0, sxy: 0 } }
    let n = 0
    for (const h of list) {
      const [a, b] = bounds(h.idx, i0, i1)
      const ks: number[] = []
      for (let k = a; k < b; k++) if (h.c[p.value][k] != null) ks.push(k)
      if (ks.length < 2) continue
      const mean = (f: (k: number) => number) => ks.reduce((s, k) => s + f(k), 0) / ks.length
      const mx = mean((k) => h.c[p.value][k] as number)
      const m5 = mean((k) => h.h.u5[k])
      const m6 = mean((k) => h.h.o60[k])
      for (const k of ks) {
        const dx = (h.c[p.value][k] as number) - mx
        acc.u5.sxx += dx * dx
        acc.u5.sxy += dx * (h.h.u5[k] - m5)
        acc.o60.sxx += dx * dx
        acc.o60.sxy += dx * (h.h.o60[k] - m6)
      }
      n += ks.length
    }
    const beta = (v: { sxx: number; sxy: number }) => (n >= MIN_PAIRS && v.sxx > 0 ? round2((v.sxy / v.sxx) * 10) : null)
    return { pollutant: p.label, key: p.value as string, balita: beta(acc.u5), lansia: beta(acc.o60), n }
  })
}

/* ---------- Grafik 3: akumulasi per jenis penyakit ---------- */

export function getDiseaseAccumulation(db: HealthDB, { region, range }: Pick<HealthFilters, "region" | "range">) {
  const i0 = dayIdx(db, range.from)
  const i1 = dayIdx(db, range.to)
  const tot: Record<DiseaseCol, number> = { resp: 0, cvd: 0, asthma: 0, copd: 0, death: 0 }
  for (const h of hospitalsIn(db, region)) {
    const [a, b] = bounds(h.idx, i0, i1)
    for (let k = a; k < b; k++) for (const d of DISEASE_COLS) tot[d.col] += h.h[d.col][k]
  }
  return DISEASE_COLS.map((d) => ({ disease: d.disease, label: d.label, total: tot[d.col] }))
}

/* ---------- Tabel & grafik proporsi per rumah sakit ---------- */

export type HospitalRow = {
  code: string
  name: string
  city: string
  station: string
  stationName: string
  stationFull: string
  classLabel: string
  status: Hospital["status"]
  hasData: boolean
  days: number
  /** polutan dengan rasio rata-rata ÷ baku mutu tertinggi di stasiun pasangan */
  dominantPollutant: { label: string; ratio: number } | null
  total: number
  dominantDisease: Disease | null
  /** kategori yang porsinya paling melebihi rata-rata RS lain di wilayah & periode yang sama (null bila tidak ada ≥ 1,1×) */
  standout: { disease: Disease; ratio: number } | null
  /** persen 5 kategori, urutan DISEASE_COLS */
  share: [number, number, number, number, number]
}

export function getHospitalRows(db: HealthDB, { region, range, disease }: Pick<HealthFilters, "region" | "range" | "disease">): HospitalRow[] {
  const i0 = dayIdx(db, range.from)
  const i1 = dayIdx(db, range.to)
  const catByCode = new Map<string, Record<DiseaseCol, number>>()
  const rows = hospitalsIn(db, region).map((h): HospitalRow => {
    const [a, b] = bounds(h.idx, i0, i1)
    const base = {
      code: h.code, name: h.name, city: h.city, station: h.station, stationName: h.stationName, stationFull: h.stationFull,
      classLabel: `${h.class} · ${h.beds} TT`, status: h.status,
    }
    if (b <= a)
      return { ...base, hasData: false, days: 0, dominantPollutant: null, total: 0, dominantDisease: null, standout: null, share: [0, 0, 0, 0, 0] }

    let total = 0
    const cat: Record<DiseaseCol, number> = { resp: 0, cvd: 0, asthma: 0, copd: 0, death: 0 }
    for (let k = a; k < b; k++) {
      total += casesAt(h, k, disease)
      for (const d of DISEASE_COLS) cat[d.col] += h.h[d.col][k]
    }
    catByCode.set(h.code, cat)
    const catSum = DISEASE_COLS.reduce((s, d) => s + cat[d.col], 0)
    const share = DISEASE_COLS.map((d) => (catSum ? round1((cat[d.col] / catSum) * 100) : 0)) as HospitalRow["share"]
    const dom = DISEASE_COLS.reduce((x, y) => (cat[y.col] > cat[x.col] ? y : x))

    let dp: HospitalRow["dominantPollutant"] = null
    for (const p of POLLUTANTS) {
      let s = 0
      let c = 0
      for (let k = a; k < b; k++) {
        const x = h.c[p.value][k]
        if (x != null) {
          s += x
          c++
        }
      }
      if (!c) continue
      const ratio = s / c / standardOf(p.value)
      if (!dp || ratio > dp.ratio) dp = { label: p.label, ratio: round1(ratio) }
    }
    return { ...base, hasData: true, days: b - a, dominantPollutant: dp, total, dominantDisease: dom.disease, standout: null, share }
  })

  // "Paling menonjol": porsi kategori di RS ÷ porsi kategori gabungan semua RS berdata pada filter yang sama
  const pooled: Record<DiseaseCol, number> = { resp: 0, cvd: 0, asthma: 0, copd: 0, death: 0 }
  for (const c of catByCode.values()) for (const d of DISEASE_COLS) pooled[d.col] += c[d.col]
  const pooledSum = DISEASE_COLS.reduce((t, d) => t + pooled[d.col], 0)
  if (catByCode.size >= 2 && pooledSum > 0) {
    for (const r of rows) {
      const c = catByCode.get(r.code)
      if (!c) continue
      const sum = DISEASE_COLS.reduce((t, d) => t + c[d.col], 0)
      if (sum < STANDOUT_MIN_CASES) continue
      let best: { disease: Disease; ratio: number } | null = null
      for (const d of DISEASE_COLS) {
        if (!pooled[d.col]) continue
        const ratio = c[d.col] / sum / (pooled[d.col] / pooledSum)
        if (!best || ratio > best.ratio) best = { disease: d.disease, ratio }
      }
      r.standout = best && best.ratio >= STANDOUT_MIN ? { disease: best.disease, ratio: round1(best.ratio) } : null
    }
  }
  return rows.sort((x, y) => (x.hasData !== y.hasData ? (x.hasData ? -1 : 1) : y.total - x.total))
}
