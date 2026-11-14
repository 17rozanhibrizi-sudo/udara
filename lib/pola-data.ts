/**
 * Lapisan data nyata untuk halaman "Pola, Tempat & Faktor Pemengaruh".
 * Sumber: public/data/pola-daily.json + public/data/pola-hourly/<polutan>-<wilayah>.json
 * (dibuat oleh scripts/build-pola-data.py). Semua fungsi murni, tanpa React.
 */
import {
  MONTHS_SHORT,
  POLLUTANTS,
  countDays,
  parseISO,
  toISO,
  type DateRange,
  type Pollutant,
  type Region,
} from "@/lib/data"

/* ---------- Tipe ---------- */

type MacroRegion = Exclude<Region, "nasional">
export type SiteGroup = "Tepi gambut" | "Perkotaan" | "Tepi jalan" | "Industri" | "Latar bersih"
export type StationStatus = "Active" | "Intermittent" | "Defective"

export type RawPolaStation = {
  code: string
  name: string
  fullName: string
  region: MacroRegion
  type: string
  group: SiteGroup
  status: StationStatus
  traffic: number
  distance: number
  completeness: number
  d: number[] // delta-encoded indeks hari
  c: Record<Pollutant, number[]>
  t: number[]
  h: number[]
  w: number[]
}
export type RawPola = { version: number; base: string; max: string; stations: RawPolaStation[] }

export type PolaStation = Omit<RawPolaStation, "d" | "c" | "t" | "h" | "w"> & {
  idx: number[]
  conc: Record<Pollutant, number[]>
  temp: number[]
  hum: number[]
  wind: number[]
}
export type PolaDB = { base: string; max: string; baseTime: number; stations: PolaStation[] }

export type RawHourly = { base: string; stations: { code: string; d: number[]; v: (number | null)[] }[] }
/** Data per jam satu polutan untuk stasiun-stasiun pada wilayah terpilih */
export type HourlyData = Map<string, { idx: number[]; v: (number | null)[] }>

export type PolaFilters = { region: Region; pollutant: Pollutant; range: DateRange }

export const DAY_MS = 86400000
const MIN_DAYS_CORR = 10 // minimal pasangan hari-stasiun agar r dihitung
const MIN_STATIONS_CORR = 3 // minimal stasiun untuk korelasi faktor statis
const MAX_SCATTER_POINTS = 1500
/** |r| di bawah ini dianggap korelasi lemah: tidak diklaim sebagai faktor dominan */
export const WEAK_R = 0.1

/* ---------- Muat & siapkan ---------- */

const cumulative = (d: number[]) => {
  let acc = 0
  return d.map((x, k) => (acc = k === 0 ? x : acc + x))
}

export function preparePolaDB(raw: RawPola): PolaDB {
  return {
    base: raw.base,
    max: raw.max,
    baseTime: parseISO(raw.base).getTime(),
    stations: raw.stations.map(({ d, c, t, h, w, ...meta }) => ({
      ...meta,
      idx: cumulative(d),
      conc: c,
      temp: t,
      hum: h,
      wind: w,
    })),
  }
}

export function prepareHourly(raws: RawHourly[]): HourlyData {
  const m: HourlyData = new Map()
  for (const r of raws) for (const s of r.stations) m.set(s.code, { idx: cumulative(s.d), v: s.v })
  return m
}

/* ---------- Helper ---------- */

const REGION_KEYS: MacroRegion[] = ["sumatera", "jawa", "kalimantan", "sulawesi", "maluku-papua"]
/** Wilayah (kunci file per jam) yang harus dimuat untuk pilihan slicer */
export const regionsToLoad = (region: Region): MacroRegion[] => (region === "nasional" ? REGION_KEYS : [region])

export const POLLUTANT_SLUG: Record<Pollutant, string> = {
  "PM2.5": "pm25", PM10: "pm10", CO: "co", SO2: "so2", NO2: "no2", O3: "o3",
}

function dayIdx(db: PolaDB, iso: string) {
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
/** posisi [a, b) pada array stasiun untuk indeks hari [i0, i1] */
const bounds = (idx: number[], i0: number, i1: number): [number, number] => [
  lowerBound(idx, i0),
  lowerBound(idx, i1 + 1),
]
const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100
const standardOf = (p: Pollutant) => POLLUTANTS.find((x) => x.value === p)!.standard
const isWeekend = (db: PolaDB, idx: number) => {
  const g = new Date(db.baseTime + idx * DAY_MS).getUTCDay()
  return g === 0 || g === 6
}

export function stationsInRegion(db: PolaDB, region: Region) {
  return region === "nasional" ? db.stations : db.stations.filter((s) => s.region === region)
}

function addMonthsIso(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number)
  const t = m - 1 + n
  const ny = y + Math.floor(t / 12)
  const nm = ((t % 12) + 12) % 12
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return toISO(new Date(Date.UTC(ny, nm, Math.min(d, last))))
}

