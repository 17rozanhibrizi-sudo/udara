export type Region = "nasional" | "sumatera" | "jawa" | "kalimantan" | "sulawesi" | "maluku-papua"
export type Pollutant = "PM2.5" | "PM10" | "CO" | "SO2" | "NO2" | "O3"
export type Disease = "ISPA" | "Kardiovaskular" | "Asma darurat" | "PPOK" | "Kematian"
export type IspuKey = "baik" | "sedang" | "tidakSehat" | "sangat" | "bahaya"

export const REGIONS: { value: Region; label: string; factor: number; yoy: number }[] = [
  { value: "nasional", label: "Semua Wilayah", factor: 0.84, yoy: 4.2 },
  { value: "sumatera", label: "Sumatera", factor: 0.93, yoy: 6.2 },
  { value: "jawa", label: "Jawa", factor: 0.78, yoy: -3.1 },
  { value: "kalimantan", label: "Kalimantan", factor: 1, yoy: 9.6 },
  { value: "sulawesi", label: "Sulawesi", factor: 0.72, yoy: 1.8 },
  { value: "maluku-papua", label: "Papua", factor: 0.55, yoy: -2.4 },
]

export const POLLUTANTS: {
  value: Pollutant
  label: string
  standard: number
  ratio: number
  exceed: number
}[] = [
  { value: "PM2.5", label: "PM2.5", standard: 55, ratio: 1, exceed: 41 },
  { value: "PM10", label: "PM10", standard: 75, ratio: 0.86, exceed: 22 },
  { value: "CO", label: "CO", standard: 4000, ratio: 0.42, exceed: 1 },
  { value: "SO2", label: "SO₂", standard: 75, ratio: 0.48, exceed: 2 },
  { value: "NO2", label: "NO₂", standard: 65, ratio: 0.55, exceed: 4 },
  { value: "O3", label: "O₃", standard: 100, ratio: 0.6, exceed: 6 },
]

/* ---------- Rentang tanggal (kalender) ---------- */

export type DateRange = { from: string; to: string } // ISO yyyy-mm-dd

/** Periode observasi data nyata (03_aqms_daily_ispu.csv) */
export const DATA_MIN = "2024-01-01"
export const DATA_MAX = "2026-10-14"

const lastNDays = (n: number): DateRange => ({ from: toISO(addDays(parseISO(DATA_MAX), -(n - 1))), to: DATA_MAX })

export const DEFAULT_RANGE: DateRange = lastNDays(30)

export const RANGE_PRESETS: { label: string; range: DateRange }[] = [
  { label: "30 hari terakhir", range: lastNDays(30) },
  { label: "90 hari terakhir", range: lastNDays(90) },
  { label: "Oktober 2025", range: { from: "2025-10-01", to: "2025-10-31" } },
  { label: "Tahun 2025", range: { from: "2025-01-01", to: "2025-12-31" } },
  { label: "Semua periode", range: { from: DATA_MIN, to: DATA_MAX } },
]

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
export const MONTHS_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

export function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
export function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}
export function addDays(d: Date, n: number) {
  const x = new Date(d.getTime())
  x.setUTCDate(x.getUTCDate() + n)
  return x
}
export function rangeDates(range: DateRange) {
  const out: Date[] = []
  const end = parseISO(range.to).getTime()
  for (let d = parseISO(range.from); d.getTime() <= end; d = addDays(d, 1)) out.push(d)
  return out
}
export function countDays(range: DateRange) {
  return Math.round((parseISO(range.to).getTime() - parseISO(range.from).getTime()) / 86400000) + 1
}
/** "1 Okt – 31 Okt 2025" */
export function formatRange(range: DateRange) {
  const a = parseISO(range.from)
  const b = parseISO(range.to)
  const fa = `${a.getUTCDate()} ${MONTHS_SHORT[a.getUTCMonth()]}`
  const fb = `${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]} ${b.getUTCFullYear()}`
  return a.getUTCFullYear() === b.getUTCFullYear() ? `${fa} – ${fb}` : `${fa} ${a.getUTCFullYear()} – ${fb}`
}
/** "1–31 Okt 2025" (satu bulan) atau "1 Sep – 15 Okt 2025" */
export function formatRangeShort(range: DateRange) {
  const a = parseISO(range.from)
  const b = parseISO(range.to)
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) {
    return a.getUTCDate() === b.getUTCDate()
      ? `${a.getUTCDate()} ${MONTHS_SHORT[a.getUTCMonth()]} ${a.getUTCFullYear()}`
      : `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]} ${b.getUTCFullYear()}`
  }
  return formatRange(range)
}

// Faktor musiman dummy per bulan (Agu, Sep, Okt)
const MONTH_FACTOR: Record<number, number> = { 7: 0.9, 8: 1.08, 9: 1 }
function monthFactor(d: Date) {
  return MONTH_FACTOR[d.getUTCMonth()] ?? 1
}
export function rangeFactor(range: DateRange) {
  const ds = rangeDates(range)
  return ds.reduce((a, d) => a + monthFactor(d), 0) / Math.max(ds.length, 1)
}
/** Pengali total kasus dummy relatif terhadap Oktober (31 hari) */
export function caseScale(range: DateRange) {
  return (countDays(range) / 31) * rangeFactor(range)
}
/** Spesifikasi: ≤14 hari = per hari, 15 hari–4 bulan = per minggu, >4 bulan = per bulan */
export function getPeriodGranularity(range: DateRange): "hari" | "minggu" | "bulan" {
  const n = countDays(range)
  if (n <= 14) return "hari"
  if (n <= 122) return "minggu"
  return "bulan"
}

