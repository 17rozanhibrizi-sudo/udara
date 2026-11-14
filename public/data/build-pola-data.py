#!/usr/bin/env python3
"""
Bangun public/data/pola-daily.json dan public/data/pola-hourly/<polutan>-<wilayah>.json
dari dataset_clean (CSV bersih).

Pemakaian (dari root project):
    python scripts/build-pola-data.py <folder dataset_clean> [public/data] [--drop-stuck]

--drop-stuck : buang hari sensor macet (6 konsentrasi identik >= 3 hari kalender berturut-turut, +1 hari margin).
               Aturannya SAMA PERSIS dengan build-overview-data.py dan build-health-data.py. Pakai opsi ini
               di ketiga script supaya angka antar halaman konsisten. Tanpa opsi ini, data dipakai apa adanya.

Butuh: pandas, numpy
Sumber : 01_master_station_hospital.csv, 03_aqms_daily_ispu.csv, 00_qc_audit_stations.csv,
         hourly_by_station/<station_code>.csv
Aturan : data per jam hanya untuk hari yang ADA di data harian (setelah --drop-stuck bila dipakai),
         supaya konsisten dengan data harian.
"""
import json, sys
from pathlib import Path
import numpy as np
import pandas as pd

args = [a for a in sys.argv[1:] if not a.startswith("--")]
src = Path(args[0] if len(args) > 0 else "dataset_clean")
out = Path(args[1] if len(args) > 1 else "public/data")
DROP_STUCK = "--drop-stuck" in sys.argv

master = pd.read_csv(src / "01_master_station_hospital.csv")
daily = pd.read_csv(src / "03_aqms_daily_ispu.csv", parse_dates=["date"]).sort_values(["station_code", "date"])
qc = pd.read_csv(src / "00_qc_audit_stations.csv").set_index("sensor_id")["valid_pct"]

# --- Saring sensor macet (OPSIONAL; sama dengan build-overview-data.py) -------------
if DROP_STUCK:
    STUCK_MIN_DAYS = 3
    daily = daily.sort_values(["station_code", "date"]).reset_index(drop=True)
    vals = daily[["pm25_ug_m3", "pm10_ug_m3", "so2_ug_m3", "co_ug_m3", "o3_ug_m3", "no2_ug_m3"]].round(2)
    same_prev = (
        (vals == vals.shift()).all(axis=1)
        & (daily["station_code"] == daily["station_code"].shift())
        & ((daily["date"] - daily["date"].shift()).dt.days == 1)
    )
    run_id = (~same_prev).cumsum()
    stuck = daily.groupby(run_id)["date"].transform("size") >= STUCK_MIN_DAYS
    nxt = daily["station_code"] == daily["station_code"].shift(-1)
    prv = daily["station_code"] == daily["station_code"].shift()
    stuck = stuck | (stuck.shift(1, fill_value=False) & prv) | (stuck.shift(-1, fill_value=False) & nxt)
    print(f"Dibuang (sensor macet >= {STUCK_MIN_DAYS} hari identik, +1 hari margin): {int(stuck.sum())} baris")
    for code, n in daily[stuck].groupby("station_code").size().items():
        r = daily[stuck & (daily.station_code == code)]
        print(f"  {code}: {n} hari ({r.date.min().date()} .. {r.date.max().date()})")
    daily = daily[~stuck].reset_index(drop=True)

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
# Pengelompokan tipe lokasi (keputusan pengelompokan, bukan data baru) -> legenda scatter
GROUP = {
    "AQMS-JKT-01": "Perkotaan", "AQMS-JKT-02": "Industri", "AQMS-JKT-03": "Tepi jalan",
    "AQMS-KTG-01": "Perkotaan", "AQMS-KTG-02": "Tepi gambut", "AQMS-BGR-01": "Latar bersih",
    "AQMS-BGR-02": "Tepi jalan", "AQMS-YKY-01": "Perkotaan", "AQMS-IDP-01": "Latar bersih",
    "AQMS-KTB-01": "Latar bersih", "AQMS-PKU-01": "Tepi gambut", "AQMS-JMB-01": "Tepi gambut",
    "AQMS-BTM-01": "Industri", "AQMS-BGL-01": "Perkotaan", "AQMS-SRG-01": "Latar bersih",
    "AQMS-MLG-01": "Perkotaan", "AQMS-MRS-01": "Industri", "AQMS-PLU-01": "Latar bersih",
    "AQMS-STG-01": "Tepi gambut", "AQMS-PKN-01": "Tepi gambut", "AQMS-PLB-01": "Tepi gambut",
    "AQMS-PSW-01": "Tepi jalan", "AQMS-MER-01": "Latar bersih", "AQMS-MDN-01": "Perkotaan",
    "AQMS-SM2-01": "Industri", "AQMS-BJB-01": "Tepi gambut", "AQMS-JMB-02": "Tepi gambut",
}
missing = set(master.provinsi) - set(REGION)
if missing: sys.exit(f"Provinsi belum dipetakan: {missing}")
miss_g = set(master.station_code) - set(GROUP)
if miss_g: sys.exit(f"Stasiun belum punya group: {miss_g}")

