"""Build three aggregate St. Petersburg figures from public ArcGIS layers.

Only aggregate counts are written to the repository. No ticket identifiers,
addresses, names, or individual coordinates are published.
"""

from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


TICKETS = (
    "https://services.arcgis.com/HdtZMT2FmI4wPzTM/arcgis/rest/services/"
    "ReocveryTrac_DebrisRemovalData_StPeteCity_HurrMilton_Static_RT2024/FeatureServer/0"
)
NEIGHBORHOODS = (
    "https://egis.stpete.org/arcgis/rest/services/ServicesDOTS/"
    "NeighborhoodRelations/MapServer/22"
)
OUT = Path(__file__).resolve().parent / "data"
LOCAL_TZ = ZoneInfo("America/New_York")
ORDINARY = {"CONSTRUCTION&DEMOLITION", "VEGETATIVE/WOODY"}
DROP_OFF = {
    "CITIZEN DROPOFF DEBRIS - C&D",
    "CITIZEN DROPOFF DEBRIS - VEGETATIVE/WOODY",
}
GROUPS = [
    "Ordinary collection",
    "Citizen drop-off",
    "Other special services",
    "Household hazardous waste",
]


def get_json(base: str, params: dict) -> dict:
    request = Request(
        base + "/query",
        data=urlencode(params).encode("ascii"),
        headers={
            "User-Agent": "DebrisInsight research figure builder",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with urlopen(request, timeout=60) as response:
        data = json.load(response)
    if "error" in data:
        raise RuntimeError(f"ArcGIS query error: {data['error']}")
    return data


def ticket_rows() -> list[dict]:
    ids_response = get_json(TICKETS, {"where": "1=1", "returnIdsOnly": "true", "f": "json"})
    ids = sorted(ids_response["objectIds"])
    if len(ids) != 6694 or len(set(ids)) != len(ids):
        raise ValueError(f"Expected 6,694 distinct IDs from the reviewed static layer; got {len(ids)}")
    rows = []
    for start in range(0, len(ids), 500):
        result = get_json(
            TICKETS,
            {
                "objectIds": ",".join(map(str, ids[start : start + 500])),
                "outFields": "OBJECTID,DocumentFormatID,DebrisType,HazardClass,TicketDate,LoadDate,DisposalSite,Volume",
                "returnGeometry": "true",
                "outSR": "4326",
                "f": "json",
            },
        )
        if result.get("exceededTransferLimit"):
            raise ValueError("ArcGIS transfer limit reached in an ID batch")
        rows.extend(result["features"])
    returned = [row["attributes"]["OBJECTID"] for row in rows]
    if sorted(returned) != ids:
        raise ValueError("Downloaded ticket IDs do not match the source ID list")
    return rows


def neighborhood_features() -> list[dict]:
    result = get_json(
        NEIGHBORHOODS,
        {
            "where": "1=1",
            "outFields": "OBJECTID,NANAME,STATUS",
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "geojson",
        },
    )
    features = result["features"]
    if len(features) != 89:
        raise ValueError(f"Expected 89 city association polygons; got {len(features)}")
    return features


def on_segment(x: float, y: float, ax: float, ay: float, bx: float, by: float) -> bool:
    cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax)
    return abs(cross) < 1e-11 and min(ax, bx) - 1e-11 <= x <= max(ax, bx) + 1e-11 and min(
        ay, by
    ) - 1e-11 <= y <= max(ay, by) + 1e-11


def in_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    inside = False
    for index in range(len(ring)):
        ax, ay = ring[index - 1]
        bx, by = ring[index]
        if on_segment(x, y, ax, ay, bx, by):
            return True
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            inside = not inside
    return inside


def in_geometry(x: float, y: float, geometry: dict) -> bool:
    kind = geometry["type"]
    polygons = [geometry["coordinates"]] if kind == "Polygon" else geometry["coordinates"]
    if kind not in ("Polygon", "MultiPolygon"):
        raise ValueError(f"Unexpected neighborhood geometry: {kind}")
    return any(
        in_ring(x, y, polygon[0]) and not any(in_ring(x, y, hole) for hole in polygon[1:])
        for polygon in polygons
    )


def bbox(geometry: dict) -> tuple[float, float, float, float]:
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    points = [point for polygon in polygons for ring in polygon for point in ring]
    return (
        min(point[0] for point in points),
        min(point[1] for point in points),
        max(point[0] for point in points),
        max(point[1] for point in points),
    )


def activity_group(attributes: dict) -> str:
    fmt = attributes["DocumentFormatID"]
    debris = (attributes.get("DebrisType") or "").strip().upper()
    hazard = (attributes.get("HazardClass") or "").strip().upper()
    if fmt == 1 and debris in ORDINARY:
        return "Ordinary collection"
    if fmt == 1 and debris in DROP_OFF:
        return "Citizen drop-off"
    if fmt == 3 and hazard in {"HHW", "HOUSEHOLD HAZARDOUS WASTE"}:
        return "Household hazardous waste"
    if fmt == 3:
        return "Other special services"
    raise ValueError(f"Unclassified ticket: format={fmt}, debris={debris}, hazard={hazard}")


def local_date(timestamp_ms: int) -> str:
    return datetime.fromtimestamp(timestamp_ms / 1000, LOCAL_TZ).date().isoformat()


def write_csv(filename: str, headings: list[str], rows: list[list]) -> None:
    with (OUT / filename).open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(headings)
        writer.writerows(rows)


def main() -> None:
    rows = ticket_rows()
    features = neighborhood_features()
    associations = [
        {"name": feature["properties"]["NANAME"], "geometry": feature["geometry"], "bbox": bbox(feature["geometry"])}
        for feature in features
    ]
    daily = defaultdict(Counter)
    sites = defaultdict(Counter)
    totals = Counter()
    neighborhood_days = defaultdict(Counter)
    neighborhood_tickets = Counter()
    match_counts = Counter()
    for row in rows:
        a = row["attributes"]
        group = activity_group(a)
        ticket_date = local_date(a["TicketDate"])
        load_date = local_date(a["LoadDate"])
        site = (a.get("DisposalSite") or "").strip() or "MISSING"
        daily[load_date][group] += 1
        sites[group][site] += 1
        totals[group] += 1
        if group != "Ordinary collection":
            continue
        point = row.get("geometry") or {}
        x, y = point.get("x"), point.get("y")
        if x is None or y is None:
            match_counts["unmatched"] += 1
            continue
        matches = []
        for area in associations:
            minx, miny, maxx, maxy = area["bbox"]
            if minx <= x <= maxx and miny <= y <= maxy and in_geometry(x, y, area["geometry"]):
                matches.append(area["name"])
        if len(matches) == 1:
            name = matches[0]
            neighborhood_days[name][ticket_date] += 1
            neighborhood_tickets[name] += 1
            match_counts["unique"] += 1
        elif matches:
            match_counts["ambiguous"] += 1
        else:
            match_counts["unmatched"] += 1

    if totals != Counter({"Ordinary collection": 1923, "Citizen drop-off": 1164, "Other special services": 3566, "Household hazardous waste": 41}):
        raise ValueError(f"Activity groups do not reconcile with the reviewed draft: {totals}")
    if sum(sum(daily[date].values()) for date in daily) != 6694:
        raise ValueError("Daily counts do not reconcile with ticket total")
    if sum(sites[group][site] for group in sites for site in sites[group]) != 6694:
        raise ValueError("Receiving-site counts do not reconcile with ticket total")
    if sum(sites[group]["MISSING"] for group in GROUPS) != 3601:
        raise ValueError("Missing receiving-site count differs from reviewed draft")
    if match_counts != Counter({"unique": 1743, "unmatched": 180}):
        raise ValueError(f"Neighborhood matching differs from reviewed draft: {match_counts}")

    first = min(daily)
    last = max(daily)
    dates = [
        (datetime.fromisoformat(first) + timedelta(days=offset)).date().isoformat()
        for offset in range((datetime.fromisoformat(last) - datetime.fromisoformat(first)).days + 1)
    ]
    neighborhoods = []
    for name, counts in neighborhood_days.items():
        active = sorted(counts)
        span = (datetime.fromisoformat(active[-1]) - datetime.fromisoformat(active[0])).days + 1
        gaps = [
            (datetime.fromisoformat(b) - datetime.fromisoformat(a)).days - 1
            for a, b in zip(active, active[1:])
        ]
        neighborhoods.append(
            {
                "name": name,
                "tickets": neighborhood_tickets[name],
                "first": active[0],
                "last": active[-1],
                "span_days": span,
                "active_dates": len(active),
                "longest_gap_days": max(gaps, default=0),
                "daily": [counts.get(date, 0) for date in dates],
            }
        )
    neighborhoods.sort(key=lambda item: (-item["span_days"], -item["tickets"], item["name"]))
    selected = [item["name"] for item in neighborhoods if item["tickets"] >= 10][:12]

    OUT.mkdir(exist_ok=True)
    result = {
        "source": {"tickets": TICKETS, "neighborhoods": NEIGHBORHOODS},
        "retrieved_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "timezone": "America/New_York",
        "daily_date_field": "LoadDate",
        "neighborhood_date_field": "TicketDate",
        "ticket_count": len(rows),
        "dates": dates,
        "groups": GROUPS,
        "group_totals": dict(totals),
        "daily": {group: [daily[date][group] for date in dates] for group in GROUPS},
        "neighborhood_match_counts": dict(match_counts),
        "neighborhoods": neighborhoods,
        "selected_neighborhoods": selected,
        "site_labels": sorted({site for counts in sites.values() for site in counts}, key=lambda site: (site == "MISSING", site)),
        "receiving_sites": {group: dict(sites[group]) for group in GROUPS},
    }
    (OUT / "st-pete-additions.json").write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
    write_csv(
        "st-pete-daily-activity.csv",
        ["date", *GROUPS, "total_tickets"],
        [[date, *(daily[date][group] for group in GROUPS), sum(daily[date].values())] for date in dates],
    )
    write_csv(
        "st-pete-neighborhood-activity.csv",
        ["neighborhood_association", "date", "ordinary_collection_tickets", "observed_span_days", "active_dates", "longest_gap_days"],
        [
            [area["name"], date, count, area["span_days"], area["active_dates"], area["longest_gap_days"]]
            for area in neighborhoods
            for date, count in zip(dates, area["daily"])
        ],
    )
    write_csv(
        "st-pete-receiving-site-labels.csv",
        ["activity_group", "recorded_receiving_site_label", "tickets"],
        [[group, site, sites[group][site]] for group in GROUPS for site in result["site_labels"]],
    )
    print("groups:", dict(totals))
    print("neighborhood matches:", dict(match_counts), "associations:", len(neighborhoods))
    print("selected:", selected)
    print("receiving sites:", {group: dict(sites[group]) for group in GROUPS})
    print("peak:", max(dates, key=lambda date: sum(daily[date].values())), max(sum(daily[date].values()) for date in dates))


if __name__ == "__main__":
    main()
