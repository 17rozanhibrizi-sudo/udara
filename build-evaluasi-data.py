#!/usr/bin/env python3
"""
Bangun public/data/evaluasi.json untuk halaman Evaluasi Jaringan & Rekomendasi Kebijakan.

Pemakaian (dari root project):
    python scripts/build-evaluasi-data.py <folder dataset_clean> [public/data/evaluasi.json] [--drop-stuck]

Butuh: pandas, numpy, global-land-mask  (pip install pandas numpy global-land-mask)
       global-land-mask hanya dipakai untuk kandidat titik usulan stasiun baru (agar jatuh di daratan).
       Bila tidak terpasang, kandidat dikosongkan dan peta tidak menampilkan titik usulan.

Sumber (nama pada spesifikasi -> file sebenarnya di dataset_clean):
    sites.csv / hospitals.csv     -> 01_master_station_hospital.csv   (profil stasiun, baseline_pm25, RS, kelas, TT)
    HLT-01_health_outcomes_daily  -> 04_env_health_daily_ready.csv    (kasus harian per RS + pm25 harian)
    qc_flag == 'VALID'            -> baris per jam pada hourly_by_station/<station>.csv (file itu sudah hanya berisi baris valid)
                                     dihitung per tanggal agar kelengkapan bisa mengikuti rentang tanggal.
                                     (00_qc_audit_stations.csv dipakai sebagai pembanding, tidak dimuat ke JSON)

--drop-stuck : PM2.5 pada hari sensor macet diisi null (kasus RS tetap dihitung). Aturannya SAMA dengan
               build-overview-data.py / build-health-data.py / build-pola-data.py.

Catatan: dataset tidak punya koordinat RS (1 stasiun = 1 RS di kota yang sama), jadi tidak ada jarak RS-stasiun.
"""
import json, math, sys
from pathlib import Path
import numpy as np
import pandas as pd

args = [a for a in sys.argv[1:] if not a.startswith("--")]
src = Path(args[0] if len(args) > 0 else "dataset_clean")
out = Path(args[1] if len(args) > 1 else "public/data/evaluasi.json")
DROP_STUCK = "--drop-stuck" in sys.argv

master = pd.read_csv(src / "01_master_station_hospital.csv")
d = pd.read_csv(src / "04_env_health_daily_ready.csv", parse_dates=["date"]).sort_values(["station_code", "date"]).reset_index(drop=True)

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

CONC = ["pm25_ug_m3", "pm10_ug_m3", "so2_ug_m3", "co_ug_m3", "o3_ug_m3", "no2_ug_m3"]


def short_city(s):
    s = s.replace("Kota Administrasi ", "")
    if s.startswith("Kabupaten "):
        return "Kab. " + s[len("Kabupaten "):]
    if s.startswith("Kota "):
        return s[len("Kota "):]
    return s


# ---------- sensor macet (sama dengan build-health-data.py) ----------
stuck = pd.Series(False, index=d.index)
if DROP_STUCK:
    vals = d[CONC].round(2)
    same_prev = ((vals == vals.shift()).all(axis=1) & (d.station_code == d.station_code.shift())
                 & ((d.date - d.date.shift()).dt.days == 1))
    run_id = (~same_prev).cumsum()
    stuck = d.groupby(run_id)["date"].transform("size") >= 3
    nxt = d.station_code == d.station_code.shift(-1)
    prv = d.station_code == d.station_code.shift()
    stuck = stuck | (stuck.shift(1, fill_value=False) & prv) | (stuck.shift(-1, fill_value=False) & nxt)
    print(f"Hari sensor macet (PM2.5 dikosongkan): {int(stuck.sum())}")

base = d["date"].min().normalize()
n_days = int((d["date"].max().normalize() - base).days) + 1
HOURLY = src / "hourly_by_station"


def haversine(a, b):
    R = 6371.0088
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


stations = []
for _, m in master.iterrows():
    mask = d.station_code == m.station_code
    g = d[mask]
    st = stuck[mask].values
    idx = ((g["date"] - base).dt.days).astype(int).tolist()
    deltas = [idx[0]] + [b - a for a, b in zip(idx, idx[1:])] if idx else []
    pm = g["pm25_ug_m3"].round(2).astype(object)
    pm[st] = None
    cases = (g["resp"] + g["cvd"] + g["death"]).astype(int).tolist()  # beban kasus = resp + cvd + death

    # jam valid per hari kalender (0..24) + profil rata-rata PM2.5 per jam (WIB)
    valid = [0] * n_days
    prof = None
    hp = HOURLY / f"{m.station_code}.csv"
    if hp.exists():
        h = pd.read_csv(hp, parse_dates=["date"]).drop_duplicates(["date", "hour"])
        cnt = h.groupby("date").size()
        for dt, c in cnt.items():
            k = int((dt - base).days)
            if 0 <= k < n_days:
                valid[k] = int(c)
        hh = h
        if DROP_STUCK and st.any():
            bad = set(g["date"][st])
            hh = h[~h["date"].isin(bad)]
        pr = hh.groupby("hour")["pm25_ug_m3"].mean().reindex(range(24))
        prof = [None if pd.isna(x) else round(float(x), 1) for x in pr.tolist()]

    stations.append({
        "code": m.station_code,
        "hospitalId": m.hospital_id,
        "name": short_city(m.kota_kabupaten),
        "fullName": m.nama_sensor.replace("AQMS ", "", 1),
        "province": m.provinsi,
        "region": REGION[m.provinsi],
        "type": m.site_type,
        "status": m.status_operasional,
        "lat": float(m.latitude_dd),
        "lng": float(m.longitude_dd),
        "baseline": float(m.baseline_pm25),
        "hospital": {"name": m.nama_rumah_sakit, "cls": m.kelas_faskes, "beds": int(m.kapasitas_tempat_tidur)},
        "hp": prof,
        "d": deltas,
        "p": [None if (x is None or pd.isna(x)) else float(x) for x in pm.tolist()],
        "h": cases,
        "v": valid,
    })

# ---------- kandidat titik usulan stasiun baru ----------
# Grid 0,25 derajat di daratan Indonesia, minimal 50 km dari SEMUA stasiun beroperasi (Active / Intermittent).
cand = []
try:
    from global_land_mask import globe
    live = [(s["lat"], s["lng"]) for s in stations if s["status"] != "Defective"]
    lats = np.arange(-11.0, 6.01, 0.25)
    lngs = np.arange(95.0, 141.01, 0.25)
    LL, GG = np.meshgrid(lats, lngs, indexing="ij")
    land = globe.is_land(LL, GG)
    for la, ln in zip(LL[land], GG[land]):
        if min(haversine((la, ln), p) for p in live) >= 50.0:
            cand.append([round(float(la), 2), round(float(ln), 2)])
    print(f"Kandidat titik usulan (daratan, >= 50 km dari stasiun): {len(cand)}")
except ImportError:
    print("PERINGATAN: global-land-mask belum terpasang -> kandidat titik usulan kosong")

payload = {"version": 1, "base": base.strftime("%Y-%m-%d"), "max": d["date"].max().strftime("%Y-%m-%d"),
           "days": n_days, "stations": stations, "cand": cand}
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
print(f"OK -> {out} ({out.stat().st_size/1e6:.2f} MB, {len(stations)} stasiun, "
      f"{sum(1 for s in stations if s['d'])} punya data, {payload['base']} .. {payload['max']})")