/**
 * Spesifikasi: Δt ≤ 14 hari → per hari; 15 hari ≤ Δt ≤ 4 bulan → per minggu; Δt > 4 bulan → per bulan.
 * "4 bulan" dihitung bulan kalender: 15 Sep → 14 Jan masih per minggu, 15 Jan ke atas per bulan.
 */
export function periodGranularity(range: DateRange): "hari" | "minggu" | "bulan" {
  if (countDays(range) <= 14) return "hari"
  return range.to <= toISO(new Date(parseISO(addMonthsIso(range.from, 4)).getTime() - DAY_MS)) ? "minggu" : "bulan"
}

const multiYear = (range: DateRange) => range.from.slice(0, 4) !== range.to.slice(0, 4)
function fmtDate(iso: string, withYear: boolean) {
  const d = parseISO(iso)
  const base = `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`
  return withYear ? `${base} ${String(d.getUTCFullYear()).slice(2)}` : base
}
const isoAt = (db: PolaDB, idx: number) => toISO(new Date(db.baseTime + idx * DAY_MS))

/** Rata-rata lintas stasiun per hari pada rentang (null bila tidak ada stasiun berdata) */
function regionDailyMeans(db: PolaDB, f: PolaFilters) {
  const n = countDays(f.range)
  const i0 = dayIdx(db, f.range.from)
  const sums = new Float64Array(n)
  const cnt = new Uint16Array(n)
  for (const s of stationsInRegion(db, f.region)) {
    const [a, b] = bounds(s.idx, i0, i0 + n - 1)
    const arr = s.conc[f.pollutant]
    for (let k = a; k < b; k++) {
      const j = s.idx[k] - i0
      sums[j] += arr[k]
      cnt[j]++
    }
  }
  return { n, i0, sums, cnt, means: Array.from(sums, (v, j) => (cnt[j] ? v / cnt[j] : null)) }
}

/** Rangkaian terpanjang hari BERTURUT-TURUT (kalender) dengan nilai > ambang. Hari tanpa data memutus rangkaian. */
function longestRun(values: (number | null)[], std: number) {
  let best = { len: 0, start: -1 }
  let cur = { len: 0, start: -1 }
  values.forEach((v, i) => {
    if (v != null && v > std) {
      if (cur.len === 0) cur.start = i
      cur.len++
      if (cur.len > best.len) best = { ...cur }
    } else cur = { len: 0, start: -1 }
  })
  return best
}

/* ---------- Statistik ---------- */

export function linearFit(xs: number[], ys: number[]) {
  const n = xs.length
  if (n < 3) return null
  let mx = 0
  let my = 0
  for (let i = 0; i < n; i++) {
    mx += xs[i]
    my += ys[i]
  }
  mx /= n
  my /= n
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  if (sxx === 0 || syy === 0) return null
  const r = sxy / Math.sqrt(sxx * syy)
  const slope = sxy / sxx
  return { r, r2: r * r, slope, intercept: my - slope * mx, n }
}

/* ---------- 1. Pola harian per jam ---------- */

/**
 * Rata-rata konsentrasi per jam (0–23 WIB) pada wilayah & rentang terpilih.
 * Setiap pengamatan jam-stasiun berbobot sama.
 */
export function getHourlyProfile(db: PolaDB, hourly: HourlyData, f: PolaFilters) {
  const i0 = dayIdx(db, f.range.from)
  const i1 = dayIdx(db, f.range.to)
  const sum = new Float64Array(24)
  const cnt = new Uint32Array(24)
  for (const s of stationsInRegion(db, f.region)) {
    const h = hourly.get(s.code)
    if (!h) continue
    const [a, b] = bounds(h.idx, i0, i1)
    for (let k = a; k < b; k++)
      for (let hr = 0; hr < 24; hr++) {
        const v = h.v[k * 24 + hr]
        if (v != null) {
          sum[hr] += v
          cnt[hr]++
        }
      }
  }
  const points = Array.from({ length: 24 }, (_, hr) => ({
    hour: String(hr).padStart(2, "0"),
    value: cnt[hr] ? round1(sum[hr] / cnt[hr]) : null,
  }))
  const valid = points.filter((p): p is { hour: string; value: number } => p.value != null)
  const peak = valid.length ? valid.reduce((a, b) => (b.value > a.value ? b : a)) : null
  return { points, peak }
}