export const DISEASES: {
  value: Disease
  total: number
  group: string
  groupShare: number
  groupNote: string
  lag: number
  r: number
}[] = [
  { value: "ISPA", total: 1754, group: "Balita (<5 th)", groupShare: 58, groupNote: "balita 58% vs lansia (>60 th) 42%", lag: 2, r: 0.58 },
  { value: "Kardiovaskular", total: 612, group: "Lansia (>60 th)", groupShare: 71, groupNote: "lansia 71% vs dewasa 29%", lag: 1, r: 0.41 },
  { value: "Asma darurat", total: 288, group: "Anak (5–14 th)", groupShare: 44, groupNote: "anak 44% · dewasa 35% · lansia 21%", lag: 1, r: 0.47 },
  { value: "PPOK", total: 341, group: "Lansia (>60 th)", groupShare: 83, groupNote: "lansia 83% vs dewasa 17%", lag: 3, r: 0.39 },
  { value: "Kematian", total: 57, group: "Lansia (>60 th)", groupShare: 76, groupNote: "lansia 76% vs lainnya 24%", lag: 4, r: 0.28 },
]

export const ISPU_CATEGORIES: { key: IspuKey; label: string; color: string; range: string }[] = [
  { key: "baik", label: "Baik", color: "var(--ispu-baik)", range: "0–50" },
  { key: "sedang", label: "Sedang", color: "var(--ispu-sedang)", range: "51–100" },
  { key: "tidakSehat", label: "Tidak sehat", color: "var(--ispu-tidak-sehat)", range: "101–200" },
  { key: "sangat", label: "Sangat tidak sehat", color: "var(--ispu-sangat)", range: "201–300" },
  { key: "bahaya", label: "Berbahaya", color: "var(--ispu-bahaya)", range: ">300" },
]

export function ispuCategory(ispu: number) {
  if (ispu <= 50) return ISPU_CATEGORIES[0]
  if (ispu <= 100) return ISPU_CATEGORIES[1]
  if (ispu <= 200) return ISPU_CATEGORIES[2]
  if (ispu <= 300) return ISPU_CATEGORIES[3]
  return ISPU_CATEGORIES[4]
}

export type Station = {
  code: string
  name: string
  region: Exclude<Region, "nasional">
  type: string
  lat: number
  lng: number
  avg: number
  ispuNow: number
  ispu: [number, number, number, number, number]
  yoy: number
  peakHour: string
  season: string
  weekdayDiff: string
  episode: number
  factor: string
  r: number
  r2: number
  completeness: number
}

