"""Build five question-linked aggregate figures from the reviewed Pinellas CSV.

The public outputs contain no ticket IDs, address strings, or individual points.
Run with the 18,278-row CSV in the parent project directory.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


SITE = Path(__file__).resolve().parent
SOURCE = SITE.parent / "Pinellas-Debris-Tickets-2024.csv"
DATA = SITE / "data"
EXPECTED_ROWS = 18278
EXPECTED_CY = 644952.65


def source_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_csv(name: str, columns: list[str], rows: list[list]) -> None:
    with (DATA / name).open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(columns)
        writer.writerows(rows)


def main() -> None:
    DATA.mkdir(exist_ok=True)
    df = pd.read_csv(SOURCE, keep_default_na=False, low_memory=False)
    if len(df) != EXPECTED_ROWS:
        raise ValueError(f"Expected {EXPECTED_ROWS:,} tickets, got {len(df):,}")
    df["cy"] = pd.to_numeric(df.Volume, errors="coerce")
    parsed = pd.to_datetime(df.LoadDate, errors="coerce", utc=True)
    if df.cy.isna().any() or parsed.isna().any() or not df.cy.gt(0).all():
        raise ValueError("Missing, invalid, or nonpositive core date/volume values need review")
    if abs(float(df.cy.sum()) - EXPECTED_CY) > 0.001:
        raise ValueError("Recorded CY does not reconcile with the reviewed extract")
    df["day"] = parsed.dt.tz_convert("America/New_York").dt.tz_localize(None).dt.normalize()
    calendar = pd.date_range(df.day.min(), df.day.max(), freq="D")
    daily = df.groupby("day").cy.agg(["count", "sum"]).reindex(calendar, fill_value=0)
    daily.columns = ["tickets", "cy"]
    daily["cum_cy"] = daily.cy.cumsum()
    total_cy = round(float(daily.cy.sum()), 2)

    # Q003: first local date crossing each fraction of the observed total.
    milestones = []
    for fraction in (0.25, 0.50, 0.75, 0.90):
        row = daily[daily.cum_cy >= total_cy * fraction].iloc[0]
        date = daily[daily.cum_cy >= total_cy * fraction].index[0]
        milestones.append({
            "threshold_pct": int(fraction * 100),
            "date": date.date().isoformat(),
            "cumulative_cy": round(float(row.cum_cy), 2),
            "observed_share_pct": round(100 * float(row.cum_cy) / total_cy, 2),
        })
    cumulative = [
        {"date": date.date().isoformat(), "daily_cy": round(float(row.cy), 2), "cumulative_cy": round(float(row.cum_cy), 2)}
        for date, row in daily.iterrows()
    ]
    write_csv("q003-cumulative-milestones.csv", ["date", "daily_cy", "cumulative_cy"], [list(row.values()) for row in cumulative])

    # Q004: active dates ranked by CY; show daily and accumulated contributions.
    active = daily[daily.tickets > 0].copy()
    active["date"] = active.index.date.astype(str)
    active = active.sort_values(["cy", "date"], ascending=[False, True]).reset_index(drop=True)
    active["rank"] = range(1, len(active) + 1)
    active["share_pct"] = 100 * active.cy / total_cy
    active["cumulative_share_pct"] = active.share_pct.cumsum()
    ranked_days = [
        {"rank": int(row["rank"]), "date": row["date"], "tickets": int(row.tickets),
         "cy": round(float(row.cy), 2), "share_pct": round(float(row.share_pct), 3),
         "cumulative_share_pct": round(float(row.cumulative_share_pct), 3)}
        for _, row in active.iterrows()
    ]
    write_csv("q004-ranked-days.csv", ["rank", "date", "tickets", "cy", "share_pct", "cumulative_share_pct"], [list(row.values()) for row in ranked_days])

    # Q009: total weekly CY = number of tickets x mean CY per ticket.
    df["week"] = df.day - pd.to_timedelta(df.day.dt.weekday, unit="D")
    week_calendar = pd.date_range(df.week.min(), df.week.max(), freq="W-MON")
    weekly = df.groupby("week").cy.agg(["count", "sum"]).reindex(week_calendar, fill_value=0)
    weekly.columns = ["tickets", "cy"]
    weekly["mean_cy"] = weekly.cy.div(weekly.tickets.where(weekly.tickets.gt(0)))
    weeks = [
        {"week_start": date.date().isoformat(), "tickets": int(row.tickets),
         "cy": round(float(row.cy), 2), "mean_cy_per_ticket": round(float(row.mean_cy), 3) if row.tickets else None}
        for date, row in weekly.iterrows()
    ]
    if sum(row["tickets"] for row in weeks) != EXPECTED_ROWS or abs(sum(row["cy"] for row in weeks) - total_cy) > 0.01:
        raise ValueError("Weekly groups do not reconcile with source totals")
    write_csv("q009-weekly-components.csv", ["week_start", "tickets", "cy", "mean_cy_per_ticket"], [list(row.values()) for row in weeks])

    # Q026: normalized address strings as an explicit location key; publish ranks only.
    df["address_key"] = df.CollAddress.astype(str).str.upper().str.replace(r"\s+", " ", regex=True).str.strip()
    missing_address = df.address_key.eq("")
    addressed = df.loc[~missing_address].groupby("address_key").cy.agg(["count", "sum"]).reset_index()
    addressed.columns = ["address_key", "tickets", "cy"]
    addressed = addressed.sort_values(["cy", "address_key"], ascending=[False, True]).reset_index(drop=True)
    addressed["rank"] = range(1, len(addressed) + 1)
    addressed["cumulative_cy"] = addressed.cy.cumsum()
    addressed_total = float(addressed.cy.sum())
    addressed["cumulative_share_pct"] = 100 * addressed.cumulative_cy / addressed_total
    addressed["location_share_pct"] = 100 * addressed["rank"] / len(addressed)
    locations = [
        {"rank": int(row["rank"]), "tickets": int(row.tickets), "cy": round(float(row.cy), 2),
         "location_share_pct": round(float(row.location_share_pct), 4),
         "cumulative_share_pct": round(float(row.cumulative_share_pct), 4)}
        for _, row in addressed.iterrows()
    ]
    write_csv("q026-anonymous-location-ranks.csv", ["rank", "tickets", "cy", "location_share_pct", "cumulative_share_pct"], [list(row.values()) for row in locations])
    top_shares = {}
    for fraction in (0.01, 0.05, 0.10):
        n = math.ceil(len(addressed) * fraction)
        top_shares[str(int(fraction * 100))] = {"location_labels": n, "share_of_addressed_cy_pct": round(100 * float(addressed.cy.iloc[:n].sum()) / addressed_total, 2)}

    # Q053: compare ticket and CY ranks within one fixed, 30-zone geography.
    zones = df.groupby("Zone1").cy.agg(["count", "sum"]).reset_index()
    zones.columns = ["zone", "tickets", "cy"]
    if zones.zone.eq("").any() or len(zones) != 30:
        raise ValueError("Expected 30 populated Zone1 debris-zone labels")
    zones["ticket_rank"] = zones.tickets.rank(ascending=False, method="min").astype(int)
    zones["cy_rank"] = zones.cy.rank(ascending=False, method="min").astype(int)
    zones["rank_gap"] = zones.ticket_rank - zones.cy_rank
    zones["abs_gap"] = zones.rank_gap.abs()
    zones = zones.sort_values(["abs_gap", "zone"], ascending=[False, True])
    zone_ranks = [
        {"zone": row.zone, "tickets": int(row.tickets), "cy": round(float(row.cy), 2),
         "ticket_rank": int(row.ticket_rank), "cy_rank": int(row.cy_rank), "rank_gap": int(row.rank_gap)}
        for _, row in zones.iterrows()
    ]
    if int(zones.tickets.sum()) != EXPECTED_ROWS or abs(float(zones.cy.sum()) - total_cy) > 0.01:
        raise ValueError("Zone groups do not reconcile with source totals")
    write_csv("q053-zone-rank-differences.csv", ["zone", "tickets", "cy", "ticket_rank", "cy_rank", "rank_gap"], [list(row.values()) for row in zone_ranks])

    payload = {
        "source": "Pinellas County eGIS Debris Ticket Locations (reviewed CSV extract)",
        "source_sha256": source_hash(SOURCE),
        "source_extracted_date": "2026-10-12",
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "timezone": "America/New_York",
        "ticket_count": EXPECTED_ROWS,
        "total_cy": total_cy,
        "Q003": {"daily": cumulative, "milestones": milestones},
        "Q004": {"ranked_days": ranked_days, "active_dates": len(ranked_days)},
        "Q009": {"weeks": weeks},
        "Q026": {"locations": locations, "location_key": "uppercase, whitespace-normalized CollAddress",
                 "location_labels": len(addressed), "addressed_tickets": int((~missing_address).sum()),
                 "addressed_cy": round(addressed_total, 2), "excluded_missing_address_tickets": int(missing_address.sum()),
                 "excluded_missing_address_cy": round(float(df.loc[missing_address, "cy"].sum()), 2),
                 "top_shares": top_shares},
        "Q053": {"zones": zone_ranks, "area_key": "Zone1 debris-zone label"},
    }
    (DATA / "pinellas-five-figures.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print("milestones", milestones)
    print("active dates", len(ranked_days), "top 10 days share", ranked_days[9]["cumulative_share_pct"])
    print("peak week", max(weeks, key=lambda row: row["cy"]))
    print("address labels", len(addressed), "missing", int(missing_address.sum()), "top shares", top_shares)
    print("largest zone rank gaps", zone_ranks[:5])


if __name__ == "__main__":
    main()
