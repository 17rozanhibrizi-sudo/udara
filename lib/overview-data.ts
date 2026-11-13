/**
 * Lapisan data nyata untuk halaman Overview.
 * Sumber: public/data/overview.json (dibuat oleh scripts/build-overview-data.py).
 * Semua fungsi murni (tanpa React) dan menerima `db` hasil prepareDB().
 */
import {
  MONTHS_SHORT,
  POLLUTANTS,
  countDays,
  parseISO,
  rangeDates,
  toISO,
  type DateRange,
  type Filters,
  type Pollutant,
  type PollutantSelection,
  type Region,
  type Station,
} from "@/lib/data"

/* ---------- Tipe ---------- */

export type StationStatus = "Active" | "Intermittent" | "Defective"
type MacroRegion = Exclude<Region, "nasional">

type Series = {
  idx: number[] // indeks hari sejak db.base (terurut)
  conc: Record<Pollutant, number[]> // µg/m³, sejajar dengan idx
  ispu: Record<PollutantSelection, number[]> // sub-indeks ISPU; "ALL" = ispu_score
}

type RawStation = {
  code: string
  sensorId: string
  hospitalId: string
  name: string
  fullName: string
  province: string
  city: string
  region: MacroRegion
  type: string
  lat: number
  lng: number
  status: StationStatus
  completeness: number
  d: number[] // delta-encoded indeks hari
  c: Record<Pollutant, number[]>
  i: Record<PollutantSelection, number[]>
}

export type RawOverview = { version: number; base: string; max: string; stations: RawStation[] }

type DBStation = Omit<RawStation, "d" | "c" | "i"> & Series

export type OverviewDB = { base: string; max: string; baseTime: number; stations: DBStation[] }

/** Station (dipakai StationMap) + info tambahan untuk halaman Overview */
export type OverviewStation = Station & {
  fullName: string
  province: string
  city: string
  status: StationStatus
  /** ada minimal 1 hari data pada rentang tanggal terpilih */
  hasData: boolean
  /** jumlah hari berdata pada rentang terpilih */
  days: number
  /** false bila pembanding tahun lalu tidak tersedia -> `yoy` = 0 dan jangan ditampilkan */
  yoyOk: boolean
}

/* ---------- Konstanta ---------- */

/** Lampiran VII PP 22/2021: CO & O3 baku mutunya per 8 jam (data harian dipakai sebagai pendekatan). */
export const STANDARD_WINDOW: Record<Pollutant, string> = {
  "PM2.5": "24 jam",
  PM10: "24 jam",
  SO2: "24 jam",
  NO2: "24 jam",
  CO: "8 jam",
  O3: "8 jam",
}

/** Minimal hari berdata di KEDUA periode agar YoY sebuah stasiun dihitung */
const MIN_YOY_DAYS = 3
const DAY_MS = 86400000

/* ---------- Muat & siapkan ---------- */

export function prepareDB(raw: RawOverview): OverviewDB {
  return {
    base: raw.base,
    max: raw.max,
    baseTime: parseISO(raw.base).getTime(),
    stations: raw.stations.map(({ d, c, i, ...meta }) => {
      const idx: number[] = []
      let acc = 0
      d.forEach((x, k) => {
        acc = k === 0 ? x : acc + x
        idx.push(acc)
      })
      return { ...meta, idx, conc: c, ispu: i }
    }),
  }
}

/* ---------- Helper ---------- */