export const STATIONS: Station[] = [
  { code: "LOC-KTG-02", name: "Kotawaringin Timur", region: "kalimantan", type: "Tepi gambut", lat: -2.54, lng: 112.95, avg: 62.4, ispuNow: 228, ispu: [14, 32, 28, 18, 8], yoy: 24, peakHour: "07.00", season: "Sep–Okt", weekdayDiff: "+5,1 (+8%)", episode: 9, factor: "Kecepatan angin", r: -0.58, r2: 0.34, completeness: 97 },
  { code: "LOC-KTG-01", name: "Palangka Raya", region: "kalimantan", type: "Perkotaan", lat: -2.21, lng: 113.92, avg: 55.8, ispuNow: 212, ispu: [17, 35, 27, 15, 6], yoy: 18, peakHour: "08.00", season: "Sep–Okt", weekdayDiff: "+4,3 (+8%)", episode: 7, factor: "Kelembapan", r: -0.49, r2: 0.24, completeness: 95 },
  { code: "LOC-PKN-01", name: "Kotawaringin Barat", region: "kalimantan", type: "Tepi gambut", lat: -2.68, lng: 111.63, avg: 48.9, ispuNow: 134, ispu: [22, 38, 24, 12, 4], yoy: 11, peakHour: "06.00", season: "Agu–Sep", weekdayDiff: "+3,0 (+6%)", episode: 5, factor: "Kecepatan angin", r: -0.44, r2: 0.19, completeness: 91 },
  { code: "LOC-STG-01", name: "Sintang", region: "kalimantan", type: "Pinggiran kota", lat: 0.07, lng: 111.5, avg: 44.1, ispuNow: 86, ispu: [30, 42, 20, 7, 1], yoy: 3, peakHour: "07.00", season: "Sep", weekdayDiff: "+2,8 (+6%)", episode: 4, factor: "Kecepatan angin", r: -0.41, r2: 0.17, completeness: 93 },
  { code: "LOC-SM2-01", name: "Samarinda", region: "kalimantan", type: "Perkotaan", lat: -0.5, lng: 117.15, avg: 33.5, ispuNow: 72, ispu: [38, 45, 14, 3, 0], yoy: -5, peakHour: "19.00", season: "Sep", weekdayDiff: "+6,8 (+20%)", episode: 2, factor: "Lalu lintas", r: 0.51, r2: 0.26, completeness: 98 },
  { code: "LOC-BJB-01", name: "Banjarbaru", region: "kalimantan", type: "Latar bersih", lat: -3.44, lng: 114.83, avg: 29.7, ispuNow: 41, ispu: [45, 42, 11, 2, 0], yoy: -9, peakHour: "08.00", season: "Sep", weekdayDiff: "+1,9 (+7%)", episode: 1, factor: "Suhu", r: 0.23, r2: 0.05, completeness: 96 },
  { code: "LOC-PKU-01", name: "Pekanbaru", region: "sumatera", type: "Perkotaan & gambut", lat: 0.47, lng: 101.45, avg: 58.6, ispuNow: 176, ispu: [15, 33, 30, 16, 6], yoy: 14, peakHour: "07.00", season: "Agu–Sep", weekdayDiff: "+4,0 (+7%)", episode: 8, factor: "Kecepatan angin", r: -0.55, r2: 0.3, completeness: 94 },
  { code: "LOC-PLM-01", name: "Palembang", region: "sumatera", type: "Perkotaan", lat: -2.98, lng: 104.76, avg: 46.2, ispuNow: 118, ispu: [24, 40, 24, 10, 2], yoy: 7, peakHour: "07.00", season: "Sep–Okt", weekdayDiff: "+3,6 (+8%)", episode: 5, factor: "Kecepatan angin", r: -0.46, r2: 0.21, completeness: 92 },
  { code: "LOC-JMB-01", name: "Jambi", region: "sumatera", type: "Tepi gambut", lat: -1.61, lng: 103.61, avg: 42.8, ispuNow: 94, ispu: [28, 41, 21, 8, 2], yoy: 5, peakHour: "06.00", season: "Sep", weekdayDiff: "+2,5 (+6%)", episode: 4, factor: "Kelembapan", r: -0.38, r2: 0.14, completeness: 90 },
  { code: "LOC-JKT-01", name: "Jakarta Pusat", region: "jawa", type: "Urban padat", lat: -6.18, lng: 106.83, avg: 45.4, ispuNow: 108, ispu: [20, 48, 26, 6, 0], yoy: -2, peakHour: "08.00", season: "Jul–Agu", weekdayDiff: "+7,9 (+19%)", episode: 6, factor: "Lalu lintas", r: 0.57, r2: 0.32, completeness: 99 },
  { code: "LOC-BDG-01", name: "Bandung", region: "jawa", type: "Perkotaan", lat: -6.91, lng: 107.61, avg: 36.9, ispuNow: 68, ispu: [32, 46, 18, 4, 0], yoy: -4, peakHour: "08.00", season: "Agu", weekdayDiff: "+6,1 (+18%)", episode: 3, factor: "Lalu lintas", r: 0.49, r2: 0.24, completeness: 97 },
  { code: "LOC-SBY-01", name: "Surabaya", region: "jawa", type: "Industri", lat: -7.25, lng: 112.75, avg: 39.7, ispuNow: 79, ispu: [27, 47, 21, 5, 0], yoy: 1, peakHour: "09.00", season: "Agu–Sep", weekdayDiff: "+5,2 (+14%)", episode: 3, factor: "Industri", r: 0.44, r2: 0.19, completeness: 96 },
  { code: "LOC-MKS-01", name: "Makassar", region: "sulawesi", type: "Perkotaan", lat: -5.15, lng: 119.43, avg: 38.2, ispuNow: 74, ispu: [29, 45, 20, 6, 0], yoy: 2, peakHour: "07.00", season: "Sep", weekdayDiff: "+5,4 (+14%)", episode: 3, factor: "Lalu lintas", r: 0.46, r2: 0.21, completeness: 96 },
  { code: "LOC-PLU-01", name: "Palu", region: "sulawesi", type: "Perkotaan", lat: -0.9, lng: 119.87, avg: 34.6, ispuNow: 66, ispu: [34, 46, 16, 4, 0], yoy: -1, peakHour: "08.00", season: "Agu–Sep", weekdayDiff: "+4,1 (+12%)", episode: 2, factor: "Kecepatan angin", r: -0.37, r2: 0.14, completeness: 93 },
  { code: "LOC-AMQ-01", name: "Ambon", region: "maluku-papua", type: "Pesisir", lat: -3.7, lng: 128.18, avg: 24.8, ispuNow: 38, ispu: [52, 38, 8, 2, 0], yoy: -6, peakHour: "07.00", season: "Agu", weekdayDiff: "+1,6 (+7%)", episode: 1, factor: "Kelembapan", r: -0.28, r2: 0.08, completeness: 89 },
  { code: "LOC-DJJ-01", name: "Jayapura", region: "maluku-papua", type: "Perkotaan", lat: -2.53, lng: 140.72, avg: 27.3, ispuNow: 47, ispu: [47, 41, 9, 3, 0], yoy: 2, peakHour: "08.00", season: "Sep", weekdayDiff: "+2,2 (+9%)", episode: 1, factor: "Lalu lintas", r: 0.33, r2: 0.11, completeness: 88 },
]

export function getStations(region: Region) {
  return region === "nasional" ? STATIONS : STATIONS.filter((s) => s.region === region)
}

export function getRegion(region: Region) {
  return REGIONS.find((r) => r.value === region)!
}
export function getPollutant(p: Pollutant) {
  return POLLUTANTS.find((x) => x.value === p)!
}
export function getDisease(d: Disease) {
  return DISEASES.find((x) => x.value === d)!
}

const BASE_DAILY = [
  37, 41, 46, 50, 52, 47, 49, 50, 50, 49, 38, 37, 36, 36, 37, 30, 33, 38, 43, 50, 47, 54, 60, 66, 70, 64, 66, 67,
  67, 66, 56,
]