/* ---------- 2. Pola periodik (hari / minggu / bulan) ---------- */

export function getPeriodSeries(db: PolaDB, f: PolaFilters) {
  const gran = periodGranularity(f.range)
  const { n, i0, sums, cnt } = regionDailyMeans(db, f)
  const withYear = multiYear(f.range)
  const buckets: { label: string; s: number; c: number }[] = []

  const dateOf = (j: number) => isoAt(db, i0 + j)
  if (gran === "hari") {
    for (let j = 0; j < n; j++) buckets.push({ label: fmtDate(dateOf(j), withYear), s: sums[j], c: cnt[j] })
  } else if (gran === "minggu") {
    for (let j = 0; j < n; j += 7) {
      const e = Math.min(j + 6, n - 1)
      let s = 0
      let c = 0
      for (let k = j; k <= e; k++) {
        s += sums[k]
        c += cnt[k]
      }
      const a = parseISO(dateOf(j))
      const b = parseISO(dateOf(e))
      const label =
        j === e
          ? fmtDate(dateOf(j), withYear)
          : a.getUTCMonth() === b.getUTCMonth()
            ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]}${withYear ? ` ${String(b.getUTCFullYear()).slice(2)}` : ""}`
            : `${a.getUTCDate()} ${MONTHS_SHORT[a.getUTCMonth()]}–${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]}${withYear ? ` ${String(b.getUTCFullYear()).slice(2)}` : ""}`
      buckets.push({ label, s, c })
    }
  } else {
    let key = ""
    for (let j = 0; j < n; j++) {
      const iso = dateOf(j)
      if (iso.slice(0, 7) !== key) {
        key = iso.slice(0, 7)
        const d = parseISO(iso)
        buckets.push({
          label: `${MONTHS_SHORT[d.getUTCMonth()]}${withYear ? ` ${String(d.getUTCFullYear()).slice(2)}` : ""}`,
          s: 0,
          c: 0,
        })
      }
      buckets[buckets.length - 1].s += sums[j]
      buckets[buckets.length - 1].c += cnt[j]
    }
  }
  return {
    gran,
    // rata-rata semua pengamatan hari-stasiun pada bucket; null = tidak ada data
    points: buckets.map((b) => ({ label: b.label, value: b.c ? round1(b.s / b.c) : null })),
  }
}

/* ---------- 3. Kartu KPI: episode terpanjang & weekday vs weekend ---------- */

export function getLongestEpisode(db: PolaDB, f: PolaFilters) {
  const std = standardOf(f.pollutant)
  const { means, i0 } = regionDailyMeans(db, f)
  const run = longestRun(means, std)
  return { len: run.len, standard: std, ...episodeRange(db, f.range, i0, run) }
}

function episodeRange(db: PolaDB, range: DateRange, i0: number, run: { len: number; start: number }) {
  if (!run.len) return { range: "" }
  const y = multiYear(range)
  const a = fmtDate(isoAt(db, i0 + run.start), y)
  const b = fmtDate(isoAt(db, i0 + run.start + run.len - 1), y)
  return { range: run.len === 1 ? a : `${a} – ${b}` }
}

type WW = { weekday: number; weekend: number; diff: number; pct: number; nWeekday: number; nWeekend: number }

/** diff = weekday − weekend; pct = diff / weekday × 100 (positif = akhir pekan lebih bersih) */
function weekdayWeekend(db: PolaDB, list: PolaStation[], p: Pollutant, range: DateRange): WW | null {
  const i0 = dayIdx(db, range.from)
  const i1 = dayIdx(db, range.to)
  let sd = 0, nd = 0, se = 0, ne = 0
  for (const s of list) {
    const [a, b] = bounds(s.idx, i0, i1)
    const arr = s.conc[p]
    for (let k = a; k < b; k++) {
      if (isWeekend(db, s.idx[k])) { se += arr[k]; ne++ } else { sd += arr[k]; nd++ }
    }
  }
  if (!nd || !ne) return null
  const weekday = sd / nd
  const weekend = se / ne
  const diff = weekday - weekend
  return { weekday: round1(weekday), weekend: round1(weekend), diff: round1(diff), pct: weekday ? round1((diff / weekday) * 100) : 0, nWeekday: nd, nWeekend: ne }
}

export const getWeekdayWeekend = (db: PolaDB, f: PolaFilters) =>
  weekdayWeekend(db, stationsInRegion(db, f.region), f.pollutant, f.range)

/* ---------- 4. Korelasi Pearson & scatter ---------- */

export type FactorKey = "wind" | "traffic" | "distance" | "humidity" | "temp"
export const FACTORS: { key: FactorKey; label: string; unit: string; level: "harian" | "stasiun" }[] = [
  { key: "wind", label: "Kecepatan angin", unit: "m/s", level: "harian" },
  { key: "traffic", label: "Lalu lintas", unit: "kendaraan/jam", level: "stasiun" },
  { key: "distance", label: "Jarak ke jalan raya", unit: "m", level: "stasiun" },
  { key: "humidity", label: "Kelembapan", unit: "%", level: "harian" },
  { key: "temp", label: "Suhu", unit: "°C", level: "harian" },
]
/** Faktor yang bervariasi per hari di dalam satu stasiun (dipakai untuk "faktor dominan" per stasiun) */
const WEATHER_KEYS: FactorKey[] = ["wind", "humidity", "temp"]
export const factorMeta = (k: FactorKey) => FACTORS.find((x) => x.key === k)!

type Pt = { x: number; y: number; group: SiteGroup; code: string }

function weatherArr(s: PolaStation, k: FactorKey) {
  return k === "wind" ? s.wind : k === "humidity" ? s.hum : s.temp
}

/** Titik pengamatan sebuah faktor. Faktor cuaca: 1 titik = 1 hari-stasiun. Faktor statis (lalu lintas, jarak jalan): 1 titik = 1 stasiun (rata-rata periode). */
function factorPoints(db: PolaDB, f: PolaFilters, key: FactorKey): Pt[] {
  const i0 = dayIdx(db, f.range.from)
  const i1 = dayIdx(db, f.range.to)
  const out: Pt[] = []
  for (const s of stationsInRegion(db, f.region)) {
    const [a, b] = bounds(s.idx, i0, i1)
    if (b <= a) continue
    const arr = s.conc[f.pollutant]
    if (key === "traffic" || key === "distance") {
      let sum = 0
      for (let k = a; k < b; k++) sum += arr[k]
      out.push({ x: key === "traffic" ? s.traffic : s.distance, y: sum / (b - a), group: s.group, code: s.code })
    } else {
      const w = weatherArr(s, key)
      for (let k = a; k < b; k++) out.push({ x: w[k], y: arr[k], group: s.group, code: s.code })
    }
  }
  return out
}

function minPoints(key: FactorKey) {
  return factorMeta(key).level === "stasiun" ? MIN_STATIONS_CORR : MIN_DAYS_CORR
}

export function getCorrelations(db: PolaDB, f: PolaFilters) {
  const rows = FACTORS.map((fa) => {
    const pts = factorPoints(db, f, fa.key)
    const fit = pts.length >= minPoints(fa.key) ? linearFit(pts.map((p) => p.x), pts.map((p) => p.y)) : null
    return { factor: fa.label, key: fa.key, unit: fa.unit, level: fa.level, n: pts.length, r: fit ? round2(fit.r) : null }
  }).sort((a, b) => (b.r == null ? -1 : Math.abs(b.r)) - (a.r == null ? -1 : Math.abs(a.r))) // r null (n/a) selalu di bawah
  const dominant = rows.length && rows[0].r != null ? rows[0].key : null // |r| terbesar
  const dominantWeak = dominant != null && Math.abs(rows[0].r ?? 0) < WEAK_R
  return { rows, dominant, dominantWeak }
}

export function getScatter(db: PolaDB, f: PolaFilters, key: FactorKey) {
  const meta = factorMeta(key)
  const pts = factorPoints(db, f, key)
  const fit = pts.length >= minPoints(key) ? linearFit(pts.map((p) => p.x), pts.map((p) => p.y)) : null
  // titik yang digambar dikurangi (stride) bila terlalu banyak; r, R², dan garis tetap dari SEMUA titik
  const stride = Math.max(1, Math.ceil(pts.length / MAX_SCATTER_POINTS))
  const shown = pts.filter((_, i) => i % stride === 0).map((p) => ({ x: round2(p.x), y: round1(p.y), type: p.group, code: p.code }))
  let line: { x: number; y: number }[] = []
  if (fit) {
    let lo = Infinity
    let hi = -Infinity
    for (const p of pts) { if (p.x < lo) lo = p.x; if (p.x > hi) hi = p.x }
    line = [lo, hi].map((x) => ({ x: round2(x), y: round2(fit.intercept + fit.slope * x) }))
  }
  return {
    key, label: meta.label, unit: meta.unit, level: meta.level,
    points: shown, total: pts.length, line,
    slope: fit?.slope ?? null, intercept: fit?.intercept ?? null,
    r: fit?.r ?? null, r2: fit?.r2 ?? null,
  }
}

/* ---------- 5. Tabel rincian stasiun ---------- */

export type PolaRow = {
  code: string
  name: string
  fullName: string
  type: string
  status: StationStatus
  completeness: number
  hasData: boolean
  days: number
  avg: number | null
  /** jam WIB (0–23) dengan rata-rata tertinggi; null bila data per jam belum dimuat / tidak ada */
  worstHour: number | null
  peakMonth: string | null
  weekday: WW | null
  episode: { len: number; range: string }
  factor: { label: string; r: number; r2: number; weak: boolean } | null
}

export function getStationTable(db: PolaDB, hourly: HourlyData | null, f: PolaFilters): PolaRow[] {
  const i0 = dayIdx(db, f.range.from)
  const i1 = dayIdx(db, f.range.to)
  const n = countDays(f.range)
  const std = standardOf(f.pollutant)

  const rows = stationsInRegion(db, f.region).map((s): PolaRow => {
    const base = {
      code: s.code, name: s.name, fullName: s.fullName, type: s.type, status: s.status, completeness: s.completeness,
    }
    const [a, b] = bounds(s.idx, i0, i1)
    if (b <= a)
      return { ...base, hasData: false, days: 0, avg: null, worstHour: null, peakMonth: null, weekday: null,
        episode: { len: 0, range: "" }, factor: null }

    const arr = s.conc[f.pollutant]
    let sum = 0
    const mSum = new Float64Array(12)
    const mCnt = new Uint16Array(12)
    const series: (number | null)[] = new Array(n).fill(null)
    for (let k = a; k < b; k++) {
      sum += arr[k]
      const mo = new Date(db.baseTime + s.idx[k] * DAY_MS).getUTCMonth()
      mSum[mo] += arr[k]
      mCnt[mo]++
      series[s.idx[k] - i0] = arr[k]
    }
    // Puncak musiman: bulan kalender dengan rata-rata tertinggi (pilih bulan yang punya ≥5 hari data bila ada)
    const enough = Array.from(mCnt).some((c) => c >= 5)
    let peakMonth: string | null = null
    let best = -Infinity
    for (let m = 0; m < 12; m++) {
      if (!mCnt[m] || (enough && mCnt[m] < 5)) continue
      const v = mSum[m] / mCnt[m]
      if (v > best) { best = v; peakMonth = MONTHS_SHORT[m] }
    }

    // Jam terburuk dari data per jam
    let worstHour: number | null = null
    const h = hourly?.get(s.code)
    if (h) {
      const [ha, hb] = bounds(h.idx, i0, i1)
      const hs = new Float64Array(24)
      const hc = new Uint32Array(24)
      for (let k = ha; k < hb; k++)
        for (let hr = 0; hr < 24; hr++) {
          const v = h.v[k * 24 + hr]
          if (v != null) { hs[hr] += v; hc[hr]++ }
        }
      let hb2 = -Infinity
      for (let hr = 0; hr < 24; hr++) if (hc[hr] && hs[hr] / hc[hr] > hb2) { hb2 = hs[hr] / hc[hr]; worstHour = hr }
    }

    // Faktor dominan: variabel cuaca dengan |r| terbesar (lalu lintas & jarak jalan konstan per stasiun, tidak bisa dikorelasikan di dalam satu stasiun)
    let factor: PolaRow["factor"] = null
    if (b - a >= MIN_DAYS_CORR) {
      const ys = arr.slice(a, b)
      for (const key of WEATHER_KEYS) {
        const fit = linearFit(weatherArr(s, key).slice(a, b), ys)
        if (fit && (!factor || Math.abs(fit.r) > Math.abs(factor.r)))
          factor = { label: factorMeta(key).label, r: round2(fit.r), r2: round2(fit.r2), weak: Math.abs(fit.r) < WEAK_R }
      }
    }

    const run = longestRun(series, std)
    return {
      ...base, hasData: true, days: b - a, avg: round1(sum / (b - a)), worstHour, peakMonth,
      weekday: weekdayWeekend(db, [s], f.pollutant, f.range),
      episode: { len: run.len, ...episodeRange(db, f.range, i0, run) },
      factor,
    }
  })
  return rows.sort((x, y) => (y.avg ?? -1) - (x.avg ?? -1))
}
