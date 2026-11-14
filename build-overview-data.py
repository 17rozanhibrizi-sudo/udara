#!/usr/bin/env python3
"""
Bangun public/data/overview.json dari dataset_clean (CSV bersih).

Pemakaian (dari root project):
    python scripts/build-overview-data.py <folder dataset_clean> [public/data/overview.json] [--drop-stuck]

Butuh: pandas (pip install pandas)
Sumber : 01_master_station_hospital.csv, 03_aqms_daily_ispu.csv, 00_qc_audit_stations.csv
Keluaran: 1 file JSON ringkas (kolom-per-stasiun, tanggal di-delta-encode).
"""
import json, sys
from pathlib import Path
import pandas as pd

args = [a for a in sys.argv[1:] if not a.startswith("--")]
src = Path(args[0] if len(args) > 0 else "dataset_clean")
out = Path(args[1] if len(args) > 1 else "public/data/overview.json")
# Default: data dipakai APA ADANYA dari dataset_clean. Tambahkan --drop-stuck untuk membuang
# hari sensor macet (lihat blok "Saring sensor macet" di bawah).
DROP_STUCK = "--drop-stuck" in sys.argv

master = pd.read_csv(src / "01_master_station_hospital.csv")
daily = pd.read_csv(src / "03_aqms_daily_ispu.csv", parse_dates=["date"])
qc = pd.read_csv(src / "00_qc_audit_stations.csv").set_index("sensor_id")["valid_pct"]

# provinsi -> kelompok wilayah di slicer (value harus sama dengan type Region di lib/data.ts)
REGION = {
    "DKI Jakarta": "jawa", "Jawa Barat": "jawa", "D.I. Yogyakarta": "jawa", "Jawa Timur": "jawa",
    "Aceh": "sumatera", "Sumatera Utara": "sumatera", "Sumatera Barat": "sumatera", "Riau": "sumatera",
    "Kepulauan Riau": "sumatera", "Jambi": "sumatera", "Bengkulu": "sumatera",
    "Sumatera Selatan": "sumatera", "Lampung": "sumatera",
    "Kalimantan Barat": "kalimantan", "Kalimantan Tengah": "kalimantan",
    "Kalimantan Selatan": "kalimantan", "Kalimantan Timur": "kalimantan",
    "Sulawesi Selatan": "sulawesi", "Sulawesi Tengah": "sulawesi",
    "Papua Barat Daya": "maluku-papua", "Papua Selatan": "maluku-papua",
}
missing = set(master.provinsi) - set(REGION)
if missing:
    sys.exit(f"Provinsi belum dipetakan ke wilayah: {missing}")

# kunci polutan di JSON == type Pollutant di lib/data.ts
CONC = {"PM2.5": "pm25_ug_m3", "PM10": "pm10_ug_m3", "CO": "co_ug_m3",
        "SO2": "so2_ug_m3", "NO2": "no2_ug_m3", "O3": "o3_ug_m3"}
ISPU = {"PM2.5": "ispu_pm25", "PM10": "ispu_pm10", "CO": "ispu_co",
        "SO2": "ispu_so2", "NO2": "ispu_no2", "O3": "ispu_o3", "ALL": "ispu_score"}

def short_city(s: str) -> str:
    s = s.replace("Kota Administrasi ", "")
    if s.startswith("Kabupaten "):
        return "Kab. " + s[len("Kabupaten "):]
    if s.startswith("Kota "):
        return s[len("Kota "):]
    return s

# --- Saring sensor macet (OPSIONAL, hanya jalan dengan --drop-stuck) ----------------
# Hari dibuang bila keenam konsentrasi IDENTIK dengan hari sebelumnya selama >= STUCK_MIN_DAYS
# hari kalender berturut-turut (ciri sensor macet / data diisi ulang, bukan kondisi udara).
if DROP_STUCK:
    STUCK_MIN_DAYS = 3
    daily = daily.sort_values(["station_code", "date"]).reset_index(drop=True)
    vals = daily[list(CONC.values())].round(2)
    same_prev = (
        (vals == vals.shift()).all(axis=1)
        & (daily["station_code"] == daily["station_code"].shift())
        & ((daily["date"] - daily["date"].shift()).dt.days == 1)
    )
    run_id = (~same_prev).cumsum()                      # satu id per rangkaian hari identik
    run_len = daily.groupby(run_id)["date"].transform("size")
    stuck = run_len >= STUCK_MIN_DAYS
    # Margin 1 hari di kedua sisi: hari saat sensor mulai/selesai macet berisi campuran jam macet & normal.
    same_station_next = daily["station_code"] == daily["station_code"].shift(-1)
    same_station_prev = daily["station_code"] == daily["station_code"].shift()
    stuck = stuck | (stuck.shift(1, fill_value=False) & same_station_prev) | (stuck.shift(-1, fill_value=False) & same_station_next)
    dropped = daily[stuck].groupby("station_code").size()
    print(f"Dibuang (sensor macet >= {STUCK_MIN_DAYS} hari identik, +1 hari margin): {int(stuck.sum())} baris")
    for code, n in dropped.items():
        rows = daily[stuck & (daily.station_code == code)]
        print(f"  {code}: {n} hari ({rows.date.min().date()} .. {rows.date.max().date()})")
    daily = daily[~stuck].reset_index(drop=True)


base = daily["date"].min().normalize()
stations = []
for _, m in master.iterrows():
    g = daily[daily.station_code == m.station_code].sort_values("date")
    idx = ((g["date"] - base).dt.days).astype(int).tolist()
    deltas = [idx[0]] + [b - a for a, b in zip(idx, idx[1:])] if idx else []
    stations.append({
        "code": m.station_code,
        "sensorId": m.sensor_id,
        "hospitalId": m.hospital_id,
        "name": short_city(m.kota_kabupaten),
        "fullName": m.nama_sensor.replace("AQMS ", "", 1),
        "province": m.provinsi,
        "city": m.kota_kabupaten,
        "region": REGION[m.provinsi],
        "type": m.site_type,
        "lat": float(m.latitude_dd),
        "lng": float(m.longitude_dd),
        "status": m.status_operasional,
        "completeness": float(qc.get(m.sensor_id, 0)),
        "d": deltas,
        "c": {k: g[v].round(2).tolist() for k, v in CONC.items()},
        "i": {k: g[v].round(2).tolist() for k, v in ISPU.items()},
    })

payload = {"version": 1, "base": base.strftime("%Y-%m-%d"),
           "max": daily["date"].max().strftime("%Y-%m-%d"), "stations": stations}
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
print(f"OK -> {out}  ({out.stat().st_size/1e6:.2f} MB, {len(stations)} stasiun, "
      f"{sum(1 for s in stations if s['d'])} punya data, {base.date()} .. {payload['max']})")