CONC = {"PM2.5": "pm25_ug_m3", "PM10": "pm10_ug_m3", "CO": "co_ug_m3",
        "SO2": "so2_ug_m3", "NO2": "no2_ug_m3", "O3": "o3_ug_m3"}
SLUG = {"PM2.5": "pm25", "PM10": "pm10", "CO": "co", "SO2": "so2", "NO2": "no2", "O3": "o3"}

def short_city(s):
    s = s.replace("Kota Administrasi ", "")
    if s.startswith("Kabupaten "): return "Kab. " + s[len("Kabupaten "):]
    if s.startswith("Kota "): return s[len("Kota "):]
    return s

def deltas(idx): return [idx[0]] + [b - a for a, b in zip(idx, idx[1:])] if idx else []
def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

base = daily["date"].min().normalize()
base_s = base.strftime("%Y-%m-%d")

# ---------- harian ----------
stations, day_idx = [], {}
for _, m in master.iterrows():
    g = daily[daily.station_code == m.station_code]
    idx = ((g["date"] - base).dt.days).astype(int).tolist()
    day_idx[m.station_code] = (g["date"].tolist(), idx)
    stations.append({
        "code": m.station_code, "name": short_city(m.kota_kabupaten), "fullName": m.nama_sensor.replace("AQMS ", "", 1),
        "region": REGION[m.provinsi], "type": m.site_type, "group": GROUP[m.station_code], "status": m.status_operasional,
        "traffic": float(m.traffic_intensity_per_h), "distance": float(m.distance_to_road_m),
        "completeness": float(qc.get(m.sensor_id, 0)),
        "d": deltas(idx),
        "c": {k: g[v].round(2).tolist() for k, v in CONC.items()},
        "t": g["temperature_c"].round(2).tolist(), "h": g["humidity_pct"].round(2).tolist(), "w": g["wind_speed_ms"].round(2).tolist(),
    })
dump(out / "pola-daily.json", {"version": 1, "base": base_s, "max": daily["date"].max().strftime("%Y-%m-%d"), "stations": stations})
n = sum(len(s["d"]) for s in stations)
print(f"pola-daily.json: {n} baris (setelah penyaringan, bila --drop-stuck)")

# ---------- per jam: <polutan>-<wilayah>.json ----------
by_region = {}
for s in stations:
    if s["d"]: by_region.setdefault(s["region"], []).append(s["code"])
buf = {}
for code in [c for r in by_region.values() for c in r]:
    h = pd.read_csv(src / "hourly_by_station" / f"{code}.csv", parse_dates=["date"])
    dates, idx = day_idx[code]
    for pol, col in CONC.items():
        piv = h.pivot(index="date", columns="hour", values=col).reindex(index=dates, columns=range(24))
        dec = 0 if pol == "CO" else 1
        vals = [None if (isinstance(x, float) and np.isnan(x)) else round(float(x), dec) for x in piv.values.ravel()]
        if dec == 0: vals = [None if x is None else int(x) if x == int(x) else x for x in vals]
        buf[(pol, code)] = {"code": code, "d": deltas(idx), "v": vals}
for region, codes in by_region.items():
    for pol in CONC:
        dump(out / "pola-hourly" / f"{SLUG[pol]}-{region}.json",
             {"base": base_s, "stations": [buf[(pol, c)] for c in codes]})
print("pola-hourly: 30 file ditulis ->", out / "pola-hourly")
