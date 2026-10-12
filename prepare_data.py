"""Create a compact, public-source dataset for the static explorer.

The source CSV lives one directory above this site. Exact collection addresses,
ticket IDs, truck identifiers, and personal fields are intentionally omitted.
"""
from __future__ import annotations

import json
from pathlib import Path
from zoneinfo import ZoneInfo
import csv
from datetime import datetime, date

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "Pinellas-Debris-Tickets-2024.csv"
OUT = ROOT / "data" / "tickets.json"
OUT.parent.mkdir(exist_ok=True)

rows = []
types = []
type_index = {}
start = date(2024, 10, 2)
with SOURCE.open(encoding="utf-8-sig", newline="") as stream:
    for record in csv.DictReader(stream):
        kind = record["DebrisType"].strip() or "Unknown"
        if kind not in type_index:
            type_index[kind] = len(types)
            types.append(kind)
        day = datetime.fromisoformat(record["LoadDate"].replace("Z", "+00:00")).astimezone(ZoneInfo("America/New_York")).date()
        rows.append([
            (day - start).days,
            type_index[kind],
            int(record["DisasterID"]),
            round(float(record["Volume"]), 2),
            round(float(record["Lat"]), 6),
            round(float(record["Lng"]), 6),
        ])

payload = {"start": start.isoformat(), "types": types, "rows": rows}
OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
print(f"Wrote {len(rows):,} rows and {len(OUT.read_bytes()):,} bytes to {OUT}")
