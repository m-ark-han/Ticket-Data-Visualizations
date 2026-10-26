"""Build the nine-figure public selection and Mark's contractor, truck, and quality figures.

Public outputs contain aggregate contractor/truck metrics and coordinate-only quality
marks. Address labels and truck identifiers remain in the source CSV, not the site.
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

SITE = Path(__file__).resolve().parent
SOURCE = SITE.parent / "Pinellas-Debris-Tickets-2024.csv"
FIGURES = SITE / "figures"
OUTPUT = SITE.parent / "outputs" / "mark-priority"
OUTPUT.mkdir(parents=True, exist_ok=True)
FIGURES.mkdir(exist_ok=True)
df = pd.read_csv(SOURCE, low_memory=False)
assert len(df) == 18278
df["address"] = df.CollAddress.fillna("").astype(str).str.upper().str.replace(r"\s+", " ", regex=True).str.strip()
df["day"] = pd.to_datetime(df.LoadDate, utc=True).dt.tz_convert("America/New_York").dt.tz_localize(None).dt.floor("D")
df["week"] = df.day - pd.to_timedelta(df.day.dt.weekday, unit="D")
for column in ("Volume", "Lat", "Lng", "TruckCapacity"):
    df[column] = pd.to_numeric(df[column], errors="coerce")
assert df[["Volume", "Lat", "Lng", "TruckCapacity"]].notna().all().all()

TEAL, ORANGE, NAVY, GREY = "#008b8b", "#d47b28", "#17324b", "#aab7be"
EXTENT = (-82.88, -82.59, 27.59, 28.20)
SOURCE_NOTE = "Source: Pinellas County eGIS tickets · Oct 2, 2024–Apr 10, 2025 · extracted Oct 12, 2026"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.spines.top": False,
                     "axes.spines.right": False, "figure.facecolor": "white", "axes.facecolor": "white"})

def save(fig, filename, note, tight=True):
    fig.text(.015, .012, SOURCE_NOTE + " · " + note, fontsize=7, color="#586a74")
    if tight:
        fig.tight_layout(rect=(0, .04, 1, .98))
    fig.savefig(FIGURES / filename, dpi=150)
    plt.close(fig)

def point_trace(x, y, name, text, color, size=11, **extra):
    return {"type": "scatter", "mode": "markers", "name": name, "x": list(x), "y": list(y),
            "marker": {"color": color, "size": size, "opacity": .78, **extra},
            "customdata": list(text), "hovertemplate": "%{customdata}<extra></extra>"}

def map_layout(title, **extra):
    return {"xaxis": {"title": "Longitude (degrees)", "range": EXTENT[:2]},
            "yaxis": {"title": "Latitude (degrees)", "range": EXTENT[2:]},
            "margin": {"l": 80, "r": 60, "t": 45, "b": 70}, "showlegend": True,
            "hovermode": "closest", **extra}

values_path = SITE / "data" / "figure-values.json"
details_path = SITE / "data" / "figure-details.json"
values = json.loads(values_path.read_text(encoding="utf-8"))
details = json.loads(details_path.read_text(encoding="utf-8"))

# F24 — recorded contractor footprint, comparable fixed-size hexagons.
contractors = ["DRC", "PINELLAS COUNTY"]
hexes = []
for contractor in contractors:
    part = df[df.Contractor.eq(contractor)]
    temp, ax = plt.subplots()
    h = ax.hexbin(part.Lng, part.Lat, C=part.Volume, reduce_C_function=np.sum,
                  gridsize=35, extent=EXTENT, mincnt=1)
    hexes.append((contractor, h.get_offsets().copy(), h.get_array().copy()))
    plt.close(temp)
max_cy = max(float(a.max()) for _, _, a in hexes)
fig, axes = plt.subplots(1, 2, figsize=(12.5, 6), sharex=True, sharey=True)
for ax, (contractor, centers, totals) in zip(axes, hexes):
    im = ax.scatter(centers[:, 0], centers[:, 1], c=totals, cmap="YlGnBu", vmin=0,
                    vmax=max_cy, marker="h", s=65, linewidths=0)
    ax.set_title(contractor)
    ax.set_xlim(*EXTENT[:2]); ax.set_ylim(*EXTENT[2:])
    ax.set_xlabel("Longitude (degrees)")
axes[0].set_ylabel("Latitude (degrees)")
fig.suptitle("F24 · Pickup-ticket CY footprint by Contractor label", x=.08, ha="left", fontsize=14, weight="bold")
fig.subplots_adjust(left=.07, right=.86, bottom=.15, top=.85, wspace=.07)
cbar_ax = fig.add_axes([.885, .17, .015, .62])
fig.colorbar(im, cax=cbar_ax, label="Recorded CY per hexagonal cell")
save(fig, "F24-contractor-footprint-map.png", "Same grid and color scale on both panels; not subcontractor coverage.", tight=False)
traces = []
for i, (contractor, centers, totals) in enumerate(hexes):
    axis = "" if i == 0 else "2"
    texts = [f"Contractor: {contractor}<br>Cell center longitude: {lon:.6f}<br>Cell center latitude: {lat:.6f}<br>Recorded CY: {cy:,.2f}"
             for (lon, lat), cy in zip(centers, totals)]
    tr = point_trace(np.round(centers[:, 0], 6), np.round(centers[:, 1], 6), contractor,
                     texts, np.round(totals, 2).tolist(), size=13, symbol="hexagon",
                     colorscale="YlGnBu", reversescale=True, cmin=0, cmax=max_cy, showscale=i == 1,
                     colorbar={"title": "CY"})
    tr["xaxis"], tr["yaxis"] = "x" + axis, "y" + axis
    traces.append(tr)
values["F24"] = {"data": traces, "layout": {
    "xaxis": {"title": "Longitude", "domain": [0, .47], "range": EXTENT[:2]},
    "xaxis2": {"title": "Longitude", "domain": [.53, 1], "range": EXTENT[:2]},
    "yaxis": {"title": "Latitude", "range": EXTENT[2:]},
    "yaxis2": {"title": "Latitude", "range": EXTENT[2:], "anchor": "x2"},
    "annotations": [{"xref": "paper", "yref": "paper", "x": x, "y": 1.06,
                     "text": contractor, "showarrow": False} for x, contractor in [(.235, contractors[0]), (.765, contractors[1])]],
    "margin": {"l": 70, "r": 65, "t": 65, "b": 65}, "showlegend": False, "hovermode": "closest"}}
details["F24"] = {"question": "M01: Where is recorded pickup volume associated with each Contractor label?",
                  "variables": "Contractor, pickup Lat/Lng, Volume. Sum CY in identical hexagonal map cells for each label.",
                  "interpretation": "DRC and PINELLAS COUNTY are the only Contractor labels. The maps show the footprint of ticket locations by label, not verified crew coverage or subcontractor participation."}

# F25 — missing address coordinates and internal GPS-vs-Lat/Lng conflicts.
blank = df[df.address.eq("")]
parts = df.GPS.astype(str).str.split(",", n=1, expand=True)
gps_lat = pd.to_numeric(parts[0], errors="coerce")
gps_lng = pd.to_numeric(parts[1], errors="coerce")
coordinate_conflict = gps_lat.isna() | gps_lng.isna() | (gps_lat - df.Lat).abs().gt(.00001) | (gps_lng - df.Lng).abs().gt(.00001)
conflicts = df[coordinate_conflict]
fig, ax = plt.subplots(figsize=(9.5, 7.5))
ax.scatter(blank.Lng, blank.Lat, s=28, c=ORANGE, alpha=.65, label=f"Blank address ({len(blank)})")
ax.scatter(conflicts.Lng, conflicts.Lat, s=80, c=NAVY, marker="x", linewidths=2,
           label=f"GPS text differs from Lat/Lng ({len(conflicts)})")
ax.set_xlim(*EXTENT[:2]); ax.set_ylim(*EXTENT[2:])
ax.set_xlabel("Longitude (degrees)"); ax.set_ylabel("Latitude (degrees)")
ax.set_title("F25 · Location-field quality flags", loc="left", fontsize=14, weight="bold")
ax.legend(frameon=False)
save(fig, "F25-location-quality-map.png", "Points are review flags; no address-to-map validation.")
blank_text = [f"Flag: blank collection address<br>Longitude: {r.Lng:.6f}<br>Latitude: {r.Lat:.6f}<br>Recorded CY: {r.Volume:,.2f}"
              for r in blank.itertuples()]
conflict_text = [f"Flag: GPS text differs from numeric coordinates<br>Longitude: {r.Lng:.6f}<br>Latitude: {r.Lat:.6f}<br>Recorded CY: {r.Volume:,.2f}"
                 for r in conflicts.itertuples()]
values["F25"] = {"data": [
    point_trace(blank.Lng.round(6), blank.Lat.round(6), "Blank address", blank_text, ORANGE, size=9),
    point_trace(conflicts.Lng.round(6), conflicts.Lat.round(6), "GPS field conflict", conflict_text,
                NAVY, size=14, symbol="x")],
    "layout": map_layout("Location-field quality flags")}
details["F25"] = {"question": "Q032/Q035: Where are blank collection addresses and internally conflicting coordinate fields?",
                  "variables": "CollAddress (blank after whitespace trim), GPS text, numeric Lat/Lng, and Volume. A GPS conflict means either coordinate differs by more than 0.00001 degree.",
                  "interpretation": f"{len(blank)} tickets have blank collection addresses ({blank.Volume.sum():,.2f} CY), and {len(conflicts)} ticket has GPS text differing from its numeric Lat/Lng. These flags do not verify whether any address is mapped to the wrong place (Q045)."}

# F26 — spatially dispersed repeat labels. Label is deliberately absent publicly.
R_KM = 6371.0088
spread_rows = []
for address, part in df[df.address.ne("")].groupby("address"):
    if len(part) < 10:
        continue
    midlat, midlng = float(part.Lat.median()), float(part.Lng.median())
    a = np.sin(np.radians(part.Lat.to_numpy() - midlat) / 2) ** 2
    a += np.cos(np.radians(midlat)) * np.cos(np.radians(part.Lat.to_numpy())) * np.sin(np.radians(part.Lng.to_numpy() - midlng) / 2) ** 2
    distance = 2 * R_KM * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
    spread_rows.append({"address": address, "lat": midlat, "lng": midlng,
                        "tickets": len(part), "p90_km": round(float(np.percentile(distance, 90)), 3),
                        "max_km": round(float(distance.max()), 3)})
spread = pd.DataFrame(spread_rows).sort_values("p90_km", ascending=False).reset_index(drop=True)
spread["review_id"] = [f"R{i:03d}" for i in range(1, len(spread) + 1)]
spread.to_csv(OUTPUT / "repeat-address-coordinate-spread-local.csv", index=False)
candidate_count = int(spread.p90_km.gt(1).sum())
fig, ax = plt.subplots(figsize=(9.5, 7.5))
sc = ax.scatter(spread.lng, spread.lat, c=spread.p90_km.clip(upper=10), cmap="YlOrRd",
                vmin=0, vmax=10, s=np.clip(spread.tickets * 1.5, 35, 360), alpha=.8,
                edgecolors="white", linewidths=.35)
ax.set_xlim(*EXTENT[:2]); ax.set_ylim(*EXTENT[2:])
ax.set_xlabel("Longitude (degrees)"); ax.set_ylabel("Latitude (degrees)")
ax.set_title("F26 · Coordinate spread under repeated address labels", loc="left", fontsize=14, weight="bold")
fig.colorbar(sc, ax=ax, label="P90 distance (km; color capped at 10)")
save(fig, "F26-address-spread-candidates-map.png", "Labels with 10+ tickets; large spread is a review cue, not a confirmed address error.")
texts = [f"Review group: {r.review_id}<br>Median longitude: {r.lng:.6f}<br>Median latitude: {r.lat:.6f}<br>Tickets: {r.tickets:,}<br>90th percentile distance: {r.p90_km:.3f} km<br>Maximum distance: {r.max_km:.3f} km"
         for r in spread.itertuples()]
values["F26"] = {"data": [point_trace(spread.lng.round(6), spread.lat.round(6), "Repeated address label",
                                      texts, spread.p90_km.clip(upper=10).tolist(),
                                      size=np.clip(np.sqrt(spread.tickets) * 2.5, 9, 34).tolist(),
                                      colorscale="YlOrRd", reversescale=True, cmin=0, cmax=10, showscale=True,
                                      colorbar={"title": "P90 km"})],
                 "layout": map_layout("Repeated address coordinate spread", showlegend=False)}
details["F26"] = {"question": "Q030: Which repeated address labels have unusually spread-out pickup coordinates? Q045 remains unresolved.",
                  "variables": "Whitespace-normalized CollAddress, Lat/Lng, TicketId. For labels with 10+ tickets, distance from each coordinate to that label's median coordinate; color shows 90th percentile in km.",
                  "interpretation": f"{len(spread)} labels have 10+ tickets; {candidate_count} have a 90th-percentile coordinate spread above 1 km. Broad road and park labels can legitimately span large areas. Authoritative address geometry is needed before calling these GPS/address mismatches."}

# F27 — participation and volume associated with the two Contractor labels.
contractor_summary = df.groupby("Contractor").agg(tickets=("TicketId", "size"),
                                                   cy=("Volume", "sum"), trucks=("TruckNumber", "nunique"))
contractor_summary = contractor_summary.sort_values("cy", ascending=False)
contractor_summary.to_csv(OUTPUT / "contractor-ticket-summary.csv", float_format="%.2f")
fig, ax = plt.subplots(figsize=(10, 4.8))
colors = [TEAL, ORANGE]
bars = ax.barh(contractor_summary.index, contractor_summary.cy, color=colors)
ax.invert_yaxis(); ax.set_xlabel("Recorded ticket volume (CY)")
ax.set_ylabel("Contractor label")
ax.set_title("F27 · Recorded pickup volume by Contractor label", loc="left", fontsize=14, weight="bold")
for bar, row in zip(bars, contractor_summary.itertuples()):
    ax.text(bar.get_width() + contractor_summary.cy.max() * .015,
            bar.get_y() + bar.get_height() / 2,
            f"{row.cy:,.0f} CY · {row.tickets:,} tickets · {row.trucks} truck IDs", va="center", fontsize=9)
ax.set_xlim(0, contractor_summary.cy.max() * 1.43)
save(fig, "F27-contractor-volume.png", "Contractor is a ticket label; no subcontractor field exists.")
names = contractor_summary.index.tolist()
texts = [f"Contractor: {name}<br>Recorded CY: {contractor_summary.loc[name, 'cy']:,.2f}<br>Tickets: {contractor_summary.loc[name, 'tickets']:,}<br>Distinct truck IDs: {contractor_summary.loc[name, 'trucks']:,}"
         for name in names]
values["F27"] = {"data": [{"type": "bar", "orientation": "h", "x": contractor_summary.cy.round(2).tolist(),
                          "y": names, "marker": {"color": colors}, "customdata": texts,
                          "hovertemplate": "%{customdata}<extra></extra>"}],
                 "layout": {"xaxis": {"title": "Recorded volume (CY)"},
                            "yaxis": {"title": "Contractor label", "autorange": "reversed"},
                            "margin": {"l": 160, "r": 40, "t": 35, "b": 65}, "showlegend": False}}
details["F27"] = {"question": "M01: How many tickets, truck IDs, and recorded CY are associated with each Contractor label?",
                  "variables": "Contractor, TicketId, TruckNumber, and Volume. Sum CY, count ticket rows, and count distinct truck IDs per Contractor label.",
                  "interpretation": f"DRC has {contractor_summary.loc['DRC', 'tickets']:,} tickets and {contractor_summary.loc['DRC', 'cy']:,.2f} CY; PINELLAS COUNTY has {contractor_summary.loc['PINELLAS COUNTY', 'tickets']:,} tickets and {contractor_summary.loc['PINELLAS COUNTY', 'cy']:,.2f} CY. The source has no separate subcontractor field, so subcontractor participation cannot be identified."}

# F28 — observed weekly activity of distinct truck identifiers, by contractor.
weeks = pd.date_range(df.week.min(), df.week.max(), freq="W-MON")
active = df.groupby(["week", "Contractor"]).TruckNumber.nunique().unstack(fill_value=0).reindex(weeks, fill_value=0)
active = active.reindex(columns=contractors, fill_value=0)
active.index.name = "week_beginning"
active.to_csv(OUTPUT / "weekly-distinct-truck-ids.csv")
fig, ax = plt.subplots(figsize=(11.5, 5))
bottom = np.zeros(len(active))
for contractor, color in zip(contractors, [TEAL, ORANGE]):
    ax.bar(active.index.strftime("%b %d"), active[contractor], bottom=bottom,
           color=color, label=contractor)
    bottom += active[contractor].to_numpy()
ax.set_ylabel("Distinct truck IDs with tickets in week")
ax.set_xlabel("Week beginning Monday, 2024–2025")
ax.set_title("F28 · Weekly truck IDs observed on tickets", loc="left", fontsize=14, weight="bold")
ax.tick_params(axis="x", rotation=55, labelsize=7)
ax.legend(frameon=False)
save(fig, "F28-weekly-active-trucks.png", "Observed ticket activity, not full deployed fleet or shift count.")
week_labels = active.index.strftime("%Y-%m-%d").tolist()
traces = []
for contractor, color in zip(contractors, [TEAL, ORANGE]):
    texts = [f"Week beginning: {week}<br>Contractor: {contractor}<br>Distinct truck IDs with tickets: {int(n):,}"
             for week, n in zip(week_labels, active[contractor])]
    traces.append({"type": "bar", "name": contractor, "x": week_labels,
                   "y": active[contractor].astype(int).tolist(), "marker": {"color": color},
                   "customdata": texts, "hovertemplate": "%{customdata}<extra></extra>"})
values["F28"] = {"data": traces, "layout": {"xaxis": {"title": "Week beginning Monday", "tickangle": -35},
                                            "yaxis": {"title": "Distinct truck IDs with tickets"},
                                            "barmode": "stack", "hovermode": "closest", "showlegend": True,
                                            "margin": {"l": 85, "r": 35, "t": 45, "b": 95}}}
peak_week = active.sum(axis=1).idxmax()
details["F28"] = {"question": "M02: How many distinct truck IDs appear on tickets in each week, by Contractor label?",
                  "variables": "Local LoadDate (Monday-start week), Contractor, and distinct TruckNumber. A truck appearing on multiple tickets in one week counts once for that contractor.",
                  "interpretation": f"The highest observed week begins {peak_week:%B %d, %Y}, with {int(active.loc[peak_week].sum())} distinct truck IDs. This is an activity count within the ticket extract, not verified total deployment, available fleet, hours, or shifts."}

# F29 — one capacity per distinct truck identifier, not a ticket-weighted distribution.
truck = df.groupby(["Contractor", "TruckNumber"]).TruckCapacity.first().reset_index()
assert len(truck) == df.TruckNumber.nunique() == 283
assert df.groupby(["Contractor", "TruckNumber"]).TruckCapacity.nunique().eq(1).all()
edges = np.arange(0, 101, 10)
labels = [f"{lo}–<{hi}" for lo, hi in zip(edges[:-1], edges[1:])]
counts = pd.DataFrame({c: np.histogram(truck.loc[truck.Contractor.eq(c), "TruckCapacity"], edges)[0]
                       for c in contractors}, index=labels)
counts.index.name = "capacity_bin_cy"
counts.to_csv(OUTPUT / "unique-truck-capacity-distribution.csv")
fig, ax = plt.subplots(figsize=(10.5, 5))
bottom = np.zeros(len(counts))
for contractor, color in zip(contractors, [TEAL, ORANGE]):
    ax.bar(counts.index, counts[contractor], bottom=bottom, label=contractor, color=color)
    bottom += counts[contractor].to_numpy()
ax.set_xlabel("Listed TruckCapacity (CY per truck ID)")
ax.set_ylabel("Distinct truck IDs")
ax.set_title("F29 · Listed capacity distribution of unique trucks", loc="left", fontsize=14, weight="bold")
ax.legend(frameon=False)
save(fig, "F29-truck-capacity-distribution.png", "Each truck ID counted once; ticket-level capacity is not a payload measurement.")
traces = []
for contractor, color in zip(contractors, [TEAL, ORANGE]):
    texts = [f"Listed capacity: {label} CY<br>Contractor: {contractor}<br>Distinct truck IDs: {int(n):,}"
             for label, n in zip(labels, counts[contractor])]
    traces.append({"type": "bar", "name": contractor, "x": labels,
                   "y": counts[contractor].astype(int).tolist(), "marker": {"color": color},
                   "customdata": texts, "hovertemplate": "%{customdata}<extra></extra>"})
values["F29"] = {"data": traces, "layout": {"xaxis": {"title": "Listed TruckCapacity (CY per truck ID)"},
                                            "yaxis": {"title": "Distinct truck IDs (count)"},
                                            "barmode": "stack", "showlegend": True,
                                            "margin": {"l": 80, "r": 35, "t": 45, "b": 80}}}
details["F29"] = {"question": "M03: What is the distribution of listed capacity among truck IDs with pickup tickets?",
                  "variables": "Distinct (Contractor, TruckNumber) pairs and their consistent TruckCapacity values, binned into 10-CY ranges.",
                  "interpretation": f"There are {len(truck)} distinct truck IDs: {int(truck.Contractor.eq('DRC').sum())} DRC and {int(truck.Contractor.eq('PINELLAS COUNTY').sum())} PINELLAS COUNTY. Listed capacity is a registration field, not measured payload. The file does not identify trucks that were deployed but generated no ticket."}

# Correct retained figures' question references to the actual Ranbir workbook IDs.
details["F16"]["question"] = "Q016: Where are the largest concentrations of recorded pickup volume?"
details["F21"]["question"] = "M04: How long does recorded ticket activity span in each Zone1 debris zone? Related area question: Q025."
values_path.write_text(json.dumps(values, separators=(",", ":"), allow_nan=False), encoding="utf-8")
details_path.write_text(json.dumps(details, indent=2, ensure_ascii=False), encoding="utf-8")
summary = {"tickets": len(df), "contractors": contractor_summary.reset_index().to_dict(orient="records"),
           "distinct_trucks": len(truck), "blank_addresses": len(blank),
           "blank_address_cy": round(float(blank.Volume.sum()), 2),
           "gps_field_conflicts": len(conflicts), "repeat_address_groups": len(spread),
           "spread_candidates_over_1km": candidate_count, "peak_week": peak_week.date().isoformat(),
           "peak_week_truck_ids": int(active.loc[peak_week].sum())}
(OUTPUT / "priority-figure-findings.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
print(json.dumps(summary, indent=2))