export type Filters = { region: Region; pollutant: Pollutant; range: DateRange }

export function filterFactor({ region, pollutant, range }: Filters) {
  return getRegion(region).factor * rangeFactor(range) * getPollutant(pollutant).ratio
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

export function getDailySeries(filters: Filters) {
  const pol = getPollutant(filters.pollutant)
  const base = (getRegion(filters.region).factor * pol.ratio * pol.standard) / 55
  return rangeDates(filters.range).map((d) => ({
    day: `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`,
    value: round1(BASE_DAILY[d.getUTCDate() - 1] * base * monthFactor(d)),
    standard: pol.standard,
  }))
}

export function getOverviewKpis(filters: Filters) {
  const series = getDailySeries(filters)
  const avg = series.reduce((a, b) => a + b.value, 0) / series.length
  const above = series.filter((d) => d.value > d.standard).length
  const pollutantShift = { "PM2.5": 0, PM10: -1.4, CO: -4.2, SO2: -2.7, NO2: 1.3, O3: 2.1 }[filters.pollutant]
  return {
    avg: round1(avg),
    above,
    days: series.length,
    yoy: round1(getRegion(filters.region).yoy + pollutantShift),
  }
}

export function getExceedance(filters: Filters) {
  const factor = getRegion(filters.region).factor * rangeFactor(filters.range)
  return POLLUTANTS.map((p) => ({
    pollutant: p.label,
    key: p.value,
    value: Math.min(100, Math.round(p.exceed * factor)),
  }))
}

export const HOURLY_BASE = [36, 36, 36, 36, 37, 40, 45, 48, 48, 45, 40, 37, 36, 36, 36, 37, 38, 41, 43, 45, 43, 40, 37, 36]

export function getHourlySeries(filters: Filters) {
  const f = filterFactor(filters) * (getPollutant(filters.pollutant).standard / 55)
  return HOURLY_BASE.map((v, h) => ({ hour: String(h).padStart(2, "0"), value: round1(v * f) }))
}

export function getWeeklySeries(filters: Filters) {
  const series = getDailySeries(filters)
  const dates = rangeDates(filters.range)
  const gran = getPeriodGranularity(filters.range)
  const mean = (v: number[]) => v.reduce((x, y) => x + y, 0) / v.length
  if (gran === "hari") return series.map((d) => ({ week: d.day, value: Math.round(d.value) }))
  if (gran === "bulan") {
    const groups = new Map<string, number[]>()
    series.forEach((d, i) => {
      const key = `${MONTHS_SHORT[dates[i].getUTCMonth()]}`
      groups.set(key, [...(groups.get(key) ?? []), d.value])
    })
    return [...groups].map(([week, v]) => ({ week, value: Math.round(mean(v)) }))
  }
  const out: { week: string; value: number }[] = []
  for (let i = 0; i < series.length; i += 7) {
    const chunk = series.slice(i, i + 7)
    const a = dates[i]
    const b = dates[i + chunk.length - 1]
    const sameMonth = a.getUTCMonth() === b.getUTCMonth()
    const label = sameMonth
      ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]}`
      : `${a.getUTCDate()} ${MONTHS_SHORT[a.getUTCMonth()]}–${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]}`
    out.push({ week: label, value: Math.round(mean(chunk.map((d) => d.value))) })
  }
  return out
}

/** Episode terpanjang: hari berturut-turut rata-rata harian > baku mutu */
export function getLongestEpisode(filters: Filters) {
  const series = getDailySeries(filters)
  let best = { len: 0, start: -1 }
  let cur = { len: 0, start: -1 }
  series.forEach((d, i) => {
    if (d.value > d.standard) {
      if (cur.len === 0) cur.start = i
      cur.len++
      if (cur.len > best.len) best = { ...cur }
    } else {
      cur = { len: 0, start: -1 }
    }
  })
  if (best.len === 0) return { len: 0, range: "" }
  const a = series[best.start].day
  const b = series[best.start + best.len - 1].day
  return { len: best.len, range: best.len === 1 ? a : `${a} – ${b}` }
}

/* ---------- Opsi "Semua polutan" ---------- */

export type PollutantSelection = Pollutant | "ALL"

export const ALL_POLLUTANTS = "ALL" as const

/** Dipakai dropdown: "Semua polutan" paling atas, lalu satu polutan per item */
export const POLLUTANT_OPTIONS: { value: PollutantSelection; label: string }[] = [
  { value: "ALL", label: "Semua polutan" },
  ...POLLUTANTS.map((p) => ({ value: p.value as PollutantSelection, label: p.label })),
]

/** Panel yang hanya cocok untuk satu polutan (korelasi, scatter) memakai fallback ini */
export function resolvePollutant(sel: PollutantSelection): Pollutant {
  return sel === "ALL" ? "PM2.5" : sel
}

/** Warna per polutan untuk grafik multi-seri (ganti dengan token warna proyekmu bila ada) */
export const POLLUTANT_COLORS: Record<Pollutant, string> = {
  "PM2.5": "#0f766e",
  PM10: "#2563eb",
  CO: "#7c3aed",
  SO2: "#ea580c",
  NO2: "#db2777",
  O3: "#65a30d",
}

type BaseFilters = Omit<Filters, "pollutant">

/** Baris multi-seri: { label: "07", "PM2.5": 74.5, PM10: 58.1, ... } dalam % baku mutu */
export type MultiRow = { label: string } & Partial<Record<Pollutant, number>>

export function getHourlySeriesAll(base: BaseFilters): MultiRow[] {
  const perPol = POLLUTANTS.map((p) => ({ p, s: getHourlySeries({ ...base, pollutant: p.value }) }))
  return perPol[0].s.map((h, i) => {
    const row: MultiRow = { label: h.hour }
    perPol.forEach(({ p, s }) => {
      row[p.value] = round1((s[i].value / p.standard) * 100)
    })
    return row
  })
}

export function getDailySeriesAll(base: BaseFilters): MultiRow[] {
  const perPol = POLLUTANTS.map((p) => ({ p, s: getDailySeries({ ...base, pollutant: p.value }) }))
  return perPol[0].s.map((d, i) => {
    const row: MultiRow = { label: d.day }
    perPol.forEach(({ p, s }) => {
      row[p.value] = round1((s[i].value / p.standard) * 100)
    })
    return row
  })
}

export function getWeeklySeriesAll(base: BaseFilters): MultiRow[] {
  const perPol = POLLUTANTS.map((p) => ({ p, s: getWeeklySeries({ ...base, pollutant: p.value }) }))
  return perPol[0].s.map((w, i) => {
    const row: MultiRow = { label: w.week }
    perPol.forEach(({ p, s }) => {
      row[p.value] = Math.round((s[i].value / p.standard) * 100)
    })
    return row
  })
}

/** Kartu "Episode terpanjang" untuk mode semua: satu baris per polutan */
export function getLongestEpisodeAll(base: BaseFilters) {
  return POLLUTANTS.map((p) => ({
    pollutant: p.label,
    key: p.value,
    ...getLongestEpisode({ ...base, pollutant: p.value }),
  }))
}

/* ---------- Korelasi & scatter ---------- */

export const CORRELATIONS = [
  { factor: "Kecepatan angin", r: -0.52, unit: "m/s", min: 0.5, max: 6.2 },
  { factor: "Lalu lintas", r: 0.41, unit: "rb kendaraan/jam", min: 0.5, max: 8 },
  { factor: "Jarak ke jalan raya", r: -0.35, unit: "km", min: 0.1, max: 6 },
  { factor: "Kelembapan", r: -0.31, unit: "%", min: 55, max: 95 },
  { factor: "Suhu", r: 0.22, unit: "°C", min: 24, max: 35 },
  { factor: "Arah angin*", r: 0.18, unit: "komponen sin", min: -1, max: 1 },
]

export const LOCATION_TYPES = ["Tepi gambut", "Perkotaan", "Tepi jalan", "Industri", "Latar bersih"] as const

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function getScatter(factorName: string, scale: number) {
  const c = CORRELATIONS.find((x) => x.factor === factorName) ?? CORRELATIONS[0]
  const rand = seeded(factorName.length * 97 + 13)
  const typeBase: Record<string, number> = {
    "Tepi gambut": 22,
    Perkotaan: 6,
    "Tepi jalan": 10,
    Industri: 4,
    "Latar bersih": -18,
  }
  const n = 30
  const range = c.max - c.min
  const t = Array.from({ length: n }, () => rand())
  const types = Array.from({ length: n }, (_, i) => LOCATION_TYPES[i % LOCATION_TYPES.length])
  const noise = types.map((ty) => (rand() - 0.5) * 34 + typeBase[ty] * 0.6)

  // Bangun y sehingga korelasi sampel = r pada grafik Pearson (tampilan konsisten)
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const sd = (a: number[]) => Math.sqrt(mean(a.map((v) => (v - mean(a)) ** 2)))
  const z = (a: number[]) => a.map((v) => (v - mean(a)) / sd(a))
  const zx = z(t)
  const cov = mean(noise.map((v, i) => (v - mean(noise)) * zx[i]))
  const ze = z(noise.map((v, i) => v - mean(noise) - cov * zx[i]))
  const zy = zx.map((v, i) => c.r * v + Math.sqrt(1 - c.r * c.r) * ze[i])

  const xsRaw = t.map((v) => c.min + v * range)
  const ysRaw = zy.map((v) => (58 + 14 * v) * scale)
  const mx = mean(xsRaw)
  const my = mean(ysRaw)
  const slope = c.r * (sd(ysRaw) / sd(xsRaw))
  const intercept = my - slope * mx
  const points = xsRaw.map((x, i) => ({ x: round1(x), y: round1(ysRaw[i]), type: types[i] as string }))
  return {
    points,
    slope: Math.round(slope * 100) / 100,
    intercept: round1(intercept),
    r: c.r,
    r2: Math.round(c.r * c.r * 100) / 100,
    unit: c.unit,
    line: [
      { x: c.min, y: round1(intercept + slope * c.min) },
      { x: c.max, y: round1(intercept + slope * c.max) },
    ],
  }
}

export function getHealthSeries(filters: Filters, disease: Disease) {
  const daily = getDailySeries({ ...filters, pollutant: "PM2.5" })
  const d = getDisease(disease)
  const regionF = getRegion(filters.region).factor
  const total = d.total * regionF * caseScale(filters.range)
  const sumPm = daily.reduce((a, b) => a + b.value, 0)
  return daily.map((row, i) => {
    const source = daily[Math.max(0, i - d.lag)].value
    return {
      day: row.day,
      pm: row.value,
      cases: Math.round((source / sumPm) * total * (0.9 + ((i * 7) % 5) * 0.05)),
    }
  })
}

export function getHealthKpis(region: Region, disease: Disease, range: DateRange) {
  const d = getDisease(disease)
  return { ...d, total: Math.round(d.total * getRegion(region).factor * caseScale(range)) }
}

export const VULNERABILITY = [
  { pollutant: "PM2.5", key: "PM2.5", balita: 8.2, lansia: 5.4 },
  { pollutant: "PM10", key: "PM10", balita: 5.1, lansia: 3.6 },
  { pollutant: "CO", key: "CO", balita: 0.4, lansia: 0.3 },
  { pollutant: "SO₂", key: "SO2", balita: 3.2, lansia: 2.1 },
  { pollutant: "NO₂", key: "NO2", balita: 4.6, lansia: 3.0 },
  { pollutant: "O₃", key: "O3", balita: 1.2, lansia: 1.8 },
]

export type Hospital = {
  code: string
  name: string
  region: Exclude<Region, "nasional">
  station: string
  capacity: string
  dominantPollutant: string
  total: number
  dominantDisease: Disease
  share: [number, number, number, number, number]
}

export const HOSPITALS: Hospital[] = [
  { code: "RS-KTG-A", name: "Kota Palangka Raya", region: "kalimantan", station: "LOC-KTG-01", capacity: "Tipe B · 220 TT", dominantPollutant: "PM2.5 (1,4× BM)", total: 738, dominantDisease: "ISPA", share: [62, 16, 10, 9, 3] },
  { code: "RS-KTG-B", name: "Kab. Kotawaringin Timur", region: "kalimantan", station: "LOC-KTG-02", capacity: "Tipe C · 120 TT", dominantPollutant: "PM2.5 (1,6× BM)", total: 541, dominantDisease: "ISPA", share: [68, 11, 10, 8, 3] },
  { code: "RS-PKN-A", name: "Kab. Kotawaringin Barat", region: "kalimantan", station: "LOC-PKN-01", capacity: "Tipe C · 98 TT", dominantPollutant: "PM2.5 (1,1× BM)", total: 371, dominantDisease: "ISPA", share: [66, 13, 9, 9, 3] },
  { code: "RS-STG-A", name: "Kab. Sintang", region: "kalimantan", station: "LOC-STG-01", capacity: "Tipe C · 110 TT", dominantPollutant: "PM2.5 (0,9× BM)", total: 329, dominantDisease: "ISPA", share: [64, 15, 8, 11, 2] },
  { code: "RS-SM2-A", name: "Kota Samarinda", region: "kalimantan", station: "LOC-SM2-01", capacity: "Tipe B · 310 TT", dominantPollutant: "NO₂ (0,8× BM)", total: 489, dominantDisease: "Kardiovaskular", share: [26, 42, 12, 16, 4] },
  { code: "RS-BJB-A", name: "Kota Banjarbaru", region: "kalimantan", station: "LOC-BJB-01", capacity: "Tipe B · 190 TT", dominantPollutant: "PM2.5 (0,7× BM)", total: 585, dominantDisease: "ISPA", share: [60, 21, 9, 8, 2] },
  { code: "RS-PKU-A", name: "Kota Pekanbaru", region: "sumatera", station: "LOC-PKU-01", capacity: "Tipe B · 220 TT", dominantPollutant: "PM2.5 (1,3× BM)", total: 812, dominantDisease: "ISPA", share: [64, 15, 9, 9, 3] },
  { code: "RS-PLM-A", name: "Kota Palembang", region: "sumatera", station: "LOC-PLM-01", capacity: "Tipe A · 420 TT", dominantPollutant: "PM2.5 (1,0× BM)", total: 655, dominantDisease: "ISPA", share: [55, 22, 10, 10, 3] },
  { code: "RS-JKT-A", name: "Kota Jakarta Pusat", region: "jawa", station: "LOC-JKT-01", capacity: "Tipe B · 250 TT", dominantPollutant: "PM2.5 (0,9× BM)", total: 904, dominantDisease: "ISPA", share: [48, 28, 11, 10, 3] },
  { code: "RS-SBY-A", name: "Kota Surabaya", region: "jawa", station: "LOC-SBY-01", capacity: "Tipe A · 480 TT", dominantPollutant: "NO₂ (0,9× BM)", total: 712, dominantDisease: "Kardiovaskular", share: [34, 38, 12, 13, 3] },
  { code: "RS-MKS-A", name: "Kota Makassar", region: "sulawesi", station: "LOC-MKS-01", capacity: "Tipe A · 450 TT", dominantPollutant: "PM2.5 (0,7× BM)", total: 690, dominantDisease: "ISPA", share: [52, 25, 10, 10, 3] },
  { code: "RS-PLU-A", name: "Kota Palu", region: "sulawesi", station: "LOC-PLU-01", capacity: "Tipe B · 200 TT", dominantPollutant: "PM2.5 (0,6× BM)", total: 402, dominantDisease: "ISPA", share: [58, 18, 9, 12, 3] },
  { code: "RS-AMQ-A", name: "Kota Ambon", region: "maluku-papua", station: "LOC-AMQ-01", capacity: "Tipe B · 180 TT", dominantPollutant: "PM2.5 (0,5× BM)", total: 310, dominantDisease: "ISPA", share: [60, 17, 9, 11, 3] },
  { code: "RS-DJJ-A", name: "Kota Jayapura", region: "maluku-papua", station: "LOC-DJJ-01", capacity: "Tipe B · 210 TT", dominantPollutant: "PM2.5 (0,5× BM)", total: 355, dominantDisease: "ISPA", share: [59, 18, 9, 11, 3] },
]

export function getHospitals(region: Region, range: DateRange = DEFAULT_RANGE) {
  const list = region === "nasional" ? HOSPITALS : HOSPITALS.filter((h) => h.region === region)
  const k = caseScale(range)
  return list.map((h) => ({ ...h, total: Math.round(h.total * k) }))
}

export function getDiseaseTotals(region: Region, range: DateRange = DEFAULT_RANGE) {
  const f = getRegion(region).factor * caseScale(range)
  return DISEASES.map((d) => ({ disease: d.value, total: Math.round(d.total * f) }))
}

/* Evaluasi jaringan */

export const EVAL_KPIS: Record<
  Region,
  { completeness: number; stations: number; blindSpot: string; blindNote: string; distance: number; ratio: number; ratioPct: number }
> = {
  nasional: { completeness: 93.9, stations: 34, blindSpot: "Kab. Kotawaringin Timur (Sampit)", blindNote: "Beban pasien RS tinggi di area gambut dengan cakupan pemantauan terbatas", distance: 38.4, ratio: 1.58, ratioPct: 58 },
  kalimantan: { completeness: 92.8, stations: 9, blindSpot: "Kab. Kotawaringin Timur (Sampit)", blindNote: "Satu stasiun melayani 541 kasus RS di wilayah gambut luas", distance: 52.1, ratio: 1.84, ratioPct: 84 },
  sumatera: { completeness: 93.5, stations: 8, blindSpot: "Kab. Kampar (Riau)", blindNote: "Titik api berulang tanpa sensor dalam radius 60 km", distance: 41.7, ratio: 1.71, ratioPct: 71 },
  jawa: { completeness: 97.9, stations: 10, blindSpot: "Kab. Bekasi", blindNote: "Kawasan industri padat dengan cakupan stasiun terbatas", distance: 18.2, ratio: 1.27, ratioPct: 27 },
  sulawesi: { completeness: 94.1, stations: 4, blindSpot: "Kab. Morowali (Sulawesi Tengah)", blindNote: "Kawasan industri nikel tanpa stasiun dalam radius 70 km", distance: 46.3, ratio: 1.38, ratioPct: 38 },
  "maluku-papua": { completeness: 90.2, stations: 3, blindSpot: "Kab. Merauke (Papua Selatan)", blindNote: "Kebakaran lahan luas dengan satu sensor untuk ratusan kilometer", distance: 118.5, ratio: 1.22, ratioPct: 22 },
}

export type NetworkPoint = { name: string; lat: number; lng: number; region: Exclude<Region, "nasional"> }

export const NETWORK_STATIONS: NetworkPoint[] = [
  { name: "Banda Aceh", lat: 5.55, lng: 95.32, region: "sumatera" },
  { name: "Medan", lat: 3.59, lng: 98.67, region: "sumatera" },
  { name: "Pekanbaru", lat: 0.47, lng: 101.45, region: "sumatera" },
  { name: "Dumai", lat: 1.67, lng: 101.45, region: "sumatera" },
  { name: "Padang", lat: -0.95, lng: 100.35, region: "sumatera" },
  { name: "Jambi", lat: -1.61, lng: 103.61, region: "sumatera" },
  { name: "Palembang", lat: -2.98, lng: 104.76, region: "sumatera" },
  { name: "Bandar Lampung", lat: -5.43, lng: 105.26, region: "sumatera" },
  { name: "Jakarta Pusat", lat: -6.18, lng: 106.83, region: "jawa" },
  { name: "Jakarta Timur", lat: -6.23, lng: 106.9, region: "jawa" },
  { name: "Tangerang", lat: -6.18, lng: 106.63, region: "jawa" },
  { name: "Bogor", lat: -6.6, lng: 106.8, region: "jawa" },
  { name: "Bandung", lat: -6.91, lng: 107.61, region: "jawa" },
  { name: "Semarang", lat: -6.97, lng: 110.42, region: "jawa" },
  { name: "Yogyakarta", lat: -7.8, lng: 110.37, region: "jawa" },
  { name: "Surabaya", lat: -7.25, lng: 112.75, region: "jawa" },
  { name: "Malang", lat: -7.98, lng: 112.63, region: "jawa" },
  { name: "Cilegon", lat: -6.0, lng: 106.05, region: "jawa" },
  { name: "Pontianak", lat: -0.03, lng: 109.34, region: "kalimantan" },
  { name: "Sintang", lat: 0.07, lng: 111.5, region: "kalimantan" },
  { name: "Pangkalan Bun", lat: -2.68, lng: 111.63, region: "kalimantan" },
  { name: "Sampit", lat: -2.54, lng: 112.95, region: "kalimantan" },
  { name: "Palangka Raya", lat: -2.21, lng: 113.92, region: "kalimantan" },
  { name: "Banjarbaru", lat: -3.44, lng: 114.83, region: "kalimantan" },
  { name: "Balikpapan", lat: -1.24, lng: 116.85, region: "kalimantan" },
  { name: "Samarinda", lat: -0.5, lng: 117.15, region: "kalimantan" },
  { name: "Tarakan", lat: 3.3, lng: 117.63, region: "kalimantan" },
  { name: "Makassar", lat: -5.15, lng: 119.43, region: "sulawesi" },
  { name: "Palu", lat: -0.9, lng: 119.87, region: "sulawesi" },
  { name: "Manado", lat: 1.47, lng: 124.84, region: "sulawesi" },
  { name: "Kendari", lat: -3.97, lng: 122.51, region: "sulawesi" },
  { name: "Ambon", lat: -3.7, lng: 128.18, region: "maluku-papua" },
  { name: "Sorong", lat: -0.88, lng: 131.26, region: "maluku-papua" },
  { name: "Jayapura", lat: -2.53, lng: 140.72, region: "maluku-papua" },
]

export const PROPOSED_STATIONS: NetworkPoint[] = [
  { name: "Usulan · Kotawaringin Timur (hulu)", lat: -1.9, lng: 112.6, region: "kalimantan" },
  { name: "Usulan · Ketapang", lat: -1.85, lng: 110.0, region: "kalimantan" },
  { name: "Usulan · Kampar", lat: 0.3, lng: 100.9, region: "sumatera" },
  { name: "Usulan · Bekasi", lat: -6.3, lng: 107.15, region: "jawa" },
  { name: "Usulan · Morowali", lat: -2.8, lng: 121.9, region: "sulawesi" },
  { name: "Usulan · Merauke", lat: -8.49, lng: 140.4, region: "maluku-papua" },
]

export const EVAL_TABLE: {
  region: Exclude<Region, "nasional">
  area: string
  type: string
  stations: string
  cases: string
  beds: string
  pm: string
  status: "Kritis" | "Waspada"
  action: string
}[] = [
  { region: "kalimantan", area: "Kab. Kotawaringin Timur (Sampit)", type: "Tepi gambut", stations: "1 stasiun", cases: "541", beds: "120 TT (Tipe C)", pm: "62,4 vs 32,0 µg/m³ (1,95×)", status: "Kritis", action: "Tambah stasiun AQMS baru & early warning karhutla" },
  { region: "sumatera", area: "Kota Pekanbaru (Marpoyan Damai)", type: "Perkotaan & gambut", stations: "1 stasiun", cases: "812", beds: "220 TT (Tipe B)", pm: "58,6 vs 35,0 µg/m³ (1,67×)", status: "Kritis", action: "Protokol kabut asap & perluasan ruang rawat ISPA" },
  { region: "kalimantan", area: "Kota Palangka Raya", type: "Perkotaan", stations: "1 stasiun", cases: "738", beds: "220 TT (Tipe B)", pm: "55,8 vs 30,0 µg/m³ (1,86×)", status: "Waspada", action: "Sensor low-cost pendamping di area pinggiran kota" },
  { region: "jawa", area: "Kota Jakarta Pusat (Gambir)", type: "Pusat pemerintahan & urban", stations: "1 stasiun", cases: "904", beds: "250 TT (Tipe B)", pm: "45,4 vs 37,5 µg/m³ (1,21×)", status: "Waspada", action: "Pembatasan emisi lalu lintas jam sibuk pagi" },
  { region: "sulawesi", area: "Kab. Morowali (Sulawesi Tengah)", type: "Industri", stations: "0 stasiun", cases: "264", beds: "90 TT (Tipe C)", pm: "41,8 vs 30,0 µg/m³ (1,39×)", status: "Waspada", action: "Pasang stasiun AQMS di kawasan industri & pantau emisi" },
  { region: "maluku-papua", area: "Kab. Merauke (Papua Selatan)", type: "Lahan terbuka", stations: "0 stasiun", cases: "148", beds: "80 TT (Tipe C)", pm: "33,5 vs 30,0 µg/m³ (1,12×)", status: "Waspada", action: "Sensor low-cost & peringatan dini kebakaran lahan" },
]

export const RECOMMENDATIONS = [
  {
    horizon: "Jangka Pendek",
    span: "0–6 bulan",
    title: "Respons cepat & operasional",
    tone: "success" as const,
    items: [
      "Aktifkan peringatan dini otomatis menjelang jam puncak (06.00–09.00 WIB) untuk melindungi balita dan lansia.",
      "Terapkan protokol tanggap darurat kabut asap dan siagakan ruang rawat pernapasan RS rujukan sebelum puncak kemarau.",
      "Kalibrasi dan rawat rutin sensor dengan persentase data tidak valid tertinggi.",
    ],
  },
  {
    horizon: "Jangka Menengah",
    span: "6–18 bulan",
    title: "Pengendalian sumber & faskes",
    tone: "primary" as const,
    items: [
      "Perketat uji emisi dan rekayasa lalu lintas di koridor padat sekitar stasiun tepi jalan dan perkotaan.",
      "Tambah kapasitas tempat tidur pernapasan dan asma di RS tipe B dan C pada wilayah dengan rasio polusi tertinggi.",
      "Awasi terpadu pembukaan lahan gambut di sekitar wilayah pantau Kalimantan dan Sumatera.",
    ],
  },
  {
    horizon: "Jangka Panjang",
    span: ">18 bulan",
    title: "Ekspansi infrastruktur jaringan",
    tone: "warning" as const,
    items: [
      "Bangun stasiun AQMS baru di titik blind spot dengan beban pasien tinggi di luar radius stasiun eksisting.",
      "Integrasikan telemetri kualitas udara dengan rekam medis harian RS rujukan untuk memantau efek jeda paparan.",
    ],
  },
]

export function formatId(n: number, digits = 1) {
  return n.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
