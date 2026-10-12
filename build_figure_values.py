"""Build exact-value interactive companions to the 20 published figures.

Uses the same source and grouping rules as build-debris-figures.py. No ticket
identifiers or collection addresses are written to the public JSON.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
df = pd.read_csv(ROOT.parent / "Pinellas-Debris-Tickets-2024.csv", low_memory=False)
for col in ["Volume", "Lat", "Lng", "TruckCapacity", "LoadPercent"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")
df["day"] = pd.to_datetime(df["LoadDate"], utc=True, errors="coerce").dt.tz_convert("America/New_York").dt.tz_localize(None).dt.floor("D")
df["week"] = df["day"] - pd.to_timedelta(df["day"].dt.weekday, unit="D")
df["month"] = df["day"].dt.to_period("M")
df["type"] = df["DebrisType"].fillna("Unknown").astype(str).str.strip().replace("", "Unknown")
df["address"] = df["CollAddress"].fillna("").astype(str).str.upper().map(lambda x: re.sub(r"\s+", " ", x.strip()))

TEAL, NAVY, ORANGE, PLUM, GREY, GREEN = "#008b8b", "#17324b", "#d47b28", "#745493", "#a7b1bc", "#2f9e44"
COLORS = {"VEGETATIVE/WOODY": GREEN, "CONSTRUCTION&DEMOLITION": ORANGE, "VEG PARK DEBRIS": TEAL, "CPDR/PPDR VEG": PLUM, "C&D PARK DEBRIS": "#ad7f47", "CPDR/PPDR C&D": "#9c5b5b", "SAND/SILT": "#647d8e", "C&D COMMERCIAL DEBRIS": "#555555", "Other": GREY}
dates = lambda values: [pd.Timestamp(x).strftime("%Y-%m-%d") for x in values]
number = lambda x, d=0: f"{x:,.{d}f}"

def trace(x, y, title, xname, yname, color=TEAL, kind="bar", horizontal=False, digits=0, **extra):
    x, y = list(x), list(y)
    labels = [f"{xname}: {number(a, digits) if isinstance(a, (int, float, np.number)) else a}<br>{yname}: {number(b, digits) if isinstance(b, (int, float, np.number)) else b}" for a, b in zip(x, y)]
    t = {"type": kind, "name": title, "x": x, "y": y, "text": labels, "hovertemplate": "%{text}<extra></extra>", "marker": {"color": color}}
    if kind == "scatter":
        t["mode"] = extra.pop("mode", "lines+markers")
        t["line"] = {"color": color, "width": 2}
        t["marker"] = {"color": color, "size": 6}
    if horizontal:
        t["orientation"] = "h"
    t.update(extra)
    return t

spec = {}
def add(i, traces, xlabel, ylabel, **layout):
    spec[f"F{i:02d}"] = {"data": traces, "layout": {"xaxis": {"title": xlabel, "automargin": True}, "yaxis": {"title": ylabel, "automargin": True}, "hovermode": "closest", "showlegend": len(traces) > 1, "margin": {"l": 92, "r": 30, "t": 38, "b": 85}, **layout}}

calendar = pd.date_range(df.day.min(), df.day.max(), freq="D")
daily = df.groupby("day").agg(cy=("Volume", "sum"), tickets=("TicketId", "size")).reindex(calendar)
weekly = df.groupby("week").agg(cy=("Volume", "sum"), tickets=("TicketId", "size"))
types = df.groupby("type").agg(cy=("Volume", "sum"), tickets=("TicketId", "size")).sort_values("cy", ascending=False)
valid_xy = df.Lat.between(-90, 90) & df.Lng.between(-180, 180)
valid_cy = df.Volume.notna() & np.isfinite(df.Volume) & (df.Volume > 0)

# F01 / F02: each bar exposes the field or check and its exact record count.
fields = ["TicketId", "DisasterID", "CollAddress", "DebrisType", "LoadDate", "Volume", "Lat", "Lng", "ZoneName"]
present = [int((df[c].notna() & (df[c].astype(str).str.strip() != "")).sum()) for c in fields]
t = trace([round(v / len(df) * 100, 4) for v in present], fields, "Completeness", "Populated records (%)", "Field", TEAL, horizontal=True, digits=0)
t["marker"]["color"] = [TEAL if v / len(df) * 100 >= 99 else ORANGE for v in present]
t["text"] = [f"Field: {f}<br>Populated: {number(v)} of {number(len(df))} records<br>Completeness: {v/len(df)*100:.4f}%" for f, v in zip(fields, present)]
add(1, [t], "Records with a value (%)", "Ticket field", yaxis={"title": "Ticket field", "autorange": "reversed"}, margin={"l": 150, "r": 30, "t": 30, "b": 70})
flags = {"Missing collection address": int((df.address == "").sum()), "Unparseable load date": int(df.day.isna().sum()), "Missing/nonpositive CY": int((~valid_cy).sum()), "Invalid coordinates": int((~valid_xy).sum()), "Repeated TicketId": int(df.duplicated("TicketId", keep=False).sum()), "Volume above truck capacity": int((df.Volume > df.TruckCapacity).sum())}
t = trace(list(flags.values()), list(flags), "Review flags", "Flagged records", "Check", ORANGE, horizontal=True)
t["marker"]["color"] = [ORANGE if v else GREY for v in flags.values()]
t["text"] = [f"Check: {k}<br>Flagged records: {number(v)}" for k, v in flags.items()]
add(2, [t], "Flagged records (count)", "Review flag", yaxis={"title": "Review flag", "autorange": "reversed"}, margin={"l": 215, "r": 30, "t": 30, "b": 70})

mix = df.pivot_table(index="week", columns="DisasterID", values="TicketId", aggfunc="size", fill_value=0)
add(3, [trace(dates(mix.index), mix[c].astype(int), f"DisasterID {c}", "Week beginning", "Tickets", [ORANGE, TEAL, PLUM][i % 3]) for i, c in enumerate(mix.columns)], "Week beginning Monday", "Tickets (count)", barmode="stack")
add(4, [trace(dates(daily.index), [None if pd.isna(v) else round(v, 2) for v in daily.cy], "Daily CY", "Pickup date", "Recorded volume (CY)", TEAL, "scatter", digits=2)], "Local pickup date", "Recorded volume (CY/day)")
add(5, [trace(dates(weekly.index), [round(v, 2) for v in weekly.cy], "Weekly CY", "Week beginning", "Recorded volume (CY)", digits=2)], "Week beginning Monday", "Recorded volume (CY/week)")
add(6, [trace(dates(daily.index), [round(v, 2) for v in daily.cy.fillna(0).cumsum()], "Cumulative CY", "Pickup date", "Cumulative volume (CY)", NAVY, "scatter", digits=2)], "Local pickup date", "Cumulative recorded volume (CY)")
add(7, [trace(dates(daily.index), [None if pd.isna(v) else int(v) for v in daily.tickets], "Daily tickets", "Pickup date", "Tickets", ORANGE, "scatter")], "Local pickup date", "Tickets (count/day)")

edges = np.arange(0, 95, 5)
hist, _ = np.histogram(df.loc[valid_cy, "Volume"], bins=edges)
t = trace([float(edges[i] + 2.5) for i in range(len(hist))], hist.astype(int), "Load size", "Load volume range", "Tickets")
t["width"] = 5
t["marker"]["line"] = {"color": "white", "width": 1}
t["text"] = [f"Recorded volume: {edges[i]} to under {edges[i+1]} CY<br>Tickets: {int(hist[i]):,}" for i in range(len(hist))]
median_load = float(df.Volume.median())
add(8, [t], "Recorded volume per ticket (CY; 5-CY bins)", "Tickets (count)", xaxis={"title": "Recorded volume per ticket (CY; 5-CY bins)", "range": [0, 95]}, shapes=[{"type": "line", "x0": median_load, "x1": median_load, "y0": 0, "y1": 1, "yref": "paper", "line": {"color": ORANGE, "width": 2}}], annotations=[{"x": median_load, "y": 1, "yref": "paper", "text": f"Median {median_load:.1f} CY", "showarrow": False, "xanchor": "left", "yanchor": "bottom", "font": {"color": ORANGE, "size": 11}}])

major = types[types.tickets >= 20].index.tolist()
boxes = []
for kind in major:
    values = df.loc[df.type == kind, "Volume"].dropna().tolist()
    q1, med, q3 = np.percentile(values, [25, 50, 75])
    boxes.append({"type": "box", "name": kind, "x": [round(v, 2) for v in values], "y": [kind] * len(values), "orientation": "h", "boxpoints": False, "marker": {"color": COLORS.get(kind, GREY)}, "hovertemplate": f"Debris type: {kind}<br>Q1: {q1:.2f} CY<br>Median: {med:.2f} CY<br>Q3: {q3:.2f} CY<extra></extra>"})
add(9, boxes, "Recorded volume per ticket (CY)", "Debris type", showlegend=False, margin={"l": 230, "r": 25, "t": 30, "b": 70})

t = trace([round(v, 2) for v in types.cy], types.index, "Type volume", "Recorded volume (CY)", "Debris type", horizontal=True, digits=0)
t["marker"]["color"] = [COLORS.get(kind, GREY) for kind in types.index]
t["text"] = [f"Debris type: {k}<br>Recorded volume: {v:,.2f} CY<br>Tickets: {int(types.loc[k, 'tickets']):,}" for k, v in types.cy.items()]
add(10, [t], "Recorded volume (CY)", "Debris type", yaxis={"title": "Debris type", "autorange": "reversed"}, margin={"l": 230, "r": 25, "t": 30, "b": 70})
shares = []
for label, vals, color in [("Share of cubic yards", types.cy / types.cy.sum() * 100, TEAL), ("Share of tickets", types.tickets / types.tickets.sum() * 100, ORANGE)]:
    t = trace([round(v, 5) for v in vals], types.index, label, "Share (%)", "Debris type", color, horizontal=True, digits=5)
    t["text"] = [f"Debris type: {k}<br>{label}: {v:.5f}%" for k, v in vals.items()]
    shares.append(t)
add(11, shares, "Share of total (%)", "Debris type", barmode="group", yaxis={"title": "Debris type", "autorange": "reversed"}, legend={"x": 0.01, "y": 0.01, "xanchor": "left", "yanchor": "bottom", "bgcolor": "rgba(255,255,255,0.85)"}, margin={"l": 230, "r": 25, "t": 30, "b": 70})

top3 = types.index[:3].tolist()
df["type4"] = df.type.where(df.type.isin(top3), "Other")
comp = df.pivot_table(index="week", columns="type4", values="Volume", aggfunc="sum", fill_value=0).reindex(columns=top3 + ["Other"], fill_value=0)
add(12, [trace(dates(comp.index), [round(v, 2) for v in comp[c]], c, "Week beginning", f"{c} volume (CY)", COLORS.get(c, GREY), digits=2) for c in comp.columns], "Week beginning Monday", "Recorded volume (CY/week)", barmode="stack")
add(13, [trace(dates(comp.index), [round(v, 5) for v in comp[c] / comp.sum(axis=1) * 100], c, "Week beginning", f"{c} share (%)", COLORS.get(c, GREY), digits=5) for c in comp.columns], "Week beginning Monday", "Share of recorded volume (%)", barmode="stack")

expected = df.TruckCapacity * df.LoadPercent / 100
mask = expected.notna() & df.Volume.notna() & (expected >= 0)
pair = pd.DataFrame({"expected": expected[mask].round(2), "recorded": df.loc[mask, "Volume"].round(2)}).value_counts().reset_index(name="tickets")
t = trace(pair.expected.tolist(), pair.recorded.tolist(), "Capacity check", "Capacity × fullness (CY)", "Recorded volume (CY)", TEAL, "scatter", digits=2, mode="markers")
t["marker"] = {"color": TEAL, "size": [min(24, 6 + np.sqrt(n)) for n in pair.tickets], "opacity": 0.72}
t["text"] = [f"Capacity × fullness: {a:,.2f} CY<br>Recorded volume: {b:,.2f} CY<br>Tickets at these values: {n:,}" for a, b, n in pair.itertuples(index=False, name=None)]
limit = max(float(expected[mask].max()), float(df.loc[mask, "Volume"].max())) * 1.04
reference = {"type": "scatter", "mode": "lines", "x": [0, limit], "y": [0, limit], "name": "Recorded = capacity × fullness", "line": {"color": ORANGE, "width": 2}, "hoverinfo": "skip"}
add(14, [reference, t], "Truck capacity × load percent (CY)", "Recorded ticket volume (CY)", xaxis={"title": "Truck capacity × load percent (CY)", "range": [0, limit]}, yaxis={"title": "Recorded ticket volume (CY)", "range": [0, limit]})

xy = df.loc[valid_xy]
extent = [-82.88, -82.59, 27.59, 28.20]
for i, values, metric, precision in [(15, None, "Tickets in cell", 0), (16, xy.Volume, "Recorded volume in cell (CY)", 2)]:
    fig, ax = plt.subplots()
    h = ax.hexbin(xy.Lng, xy.Lat, C=values, reduce_C_function=np.sum, gridsize=35, extent=extent, mincnt=1) if values is not None else ax.hexbin(xy.Lng, xy.Lat, gridsize=35, extent=extent, mincnt=1)
    centers, totals = h.get_offsets(), h.get_array()
    plt.close(fig)
    t = trace([round(p[0], 6) for p in centers], [round(p[1], 6) for p in centers], metric, "Cell center longitude", "Cell center latitude", TEAL, "scatter", mode="markers")
    t["marker"] = {"symbol": "hexagon", "size": 13, "color": [round(float(v), precision) for v in totals], "colorscale": "YlGnBu", "reversescale": True, "showscale": True, "colorbar": {"title": "Tickets" if i == 15 else "CY"}, "line": {"width": 0.3, "color": "#456"}}
    t["text"] = [f"Cell center longitude: {p[0]:.6f}<br>Cell center latitude: {p[1]:.6f}<br>{metric}: {number(v, precision)}" for p, v in zip(centers, totals)]
    add(i, [t], "Longitude (degrees)", "Latitude (degrees)", xaxis={"title": "Longitude (degrees)", "range": extent[:2], "scaleanchor": "y", "constrain": "domain"}, yaxis={"title": "Latitude (degrees)", "range": extent[2:]}, margin={"l": 75, "r": 95, "t": 25, "b": 65})

monthly = []
monthly_layout = {"showlegend": False, "margin": {"l": 72, "r": 25, "t": 50, "b": 45}, "annotations": []}
for month_index, month in enumerate(sorted(df.month.dropna().unique())):
    part = df.loc[(df.month == month) & valid_xy]
    row, col = divmod(month_index, 4)
    axis = "" if month_index == 0 else str(month_index + 1)
    x0, x1 = 0.01 + col * 0.25, 0.23 + col * 0.25
    y0, y1 = (0.55, 0.98) if row == 0 else (0.06, 0.49)
    monthly_layout[f"xaxis{axis}"] = {"domain": [x0, x1], "anchor": f"y{axis}", "range": extent[:2], "showticklabels": row == 1, "tickfont": {"size": 9}, "title": "Longitude" if row == 1 else None, "automargin": True}
    monthly_layout[f"yaxis{axis}"] = {"domain": [y0, y1], "anchor": f"x{axis}", "range": extent[2:], "showticklabels": col == 0, "tickfont": {"size": 9}, "title": "Latitude" if col == 0 else None, "automargin": True}
    monthly_layout["annotations"].append({"x": (x0 + x1) / 2, "y": y1 + 0.01, "xref": "paper", "yref": "paper", "text": f"{month} · {len(part):,} tickets", "showarrow": False, "font": {"size": 11}})
    t = trace(part.Lng.round(6).tolist(), part.Lat.round(6).tolist(), str(month), "Longitude", "Latitude", TEAL, "scatter", mode="markers")
    t["marker"] = {"color": TEAL, "size": 3, "opacity": 0.25}
    t["text"] = [f"Month: {month}<br>Longitude: {lon:.6f}<br>Latitude: {lat:.6f}<br>Pickup date: {day:%Y-%m-%d}<br>Recorded volume: {cy:,.2f} CY" for lon, lat, day, cy in zip(part.Lng, part.Lat, part.day, part.Volume)]
    t["xaxis"], t["yaxis"] = f"x{axis}", f"y{axis}"
    monthly.append(t)
add(17, monthly, "Longitude (degrees)", "Latitude (degrees)", **monthly_layout)

address_counts = df.loc[df.address != ""].groupby("address").size()
buckets = Counter(np.clip(address_counts.to_numpy(), 1, 10))
add(18, [trace([str(i) for i in range(1, 10)] + ["10+"], [buckets.get(i, 0) for i in range(1, 11)], "Address frequency", "Tickets at address", "Distinct addresses")], "Tickets at normalized address", "Distinct addresses (count)")
unique_days = df.loc[df.address != "", ["address", "day"]].drop_duplicates().sort_values(["address", "day"])
intervals = unique_days.groupby("address").day.diff().dt.days.dropna().clip(upper=60).astype(int)
interval_counts = intervals.value_counts()
t = trace(list(range(1, 61)), [int(interval_counts.get(i, 0)) for i in range(1, 61)], "Pickup intervals", "Days between dates", "Address intervals")
t["text"] = [f"Days between distinct pickup dates: {i if i < 60 else '60 or more'}<br>Address intervals: {int(interval_counts.get(i, 0)):,}" for i in range(1, 61)]
add(19, [t], "Days between distinct pickup dates (60 = 60+)", "Address intervals (count)")

calendar_df = pd.DataFrame({"day": calendar, "tickets": daily.tickets.to_numpy()})
calendar_df["week"] = calendar_df.day - pd.to_timedelta(calendar_df.day.dt.weekday, unit="D")
calendar_df["weekday"] = calendar_df.day.dt.weekday
weeks = sorted(calendar_df.week.unique())
z = [[None] * 7 for _ in weeks]
hover = [["Outside observed date range"] * 7 for _ in weeks]
pos = {w: i for i, w in enumerate(weeks)}
for row in calendar_df.itertuples(index=False):
    n = 0 if pd.isna(row.tickets) else int(row.tickets)
    z[pos[row.week]][row.weekday] = n
    hover[pos[row.week]][row.weekday] = f"Pickup date: {row.day:%Y-%m-%d}<br>Recorded tickets: {n:,}"
heat = {"type": "heatmap", "x": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], "y": dates(weeks), "z": z, "text": hover, "hovertemplate": "%{text}<extra></extra>", "colorscale": "YlGnBu", "reversescale": True, "colorbar": {"title": "Tickets"}}
add(20, [heat], "Day of week", "Week beginning Monday", margin={"l": 95, "r": 85, "t": 25, "b": 65}, plot_bgcolor="#e0e3e7", yaxis={"title": "Week beginning Monday", "autorange": "reversed"})

for figure in spec.values():
    for item in figure["data"]:
        if item["type"] == "bar" and "text" in item:
            item["customdata"] = item.pop("text")
            item["hovertemplate"] = "%{customdata}<extra></extra>"

# Fix the opening view to the complete plotted range. Plotly's first responsive
# pass can otherwise focus on only part of a long time series in a modal.
for figure_id in ["F03", "F04", "F05", "F06", "F07", "F12", "F13"]:
    figure = spec[figure_id]
    xs = [pd.Timestamp(x) for item in figure["data"] for x in item["x"]]
    figure["layout"]["xaxis"]["range"] = [(min(xs) - pd.Timedelta(days=4)).strftime("%Y-%m-%d"), (max(xs) + pd.Timedelta(days=4)).strftime("%Y-%m-%d")]
    series = [np.array([0 if v is None else v for v in item["y"]], dtype=float) for item in figure["data"]]
    peak = max(np.sum(series, axis=0)) if figure["layout"].get("barmode") == "stack" else max(max(s) for s in series)
    figure["layout"]["yaxis"]["range"] = [0, float(peak) * 1.08]
for figure_id in ["F08", "F18", "F19"]:
    figure = spec[figure_id]
    peak = max(figure["data"][0]["y"])
    figure["layout"]["yaxis"]["range"] = [0, float(peak) * 1.08]
spec["F19"]["layout"]["xaxis"]["range"] = [0.5, 60.5]

output = ROOT / "data" / "figure-values.json"
output.write_text(json.dumps(spec, separators=(",", ":"), allow_nan=False, default=lambda value: value.item() if isinstance(value, np.generic) else str(value)), encoding="utf-8")
assert len(spec) == 20
assert int(interval_counts.sum()) == 1576
assert int(daily.tickets.sum()) == 18278
print(f"Wrote {len(spec)} interactive figures to {output} ({output.stat().st_size:,} bytes)")
