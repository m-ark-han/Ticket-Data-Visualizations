"""Rebuild Mark's area-duration, destination, and review outputs from the ticket CSV.

Public figures are aggregates. The address-level review stays outside the site repo.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


SITE = Path(__file__).resolve().parent
ROOT = SITE.parent
SOURCE = ROOT / "Pinellas-Debris-Tickets-2024.csv"
OUTPUT = ROOT / "outputs" / "mark-review"
OUTPUT.mkdir(parents=True, exist_ok=True)
FIGURES = SITE / "figures"
FIGURES.mkdir(exist_ok=True)

df = pd.read_csv(SOURCE, low_memory=False)
df["Volume"] = pd.to_numeric(df["Volume"], errors="coerce")
df["day"] = pd.to_datetime(df["LoadDate"], utc=True, errors="coerce").dt.tz_convert("America/New_York").dt.tz_localize(None).dt.floor("D")
df["address"] = df["CollAddress"].fillna("").astype(str).str.upper().str.replace(r"\s+", " ", regex=True).str.strip()
df["zone"] = df["Zone1"].fillna("").astype(str).str.strip()
df["site"] = df["DisposalSite"].fillna("").astype(str).str.strip()

assert len(df) == 18278
assert df["day"].notna().all()
assert df["zone"].ne("").all()
assert df["site"].ne("").all()
assert df["Volume"].notna().all()

TEAL, NAVY, ORANGE = "#008b8b", "#17324b", "#d47b28"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.spines.top": False,
                     "axes.spines.right": False, "figure.facecolor": "white", "axes.facecolor": "white"})

# Include zero-record complete Monday-Sunday weeks. The first and last partial weeks
# are deliberately omitted from low-week comparisons.
first_monday = df.day.min() + pd.Timedelta(days=(7 - df.day.min().weekday()) % 7)
last_sunday = df.day.max() - pd.Timedelta(days=(df.day.max().weekday() + 1) % 7)
starts = pd.date_range(first_monday, last_sunday, freq="W-MON")
week_key = df.day - pd.to_timedelta(df.day.dt.weekday, unit="D")
weekly = df.groupby(week_key).agg(tickets=("TicketId", "size"), cy=("Volume", "sum"))
weekly = weekly.reindex(starts, fill_value=0).rename_axis("week_beginning").reset_index()
weekly["week_ending"] = weekly.week_beginning + pd.Timedelta(days=6)
weekly["active_dates"] = [int(df.loc[df.day.between(a, b), "day"].nunique()) for a, b in zip(weekly.week_beginning, weekly.week_ending)]
weekly.to_csv(OUTPUT / "Complete-week-ticket-activity.csv", index=False, float_format="%.2f")
all_starts = pd.date_range(df.day.min() - pd.Timedelta(days=df.day.min().weekday()),
                           df.day.max() - pd.Timedelta(days=df.day.max().weekday()), freq="W-MON")
all_weeks = df.groupby(week_key).agg(tickets=("TicketId", "size"), cy=("Volume", "sum"))
all_weeks = all_weeks.reindex(all_starts, fill_value=0).rename_axis("week_beginning").reset_index()
all_weeks["complete"] = all_weeks.week_beginning.between(first_monday, last_sunday)

# A normalized address is a label, not a verified property or one physical pile.
nonblank = df[df.address.ne("")]
addresses = nonblank.groupby("address").agg(
    tickets=("TicketId", "size"), cy=("Volume", "sum"),
    first=("day", "min"), last=("day", "max"), active_dates=("day", "nunique"),
    unique_gps=("GPS", "nunique"), zones=("zone", "nunique"),
    debris_types=("DebrisType", "nunique"), destination_labels=("site", "nunique"),
)
many = addresses.loc[addresses.tickets >= 10].sort_values(["tickets", "cy"], ascending=False).copy()
many["observed_span_days"] = (many["last"] - many["first"]).dt.days
many.to_csv(OUTPUT / "Addresses-with-10-plus-tickets-local-review.csv", float_format="%.2f")

# Each zone gets its own 90%-of-observed-CY threshold. This is an activity-timing
# measure and is not a verified clearance or completion date.
zone_rows = []
for zone, group in df.groupby("zone"):
    by_day = group.groupby("day").Volume.sum().sort_index()
    first, last = by_day.index[0], by_day.index[-1]
    total = float(by_day.sum())
    threshold_day = by_day.cumsum()[lambda s: s >= 0.9 * total].index[0]
    zone_rows.append({"zone": zone.replace("Debris Zone ", ""), "tickets": int(len(group)),
                      "cy": round(total, 2), "first": first.date().isoformat(),
                      "last": last.date().isoformat(), "active_dates": int(len(by_day)),
                      "days_to_90pct_cy": int((threshold_day - first).days),
                      "first_to_last_days": int((last - first).days)})
zones = pd.DataFrame(zone_rows).sort_values("days_to_90pct_cy")
zones.to_csv(OUTPUT / "All-zone-recorded-activity-duration.csv", index=False)

sites = df.groupby("site").agg(tickets=("TicketId", "size"), cy=("Volume", "sum")).sort_values("cy", ascending=False)
sites.to_csv(OUTPUT / "Ticket-destination-label-totals.csv", float_format="%.2f")
flow = df.pivot_table(index="zone", columns="site", values="Volume", aggfunc="sum", fill_value=0)
flow.index = flow.index.str.replace("Debris Zone ", "", regex=False)
flow = flow.reindex(index=zones.zone.tolist(), columns=sites.index.tolist())
flow.to_csv(OUTPUT / "Zone-to-ticket-destination-CY.csv", float_format="%.2f")

source_line = "Pinellas County eGIS ticket extract · Oct 2, 2024–Apr 10, 2025 · accessed Oct 12, 2026"

# Refresh F05 so every calendar week, including the three zero-record weeks,
# is visible. Edge weeks are marked as partial observation periods.
fig, ax = plt.subplots(figsize=(11.2, 5.4))
bar_colors = ["#a7b1bc" if not complete else (ORANGE if cy == 0 else TEAL)
              for complete, cy in zip(all_weeks.complete, all_weeks.cy)]
ax.bar(all_weeks.week_beginning.dt.strftime("%b %d"), all_weeks.cy, color=bar_colors)
for index, row in all_weeks.iterrows():
    if row.cy == 0:
        ax.annotate("0", (index, 0), xytext=(0, 6), textcoords="offset points",
                    ha="center", color=ORANGE, fontsize=9, weight="bold")
ax.set_ylabel("Recorded pickup volume (CY per week)")
ax.set_xlabel("Week beginning Monday, 2024–2025")
ax.set_title("F05 · Weekly recorded collection volume", loc="left", weight="bold", fontsize=14)
ax.grid(axis="y", color="#dce5e8", linewidth=.6)
ax.set_axisbelow(True)
ax.tick_params(axis="x", labelrotation=55, labelsize=7)
fig.text(.02, .012, source_line + " · Gray bars: partial edge weeks; orange 0: no records in extract.", fontsize=7, color="#53616d")
fig.tight_layout(rect=(0, .04, 1, .98))
fig.savefig(FIGURES / "F05-weekly-volume.png", dpi=150)
plt.close(fig)

fig, ax = plt.subplots(figsize=(10.8, 11.5))
y = np.arange(len(zones))
ax.barh(y, zones.days_to_90pct_cy, color=TEAL, height=.64, label="First ticket to 90% of zone CY")
ax.scatter(zones.first_to_last_days, y, s=24, color=ORANGE, zorder=3, label="First to last ticket")
ax.set_yticks(y, zones.zone)
ax.invert_yaxis()
ax.set_xlabel("Elapsed days from first recorded pickup in zone")
ax.set_title("F21 · Recorded pickup activity duration by debris zone", loc="left", weight="bold", fontsize=14)
ax.grid(axis="x", color="#dce5e8", linewidth=.6)
ax.set_axisbelow(True)
ax.legend(loc="lower right", frameon=False)
fig.text(.02, .012, source_line + " · These are observed ticket spans, not clearance times.", fontsize=7, color="#53616d")
fig.tight_layout(rect=(0, .03, 1, .98))
fig.savefig(FIGURES / "F21-zone-activity-duration.png", dpi=150)
plt.close(fig)

fig, ax = plt.subplots(figsize=(10.8, 5.5))
ordered_sites = sites.iloc[::-1]
ax.barh(ordered_sites.index, ordered_sites.cy, color=TEAL)
for i, value in enumerate(ordered_sites.cy):
    ax.text(value + sites.cy.max()*.012, i, f"{value:,.0f} CY", va="center", fontsize=9)
ax.set_xlim(0, sites.cy.max()*1.25)
ax.set_xlabel("Recorded pickup-ticket volume (CY)")
ax.set_title("F22 · Recorded CY by ticket destination label", loc="left", weight="bold", fontsize=14)
ax.grid(axis="x", color="#dce5e8", linewidth=.6)
ax.set_axisbelow(True)
fig.text(.02, .012, source_line + " · Destination label does not verify arrival or final disposal.", fontsize=7, color="#53616d")
fig.tight_layout(rect=(0, .04, 1, .98))
fig.savefig(FIGURES / "F22-destination-label-volume.png", dpi=150)
plt.close(fig)

fig, ax = plt.subplots(figsize=(11.5, 10.5))
matrix = flow.to_numpy()
image = ax.imshow(matrix, aspect="auto", cmap="YlGnBu")
ax.set_yticks(np.arange(len(flow.index)), flow.index)
ax.set_xticks(np.arange(len(flow.columns)), [s.replace(" ", "\n") for s in flow.columns], fontsize=8)
ax.set_xlabel("Ticket DisposalSite label")
ax.set_ylabel("Ticket Zone1 debris zone")
ax.set_title("F23 · Recorded CY from debris zones to destination labels", loc="left", weight="bold", fontsize=14)
fig.colorbar(image, ax=ax, label="Recorded CY", fraction=.035, pad=.025)
fig.text(.02, .012, source_line + " · Label-pair sums; not verified transport or final fate.", fontsize=7, color="#53616d")
fig.tight_layout(rect=(0, .035, 1, .97))
fig.savefig(FIGURES / "F23-zone-destination-matrix.png", dpi=150)
plt.close(fig)

# Add exact-value companions to the existing gallery JSON. No addresses appear.
values_path = SITE / "data" / "figure-values.json"
specs = json.loads(values_path.read_text(encoding="utf-8"))
week_names = all_weeks.week_beginning.dt.strftime("%Y-%m-%d").tolist()
week_hover = [f"Week beginning: {row.week_beginning:%Y-%m-%d}<br>Recorded CY: {row.cy:,.2f}<br>Tickets: {row.tickets:,}<br>{'Complete week' if row.complete else 'Partial edge week'}"
              for row in all_weeks.itertuples(index=False)]
zero_positions = all_weeks.index[all_weeks.cy.eq(0)].tolist()
specs["F05"] = {"data": [
    {"type": "bar", "x": week_names, "y": all_weeks.cy.round(2).tolist(),
     "marker": {"color": bar_colors}, "customdata": week_hover, "hovertemplate": "%{customdata}<extra></extra>"},
    {"type": "scatter", "mode": "markers+text", "name": "No ticket records",
     "x": [week_names[i] for i in zero_positions], "y": [0] * len(zero_positions),
     "text": ["0"] * len(zero_positions), "textposition": "top center",
     "marker": {"color": ORANGE, "size": 9},
     "customdata": [week_hover[i] for i in zero_positions], "hovertemplate": "%{customdata}<extra></extra>"}],
    "layout": {"xaxis": {"title": "Week beginning Monday", "range": ["2024-09-25", "2025-04-19"], "tickangle": -35},
               "yaxis": {"title": "Recorded volume (CY/week)", "range": [0, float(all_weeks.cy.max()) * 1.1]},
               "margin": {"l": 85, "r": 25, "t": 35, "b": 95}, "showlegend": False, "hovermode": "closest"}}
zone_names = zones.zone.tolist()
zone_hover = [f"Zone1: {r.zone}<br>Tickets: {r.tickets:,}<br>Recorded CY: {r.cy:,.2f}<br>First: {r.first}<br>Last: {r.last}<br>Active dates: {r.active_dates}<br>Days to 90% of zone CY: {r.days_to_90pct_cy}<br>First-to-last: {r.first_to_last_days} days" for r in zones.itertuples(index=False)]
specs["F21"] = {"data": [
    {"type": "bar", "orientation": "h", "name": "Days to 90% of recorded CY", "x": zones.days_to_90pct_cy.tolist(), "y": zone_names,
     "marker": {"color": TEAL}, "customdata": zone_hover, "hovertemplate": "%{customdata}<extra></extra>"},
    {"type": "scatter", "mode": "markers", "name": "First-to-last ticket days", "x": zones.first_to_last_days.tolist(), "y": zone_names,
     "marker": {"color": ORANGE, "size": 8}, "customdata": zone_hover, "hovertemplate": "%{customdata}<extra></extra>"}],
    "layout": {"xaxis": {"title": "Days from first recorded pickup", "range": [0, int(zones.first_to_last_days.max()) + 10]},
               "yaxis": {"title": "Zone1 debris zone", "autorange": "reversed", "automargin": True},
               "margin": {"l": 110, "r": 25, "t": 25, "b": 65}, "barmode": "overlay", "showlegend": True, "hovermode": "closest"}}
site_names = sites.index.tolist()
site_hover = [f"DisposalSite label: {name}<br>Recorded CY: {sites.loc[name, 'cy']:,.2f}<br>Tickets: {int(sites.loc[name, 'tickets']):,}" for name in site_names]
specs["F22"] = {"data": [{"type": "bar", "orientation": "h", "x": sites.cy.tolist(), "y": site_names,
                         "marker": {"color": TEAL}, "customdata": site_hover, "hovertemplate": "%{customdata}<extra></extra>"}],
                "layout": {"xaxis": {"title": "Recorded pickup-ticket volume (CY)"},
                           "yaxis": {"title": "Ticket destination label", "autorange": "reversed", "automargin": True},
                           "margin": {"l": 285, "r": 30, "t": 25, "b": 65}, "showlegend": False}}
flow_hover = [[f"Zone1: {zone}<br>DisposalSite: {site}<br>Recorded CY: {flow.loc[zone, site]:,.2f}" for site in flow.columns] for zone in flow.index]
specs["F23"] = {"data": [{"type": "heatmap", "x": flow.columns.tolist(), "y": flow.index.tolist(),
                         "z": flow.round(2).values.tolist(), "customdata": flow_hover,
                         "hovertemplate": "%{customdata}<extra></extra>", "colorscale": "YlGnBu", "reversescale": True,
                         "colorbar": {"title": "CY"}}],
                "layout": {"xaxis": {"title": "Ticket DisposalSite label", "automargin": True, "tickangle": -25},
                           "yaxis": {"title": "Ticket Zone1 debris zone", "autorange": "reversed", "automargin": True},
                           "margin": {"l": 110, "r": 55, "t": 20, "b": 150}, "showlegend": False}}
values_path.write_text(json.dumps(specs, separators=(",", ":"), allow_nan=False), encoding="utf-8")

details_path = SITE / "data" / "figure-details.json"
details = json.loads(details_path.read_text(encoding="utf-8"))
details.update({
    "F05": {"question": "Q001: How much pickup volume is recorded each day and week? Related gap check: Q006.",
            "variables": "Local LoadDate and Volume. Sum CY by Monday-start week, including zero-record weeks. The first and last weeks are partial.",
            "interpretation": "The week beginning October 28, 2024 has the most recorded CY (112,592.90). Three complete late-February/March weeks have no ticket rows. County reporting says the unincorporated-area final pass ended in mid-January 2025, making a wind-down plausible; the ticket file cannot establish the cause of a particular gap."},
    "F21": {"question": "Area comparison: How long did recorded pickup activity continue in each Zone1 debris zone?",
            "variables": "Zone1, local LoadDate, Volume, TicketId. For each zone: first and last ticket date; first date cumulative CY reaches 90% of that zone's observed total.",
            "interpretation": f"Across {len(zones)} zones, the time to 90% of each zone's CY ranges from {zones.days_to_90pct_cy.min()} to {zones.days_to_90pct_cy.max()} days. The first-to-last ticket spans range from {zones.first_to_last_days.min()} to {zones.first_to_last_days.max()} days. These are recorded activity periods, not verified clearance times or municipality comparisons."},
    "F22": {"question": "Destination field: How much pickup-ticket CY is recorded under each DisposalSite label?",
            "variables": "DisposalSite, Volume, TicketId. Sum CY and count tickets per destination label.",
            "interpretation": f"All {len(df):,} tickets have a destination label. {site_names[0]} has the largest recorded sum at {sites.iloc[0].cy:,.2f} CY. The label does not prove a load arrived there or show processing, recycling, or final landfill disposal."},
    "F23": {"question": "Recorded flow: Which Zone1 debris-zone and DisposalSite label pairs have the most ticket CY?",
            "variables": "Zone1, DisposalSite, Volume. Sum CY for each zone–destination-label pair.",
            "interpretation": "The matrix shows how recorded pickup CY is distributed among zone–destination-label pairs. It is a ticket-label flow view, not a verified chain of custody or final-disposal outcome."},
})
details_path.write_text(json.dumps(details, indent=2) + "\n", encoding="utf-8")

summary = {"rows": int(len(df)), "complete_weeks": int(len(weekly)),
           "zero_weeks": weekly.loc[weekly.tickets.eq(0), "week_beginning"].dt.strftime("%Y-%m-%d").tolist(),
           "lowest_nonzero_weeks": weekly.loc[weekly.tickets.gt(0)].nsmallest(6, "cy").assign(week_beginning=lambda x: x.week_beginning.dt.strftime("%Y-%m-%d"))[ ["week_beginning", "tickets", "cy"] ].to_dict("records"),
           "addresses_ge_10": int(len(many)), "tickets_at_ge_10": int(many.tickets.sum()),
           "cy_at_ge_10": round(float(many.cy.sum()), 2),
           "top_addresses": many.head(8).reset_index()[["address", "tickets", "cy", "active_dates", "unique_gps", "zones", "debris_types", "destination_labels", "observed_span_days"]].to_dict("records"),
           "zones": int(len(zones)), "zone_min_90": int(zones.days_to_90pct_cy.min()),
           "zone_max_90": int(zones.days_to_90pct_cy.max()),
           "destinations": int(len(sites)), "largest_destination": site_names[0],
           "largest_destination_cy": round(float(sites.iloc[0].cy), 2),
           "flow_total_cy": round(float(flow.values.sum()), 2)}
(OUTPUT / "Mark-followup-analysis-summary.json").write_text(json.dumps(summary, indent=2, default=str) + "\n", encoding="utf-8")
print(json.dumps(summary, indent=2, default=str))