function dayIdx(db: OverviewDB, iso: string) {
  return Math.round((parseISO(iso).getTime() - db.baseTime) / DAY_MS)
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

/** posisi [a, b) di array stasiun untuk rentang indeks hari [i0, i1] */
function bounds(s: Series, i0: number, i1: number): [number, number] {
  return [lowerBound(s.idx, i0), lowerBound(s.idx, i1 + 1)]
}

function standardOf(p: Pollutant) {
  return POLLUTANTS.find((x) => x.value === p)!.standard
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function ispuBucket(v: number) {
  return v <= 50 ? 0 : v <= 100 ? 1 : v <= 200 ? 2 : v <= 300 ? 3 : 4
}

function shiftIso(iso: string, years: number) {
  const [y, m, d] = iso.split("-").map(Number)
  const ny = y + years
  const last = new Date(Date.UTC(ny, m, 0)).getUTCDate() // clamp 29 Feb
  return toISO(new Date(Date.UTC(ny, m - 1, Math.min(d, last))))
}

/** Periode yang sama pada tahun sebelumnya */
export function previousYearRange(range: DateRange): DateRange {
  return { from: shiftIso(range.from, -1), to: shiftIso(range.to, -1) }
}

export function stationsInRegion(db: OverviewDB, region: Region) {
  return region === "nasional" ? db.stations : db.stations.filter((s) => s.region === region)
}

/* ---------- YoY ---------- */

function pairedStats(db: OverviewDB, s: DBStation, p: Pollutant, now: DateRange, prev: DateRange) {
  const [a0, a1] = bounds(s, dayIdx(db, now.from), dayIdx(db, now.to))
  const [b0, b1] = bounds(s, dayIdx(db, prev.from), dayIdx(db, prev.to))
  if (a1 - a0 < MIN_YOY_DAYS || b1 - b0 < MIN_YOY_DAYS) return null
  const sum = (arr: number[], x: number, y: number) => {
    let t = 0
    for (let k = x; k < y; k++) t += arr[k]
    return t
  }
  return { sNow: sum(s.conc[p], a0, a1), nNow: a1 - a0, sPrev: sum(s.conc[p], b0, b1), nPrev: b1 - b0 }
}

function pct(now: number, prev: number) {
  return prev > 0 ? round1(((now - prev) / prev) * 100) : null
}

function stationYoy(db: OverviewDB, s: DBStation, p: Pollutant, range: DateRange) {
  const prev = previousYearRange(range)
  if (dayIdx(db, prev.from) < 0) return null
  const st = pairedStats(db, s, p, range, prev)
  return st ? pct(st.sNow / st.nNow, st.sPrev / st.nPrev) : null
}

/** YoY wilayah: hanya stasiun yang punya data di kedua periode (apple-to-apple) */
function regionYoy(db: OverviewDB, list: DBStation[], p: Pollutant, range: DateRange) {
  const prev = previousYearRange(range)
  if (dayIdx(db, prev.from) < 0) return null
  let sNow = 0, nNow = 0, sPrev = 0, nPrev = 0
  for (const s of list) {
    const st = pairedStats(db, s, p, range, prev)
    if (!st) continue
    sNow += st.sNow; nNow += st.nNow; sPrev += st.sPrev; nPrev += st.nPrev
  }
  return nNow && nPrev ? pct(sNow / nNow, sPrev / nPrev) : null
}

/* ---------- KPI ---------- */

export function getOverviewKpis(db: OverviewDB, { region, pollutant, range }: Filters) {
  const list = stationsInRegion(db, region)
  const i0 = dayIdx(db, range.from)
  const i1 = dayIdx(db, range.to)
  const std = standardOf(pollutant)
  let sum = 0, n = 0, excSum = 0, withData = 0
  for (const s of list) {
    const [a, b] = bounds(s, i0, i1)
    if (b <= a) continue
    withData++
    const arr = s.conc[pollutant]
    let exc = 0
    for (let k = a; k < b; k++) {
      sum += arr[k]
      n++
      if (arr[k] > std) exc++
    }
    excSum += exc
  }
  return {
    avg: n ? round1(sum / n) : null,
    /** rata-rata (per stasiun) jumlah hari di atas baku mutu */
    above: withData ? round1(excSum / withData) : null,
    days: countDays(range),
    stationCount: withData,
    yoy: regionYoy(db, list, pollutant, range),
  }
}

/* ---------- Deret waktu ---------- */

function dayLabels(range: DateRange) {
  const dates = rangeDates(range)
  const multiYear = dates.length > 1 && dates[0].getUTCFullYear() !== dates[dates.length - 1].getUTCFullYear()
  return dates.map((d) => {
    const base = `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`
    return multiYear ? `${base} ${String(d.getUTCFullYear()).slice(2)}` : base
  })
}

/** rata-rata lintas stasiun per hari; null bila tidak ada stasiun berdata pada hari itu */
function dailyMeans(db: OverviewDB, region: Region, p: Pollutant, range: DateRange) {
  const n = countDays(range)
  const i0 = dayIdx(db, range.from)
  const sums = new Float64Array(n)
  const cnt = new Uint16Array(n)
  for (const s of stationsInRegion(db, region)) {
    const [a, b] = bounds(s, i0, i0 + n - 1)
    const arr = s.conc[p]
    for (let k = a; k < b; k++) {
      const j = s.idx[k] - i0
      sums[j] += arr[k]
      cnt[j]++
    }
  }
  return Array.from(sums, (v, j) => (cnt[j] ? round1(v / cnt[j]) : null))
}

export function getDailySeries(db: OverviewDB, { region, pollutant, range }: Filters) {
  const labels = dayLabels(range)
  const std = standardOf(pollutant)
  return dailyMeans(db, region, pollutant, range).map((value, i) => ({ day: labels[i], value, standard: std }))
}

/** Baris multi-seri: { label, "PM2.5": % baku mutu, PM10: ..., ... } */
export type MultiRow = { label: string } & Partial<Record<Pollutant, number>>

export function getDailySeriesAll(db: OverviewDB, { region, range }: Omit<Filters, "pollutant">): MultiRow[] {
  const labels = dayLabels(range)
  const per = POLLUTANTS.map((p) => ({ p, v: dailyMeans(db, region, p.value, range) }))
  return labels.map((label, i) => {
    const row: MultiRow = { label }
    per.forEach(({ p, v }) => {
      const x = v[i]
      if (x != null) row[p.value] = round1((x / p.standard) * 100)
    })
    return row
  })
}

/* ---------- Melampaui baku mutu ---------- */

/** % hari-stasiun yang melampaui baku mutu, per polutan */
export function getExceedance(db: OverviewDB, { region, range }: Omit<Filters, "pollutant">) {
  const list = stationsInRegion(db, region)
  const i0 = dayIdx(db, range.from)
  const i1 = dayIdx(db, range.to)
  return POLLUTANTS.map((p) => {
    let exc = 0, n = 0
    for (const s of list) {
      const [a, b] = bounds(s, i0, i1)
      const arr = s.conc[p.value]
      for (let k = a; k < b; k++) {
        n++
        if (arr[k] > p.standard) exc++
      }
    }
    return { pollutant: p.label, key: p.value as string, value: n ? round1((exc / n) * 100) : 0 }
  })
}

/* ---------- Stasiun (peta, distribusi ISPU, YoY) ---------- */

export function getOverviewStations(
  db: OverviewDB,
  region: Region,
  range: DateRange,
  selection: PollutantSelection,
): OverviewStation[] {
  const i0 = dayIdx(db, range.from)
  const i1 = dayIdx(db, range.to)
  const p: Pollutant = selection === "ALL" ? "PM2.5" : selection // acuan untuk rata-rata & YoY

  return stationsInRegion(db, region).map((s) => {
    const [a, b] = bounds(s, i0, i1)
    const n = b - a
    const ispuArr = s.ispu[selection]
    const counts = [0, 0, 0, 0, 0]
    let sum = 0
    for (let k = a; k < b; k++) {
      counts[ispuBucket(ispuArr[k])]++
      sum += s.conc[p][k]
    }
    const dist = counts.map((c) => (n ? round1((c / n) * 100) : 0)) as Station["ispu"]
    const yoy = stationYoy(db, s, p, range)
    return {
      code: s.code,
      name: s.name,
      region: s.region,
      type: s.type,
      lat: s.lat,
      lng: s.lng,
      avg: n ? round1(sum / n) : 0,
      ispuNow: n ? ispuArr[b - 1] : 0, // hari terakhir berdata pada rentang
      ispu: dist,
      yoy: yoy ?? 0,
      completeness: s.completeness,
      // field Station yang belum dipakai halaman Overview
      peakHour: "–",
      season: "–",
      weekdayDiff: "–",
      episode: 0,
      factor: "–",
      r: 0,
      r2: 0,
      fullName: s.fullName,
      province: s.province,
      city: s.city,
      status: s.status,
      hasData: n > 0,
      days: n,
      yoyOk: yoy != null,
    }
  })
}
