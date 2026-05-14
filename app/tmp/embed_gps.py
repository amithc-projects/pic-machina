import os
import glob
from PIL import Image
import piexif

locations = {
    "france_paris": (48.8584, 2.2945),
    "italy_rome": (41.8902, 12.4922),
    "japan_mtfuji": (35.3606, 138.7274),
    "usa_nyc": (40.6892, -74.0445),
    "china_beijing": (40.4319, 116.5704),
    "peru_machupicchu": (-13.1631, -72.5450),
    "india_agra": (27.1751, 78.0421),
    "egypt_giza": (29.9792, 31.1342),
    "australia_sydney": (-33.8568, 151.2153),
    "brazil_rio": (-22.9519, -43.2105),
    "greece_santorini": (36.4618, 25.3753),
    "jordan_petra": (30.3285, 35.4444),
    "cambodia_angkor": (13.4125, 103.8670),
    "canada_banff": (51.4254, -116.1773),
    "southafrica_capetown": (-33.9628, 18.4098),
    "tanzania_serengeti": (-2.3333, 34.8333),
    "uk_london": (51.5033, -0.1195),
    "spain_barcelona": (41.4036, 2.1744),
    "russia_moscow": (55.7525, 37.6231),
    "uae_dubai": (25.1972, 55.2744),
}

def to_deg(value):
    d = int(value)
    m = int((value - d) * 60)
    s = round((value - d - m / 60) * 3600 * 100)
    return ((d, 1), (m, 1), (s, 100))

base_dir = "/Users/amithcabraal/.gemini/antigravity/brain/b54f5a01-e4ce-46cc-ba3b-b3e3f9b4c76a"
target_dir = "/Users/amithcabraal/code/personal/pic-machina/app/test_data"
os.makedirs(target_dir, exist_ok=True)

for prefix, (lat, lon) in locations.items():
    matches = glob.glob(f"{base_dir}/{prefix}_*.png")
    if not matches:
        print(f"Skipping {prefix}, not found.")
        continue
    filepath = matches[0]
    
    lat_deg = to_deg(abs(lat))
    lat_ref = "N" if lat >= 0 else "S"
    lon_deg = to_deg(abs(lon))
    lon_ref = "E" if lon >= 0 else "W"
    
    gps_ifd = {
        piexif.GPSIFD.GPSLatitudeRef: lat_ref,
        piexif.GPSIFD.GPSLatitude: lat_deg,
        piexif.GPSIFD.GPSLongitudeRef: lon_ref,
        piexif.GPSIFD.GPSLongitude: lon_deg,
    }
    exif_dict = {"GPS": gps_ifd}
    exif_bytes = piexif.dump(exif_dict)
    
    try:
        img = Image.open(filepath).convert("RGB")
        out_path = f"{target_dir}/{prefix}.jpg"
        img.save(out_path, "jpeg", exif=exif_bytes)
        print(f"Processed {prefix} -> {out_path}")
    except Exception as e:
        print(f"Error on {prefix}: {e}")
